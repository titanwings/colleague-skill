import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

import {
  createClaudeCodeHostBinding,
  createCodexHostBinding,
  createDshHostBinding,
  createHermesHostBinding,
  createOpenClawHostBinding,
  type HostBinding,
  type HostFormPresenter,
} from "@distilly/bindings";
import {
  BUILTIN_HOSTS,
  contentDigestSchema,
  hostNameSchema,
  isoDateTimeSchema,
  type ContentDigest,
  type HostName,
} from "@distilly/protocol";

import {
  loadConservativeFloorPreflight,
  loadPreviewHostFixture,
} from "./host-capacity-fixtures.js";
import {
  PREVIEW_PLUGIN_SOURCES,
  PREVIEW_RUNTIME_ENTRY,
  PREVIEW_RUNTIME_MANIFEST,
  inspectPreviewRuntimePackage,
  installPreviewRuntimePackage,
  removePreviewRuntimePackage,
  type VerifiedPreviewRuntimePackage,
} from "./runtime-package.js";

const INSTALL_FILE = "install.json";
const LAUNCHER_FILE = "distilly";
const RUNTIME_FILE = "runtime.json";
const RELEASE_FILE = "release-manifest.json";
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

// Version probes only need locale, temporary-directory, and executable-path
// context. Do not expose the parent process's API tokens, cloud credentials,
// SSH variables, or Node preload options to a host executable.
const SAFE_PROBE_ENVIRONMENT_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TERM",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_RUNTIME_DIR",
  "XDG_CONFIG_DIRS",
  "XDG_DATA_DIRS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "SYSTEMROOT",
  "WINDIR",
  "PATHEXT",
] as const;

interface ReleaseManifest {
  readonly releaseVersion: string;
  readonly canonicalSkillDigest: ContentDigest;
}

interface InstalledHost {
  readonly host: HostName;
  readonly executablePath: string;
  readonly hostVersion: string;
  readonly installedAt: string;
  /**
   * True when setup ran on the conservative floor because no capacity fixture is
   * recorded for this host version. Doctor keeps reporting the state.
   */
  readonly unverifiedHostVersion?: true;
}

interface PreviewInstallManifest {
  readonly schemaVersion: 1;
  readonly releaseVersion: string;
  readonly wireMajor: 3;
  readonly nodePath: string;
  readonly entryPath: string;
  readonly launcherPath: string;
  readonly launcherDigest: ContentDigest;
  readonly runtimePath: string;
  readonly runtimeDigest: ContentDigest;
  readonly hosts: readonly InstalledHost[];
}

interface LifecyclePaths {
  readonly root: string;
  readonly install: string;
  readonly launcher: string;
  readonly runtimeDirectory: string;
  readonly runtime: string;
  readonly packaged: boolean;
}

/** Trusted local paths used by the repo-local Developer Preview lifecycle. */
export interface PreviewLifecycleEnvironment {
  readonly homeDirectory: string;
  readonly nodePath: string;
  readonly entryPath: string;
  readonly pluginSourcesPath: string;
  /** Present only when entryPath belongs to an assembled self-contained runtime tree. */
  readonly runtimePackagePath?: string;
  readonly pathValue: string;
  readonly now?: () => Date;
}

/** One setup result suitable for concise human CLI output. */
export interface PreviewSetupResult {
  readonly host: HostName;
  readonly launcherPath: string;
  readonly releaseVersion: string;
  readonly restartRequired: true;
}

/** Narrow lifecycle plus binding health; it deliberately excludes deep Engine doctor. */
export interface PreviewDoctorReport {
  readonly ok: boolean;
  readonly installed: boolean;
  readonly releaseVersion?: string;
  readonly launcherReachable: boolean;
  readonly hosts: readonly {
    readonly host: HostName;
    readonly installed: boolean;
    readonly executableReachable: boolean;
    readonly launcherReachable: boolean;
    readonly wireCompatible: boolean;
    readonly warnings: readonly string[];
  }[];
  readonly warnings: readonly string[];
}

/** Result of removing one host projection without touching person data. */
export interface PreviewUninstallResult {
  readonly host: HostName;
  readonly removed: boolean;
  readonly launcherRemoved: boolean;
}

const fail = (message: string): Error => new Error(message);

const previewHost = (value: HostName): HostName => {
  const host = hostNameSchema.parse(value);
  if (host === BUILTIN_HOSTS.codex) return BUILTIN_HOSTS.codex;
  if (host === BUILTIN_HOSTS.claudeCode) return BUILTIN_HOSTS.claudeCode;
  if (host === BUILTIN_HOSTS.openclaw) return BUILTIN_HOSTS.openclaw;
  if (host === BUILTIN_HOSTS.hermes) return BUILTIN_HOSTS.hermes;
  if (host === BUILTIN_HOSTS.dsh) return BUILTIN_HOSTS.dsh;
  throw fail("The Developer Preview supports Codex, Claude Code, OpenClaw, Hermes, and DSH.");
};

/**
 * Returns a copy of an installed-host entry without the unverified-version flag.
 *
 * `exactOptionalPropertyTypes` forbids assigning `undefined` to an optional property, so
 * clearing the flag means removing the key rather than writing an undefined value.
 *
 * @param entry - Recorded host entry.
 * @returns The same entry with the flag removed.
 */
const withoutUnverifiedFlag = (
  entry: InstalledHost,
): Omit<InstalledHost, "unverifiedHostVersion"> => {
  const copy = { ...entry };
  delete copy.unverifiedHostVersion;
  return copy;
};

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...keys].sort(compareUtf8);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const digest = (bytes: Uint8Array | string): ContentDigest =>
  contentDigestSchema.parse(`sha256_${createHash("sha256").update(bytes).digest("hex")}`);

const jsonBytes = (value: unknown): Uint8Array =>
  Buffer.from(`${JSON.stringify(value, undefined, 2)}\n`, "utf8");

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const launcherBytes = (nodePath: string, entryPath: string): Uint8Array =>
  Buffer.from(`#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(entryPath)} "$@"\n`, "utf8");

const runtimeBytes = (releaseVersion: string, nodePath: string, entryPath: string): Uint8Array =>
  jsonBytes({ schemaVersion: 1, releaseVersion, nodePath, entryPath });

const pathsFor = (
  homeDirectory: string,
  releaseVersion: string,
  packaged: boolean,
): LifecyclePaths => {
  const root = join(homeDirectory, ".distilly");
  const runtimeDirectory = join(root, "runtime", releaseVersion);
  return {
    root,
    install: join(root, INSTALL_FILE),
    launcher: join(root, "bin", LAUNCHER_FILE),
    runtimeDirectory,
    runtime: join(runtimeDirectory, packaged ? PREVIEW_RUNTIME_MANIFEST : RUNTIME_FILE),
    packaged,
  };
};

const readOptionalRegularFile = async (path: string): Promise<Uint8Array | undefined> => {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw fail(`Expected a regular owned file at ${path}.`);
  }
  return Uint8Array.from(await readFile(path));
};

const ensureRoot = async (root: string): Promise<void> => {
  const metadata = await lstat(root).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (metadata !== undefined && (!metadata.isDirectory() || metadata.isSymbolicLink())) {
    throw fail("The Distilly data root must be a regular directory, not a symlink.");
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
};

const ensureRegularDirectory = async (path: string, create: boolean): Promise<void> => {
  let metadata = await lstat(path).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (metadata === undefined && create) {
    await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    metadata = await lstat(path);
  }
  if (metadata === undefined || !metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw fail("A Distilly lifecycle directory is missing or is not a regular directory.");
  }
};

/**
 * Ensures the Codex host home exists before Codex's version probe runs.
 *
 * @param homeDirectory - User home that owns the Codex configuration directory.
 */
const ensureCodexHostHome = async (homeDirectory: string): Promise<void> => {
  await ensureRegularDirectory(homeDirectory, true);
  await ensureRegularDirectory(join(homeDirectory, ".codex"), true);
};

const verifyLifecycleDirectories = async (
  paths: LifecyclePaths,
  create: boolean,
): Promise<void> => {
  await ensureRegularDirectory(paths.root, false);
  await ensureRegularDirectory(dirname(paths.launcher), create);
  const runtimeRoot = dirname(paths.runtimeDirectory);
  await ensureRegularDirectory(runtimeRoot, create);
  if (!paths.packaged || !create) {
    await ensureRegularDirectory(paths.runtimeDirectory, create);
  }
};

const atomicWrite = async (path: string, bytes: Uint8Array, mode: number): Promise<void> => {
  const temporary = `${path}.distilly-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { mode, flag: "wx" });
    await rename(temporary, path);
    await chmod(path, mode);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
};

const removeIfPresent = async (path: string): Promise<void> => {
  await unlink(path).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
};

const removeEmptyDirectory = async (path: string): Promise<void> => {
  await rmdir(path).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error;
  });
};

const parseRelease = (bytes: Uint8Array): ReleaseManifest => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw fail("The plugin release manifest is not valid UTF-8 JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The plugin release manifest is invalid.");
  }
  const record = value as Record<string, unknown>;
  const canonicalSkill = record.canonicalSkill;
  const wire = record.wire;
  if (
    typeof record.releaseVersion !== "string" ||
    !SEMVER_PATTERN.test(record.releaseVersion) ||
    canonicalSkill === null ||
    typeof canonicalSkill !== "object" ||
    Array.isArray(canonicalSkill) ||
    !contentDigestSchema.safeParse((canonicalSkill as Record<string, unknown>).digest).success ||
    wire === null ||
    typeof wire !== "object" ||
    Array.isArray(wire) ||
    (wire as Record<string, unknown>).minimumMajor !== 3 ||
    (wire as Record<string, unknown>).maximumMajor !== 3
  ) {
    throw fail("The plugin release manifest is incompatible with this Preview.");
  }
  return {
    releaseVersion: record.releaseVersion,
    canonicalSkillDigest: (canonicalSkill as { digest: ContentDigest }).digest,
  };
};

/**
 * Reads the exact release tuple consumed by setup and MCP preflight.
 *
 * @param pluginSourcesPath - Absolute root containing the release manifest.
 * @returns The validated Preview release tuple.
 */
const readPreviewRelease = async (pluginSourcesPath: string): Promise<ReleaseManifest> => {
  if (!isAbsolute(pluginSourcesPath)) throw fail("The plugin source path must be absolute.");
  const bytes = await readOptionalRegularFile(join(pluginSourcesPath, RELEASE_FILE));
  if (bytes === undefined) throw fail("The plugin release manifest is missing.");
  return parseRelease(bytes);
};

const parseInstalledHost = (value: unknown): InstalledHost => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The Preview install manifest contains an invalid host entry.");
  }
  const record = value as Record<string, unknown>;
  const host = hostNameSchema.safeParse(record.host);
  const installedAt = isoDateTimeSchema.safeParse(record.installedAt);
  if (
    // The unverified-version flag is optional, so this entry is checked for unknown keys
    // rather than for an exact key set: a verified install legitimately omits it.
    !Object.keys(record).every((key) =>
      ["host", "executablePath", "hostVersion", "installedAt", "unverifiedHostVersion"].includes(
        key,
      ),
    ) ||
    (record.unverifiedHostVersion !== undefined && record.unverifiedHostVersion !== true) ||
    !host.success ||
    ![
      BUILTIN_HOSTS.codex,
      BUILTIN_HOSTS.claudeCode,
      BUILTIN_HOSTS.openclaw,
      BUILTIN_HOSTS.hermes,
      BUILTIN_HOSTS.dsh,
    ].includes(host.data) ||
    typeof record.executablePath !== "string" ||
    !isAbsolute(record.executablePath) ||
    typeof record.hostVersion !== "string" ||
    record.hostVersion.length === 0 ||
    record.hostVersion.length > 256 ||
    record.hostVersion.includes("\n") ||
    record.hostVersion.includes("\r") ||
    !installedAt.success
  ) {
    throw fail("The Preview install manifest contains an invalid host entry.");
  }
  return {
    host: host.data,
    executablePath: record.executablePath,
    hostVersion: record.hostVersion,
    installedAt: installedAt.data,
    ...(record.unverifiedHostVersion === true ? { unverifiedHostVersion: true as const } : {}),
  };
};

const parseInstallManifest = (bytes: Uint8Array): PreviewInstallManifest => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw fail("The Preview install manifest is not valid UTF-8 JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The Preview install manifest is invalid.");
  }
  const record = value as Record<string, unknown>;
  const launcherDigest = contentDigestSchema.safeParse(record.launcherDigest);
  const runtimeDigest = contentDigestSchema.safeParse(record.runtimeDigest);
  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "releaseVersion",
      "wireMajor",
      "nodePath",
      "entryPath",
      "launcherPath",
      "launcherDigest",
      "runtimePath",
      "runtimeDigest",
      "hosts",
    ]) ||
    record.schemaVersion !== 1 ||
    typeof record.releaseVersion !== "string" ||
    !SEMVER_PATTERN.test(record.releaseVersion) ||
    record.wireMajor !== 3 ||
    typeof record.nodePath !== "string" ||
    !isAbsolute(record.nodePath) ||
    typeof record.entryPath !== "string" ||
    !isAbsolute(record.entryPath) ||
    typeof record.launcherPath !== "string" ||
    !isAbsolute(record.launcherPath) ||
    !launcherDigest.success ||
    typeof record.runtimePath !== "string" ||
    !isAbsolute(record.runtimePath) ||
    !runtimeDigest.success ||
    !Array.isArray(record.hosts)
  ) {
    throw fail("The Preview install manifest is invalid.");
  }
  const hosts = record.hosts
    .map(parseInstalledHost)
    .sort((left, right) => compareUtf8(left.host, right.host));
  if (hosts.length > 4 || new Set(hosts.map((entry) => entry.host)).size !== hosts.length) {
    throw fail("The Preview install manifest contains duplicate hosts.");
  }
  return {
    schemaVersion: 1,
    releaseVersion: record.releaseVersion,
    wireMajor: 3,
    nodePath: record.nodePath,
    entryPath: record.entryPath,
    launcherPath: record.launcherPath,
    launcherDigest: launcherDigest.data,
    runtimePath: record.runtimePath,
    runtimeDigest: runtimeDigest.data,
    hosts,
  };
};

const readInstallManifest = async (path: string): Promise<PreviewInstallManifest | undefined> => {
  const bytes = await readOptionalRegularFile(path);
  return bytes === undefined ? undefined : parseInstallManifest(bytes);
};

const verifyOwnedFile = async (
  path: string,
  expectedDigest: ContentDigest,
  executable = false,
): Promise<void> => {
  const bytes = await readOptionalRegularFile(path);
  if (bytes === undefined || digest(bytes) !== expectedDigest) {
    throw fail(`An owned Distilly lifecycle file is missing or modified: ${path}.`);
  }
  if (executable && process.platform !== "win32") {
    await access(path, constants.X_OK).catch(() => {
      throw fail(`The Distilly launcher is not executable: ${path}.`);
    });
  }
};

const verifyManifestPaths = (
  manifest: PreviewInstallManifest,
  environment: PreviewLifecycleEnvironment,
): LifecyclePaths => {
  const packaged = environment.runtimePackagePath !== undefined;
  const expected = pathsFor(environment.homeDirectory, manifest.releaseVersion, packaged);
  const expectedEntry = packaged
    ? join(expected.runtimeDirectory, PREVIEW_RUNTIME_ENTRY)
    : environment.entryPath;
  if (
    manifest.launcherPath !== expected.launcher ||
    manifest.runtimePath !== expected.runtime ||
    manifest.nodePath !== environment.nodePath ||
    manifest.entryPath !== expectedEntry
  ) {
    throw fail("The Preview lifecycle manifest does not match this installed entry.");
  }
  return expected;
};

const verifyBootstrap = async (
  manifest: PreviewInstallManifest,
  environment: PreviewLifecycleEnvironment,
): Promise<LifecyclePaths> => {
  const paths = verifyManifestPaths(manifest, environment);
  await verifyLifecycleDirectories(paths, false);
  await verifyOwnedFile(paths.launcher, manifest.launcherDigest, true);
  if (paths.packaged) {
    const runtime = await inspectPreviewRuntimePackage(paths.runtimeDirectory);
    if (
      runtime.manifestDigest !== manifest.runtimeDigest ||
      runtime.releaseVersion !== manifest.releaseVersion ||
      runtime.entryPath !== manifest.entryPath
    ) {
      throw fail("The installed Preview runtime does not match its install manifest.");
    }
  } else {
    await verifyOwnedFile(paths.runtime, manifest.runtimeDigest);
  }
  return paths;
};

const hostExecutableName = (host: HostName): "codex" | "claude" | "openclaw" | "hermes" | "dsh" => {
  if (host === BUILTIN_HOSTS.codex) return "codex";
  if (host === BUILTIN_HOSTS.claudeCode) return "claude";
  if (host === BUILTIN_HOSTS.openclaw) return "openclaw";
  if (host === BUILTIN_HOSTS.dsh) return "dsh";
  return "hermes";
};

/**
 * Finds one executable through absolute PATH entries and stores its resolved path.
 *
 * @param host - Supported host whose executable is required.
 * @param pathValue - PATH string containing only explicitly searched entries.
 * @returns The resolved regular executable path.
 */
const findHostExecutable = async (host: HostName, pathValue: string): Promise<string> => {
  const name = hostExecutableName(host);
  const suffixes = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    for (const suffix of suffixes) {
      const candidate = join(directory, `${name}${suffix}`);
      try {
        await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
        const resolved = await realpath(candidate);
        const metadata = await lstat(resolved);
        if (metadata.isFile() && !metadata.isSymbolicLink()) return resolved;
      } catch {
        // Try the next explicit PATH entry.
      }
    }
  }
  throw fail(`Could not find the ${name} executable on PATH.`);
};

/**
 * Supplies only the host-owned state roots needed for an isolated probe.
 * Secrets are intentionally never copied into lifecycle child environments.
 *
 * @param host - Host whose state root is being probed.
 * @param homeDirectory - Isolated user home for the probe.
 * @returns Host-specific non-secret environment values.
 */
const hostEnvironment = (
  host: HostName,
  homeDirectory: string,
): Readonly<Record<string, string>> => ({
  ...(host === BUILTIN_HOSTS.codex ? { CODEX_HOME: join(homeDirectory, ".codex") } : {}),
  ...(host === BUILTIN_HOSTS.openclaw
    ? {
        OPENCLAW_STATE_DIR: join(homeDirectory, ".openclaw"),
        OPENCLAW_CONFIG_PATH: join(homeDirectory, ".openclaw", "openclaw.json"),
      }
    : {}),
  ...(host === BUILTIN_HOSTS.hermes ? { HERMES_HOME: join(homeDirectory, ".hermes") } : {}),
});

const safeProbeEnvironment = (): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key of SAFE_PROBE_ENVIRONMENT_KEYS) {
    const value = process.env[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
};

const normalizeHostVersion = (host: HostName, stdout: string): string => {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // Hermes prints a short version line followed by diagnostic metadata. Keep
  // only the stable first line so an upgrade does not make the manifest noisy.
  if (host === BUILTIN_HOSTS.hermes) {
    const first = lines[0] ?? "";
    return /^Hermes Agent v\S+(?:\s+\([^\r\n]+\))?$/u.test(first) ? first : "";
  }
  return lines.length === 1 ? lines[0]! : "";
};

const probeHostVersion = async (
  host: HostName,
  executablePath: string,
  homeDirectory: string,
  nodePath: string,
  pathValue: string,
): Promise<string> =>
  new Promise((resolvePromise, reject) => {
    execFile(
      executablePath,
      ["--version"],
      {
        encoding: "utf8",
        env: {
          ...safeProbeEnvironment(),
          HOME: homeDirectory,
          USERPROFILE: homeDirectory,
          PATH: [dirname(nodePath), pathValue].filter(Boolean).join(delimiter),
          ...hostEnvironment(host, homeDirectory),
        },
        maxBuffer: 4_096,
        // Hermes starts a Python environment on every invocation; a cold
        // `--version` probe can exceed five seconds on a fresh install.
        timeout: host === BUILTIN_HOSTS.hermes ? 15_000 : 5_000,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(fail("The host executable version probe failed."));
          return;
        }
        const standard = normalizeHostVersion(host, stdout);
        const diagnostic = stderr.trim();
        const version = standard.length > 0 && diagnostic.length === 0 ? standard : "";
        if (
          version.length === 0 ||
          version.length > 256 ||
          version.includes("\n") ||
          version.includes("\r")
        ) {
          reject(fail("The host executable returned an invalid version."));
          return;
        }
        resolvePromise(version);
      },
    );
  });

const forms: HostFormPresenter = {
  ask: () =>
    Promise.reject(fail("Interactive host forms are not available during lifecycle setup.")),
};

const createBinding = (
  host: HostName,
  hostVersion: string,
  environment: PreviewLifecycleEnvironment,
  release: ReleaseManifest,
  executablePath: string,
  allowUnverifiedHost = false,
): HostBinding => {
  const options = {
    homeDirectory: environment.homeDirectory,
    forms,
    provider: {
      load: (context: { readonly environment: "desktop" | "cli" | "ci" }) => {
        const tuple = {
          releaseVersion: release.releaseVersion,
          canonicalSkillDigest: release.canonicalSkillDigest,
        };
        try {
          return Promise.resolve(
            loadPreviewHostFixture(host, hostVersion, context.environment, tuple),
          );
        } catch (error) {
          // Only an explicit operator opt-in replaces a missing measurement, and the
          // replacement is a labelled floor rather than another host's budget.
          if (!allowUnverifiedHost) throw error;
          return Promise.resolve(
            loadConservativeFloorPreflight(host, hostVersion, context.environment, tuple),
          );
        }
      },
    },
    release: {
      releaseVersion: release.releaseVersion,
      wireMajor: 3 as const,
      canonicalSkillDigest: release.canonicalSkillDigest,
    },
    ...(environment.now === undefined ? {} : { now: environment.now }),
  };
  if (host === BUILTIN_HOSTS.codex) {
    return createCodexHostBinding({ ...options, executablePath });
  }
  if (host === BUILTIN_HOSTS.claudeCode) {
    return createClaudeCodeHostBinding(options);
  }
  if (host === BUILTIN_HOSTS.openclaw) {
    return createOpenClawHostBinding({ ...options, executablePath });
  }
  if (host === BUILTIN_HOSTS.dsh) {
    return createDshHostBinding({ ...options, executablePath });
  }
  return createHermesHostBinding({ ...options, executablePath });
};

const pluginSource = (pluginSourcesPath: string, host: HostName): string => {
  if (host === BUILTIN_HOSTS.codex) return join(pluginSourcesPath, "codex");
  if (host === BUILTIN_HOSTS.hermes) return join(pluginSourcesPath, "shared", "skills", "distilly");
  return join(pluginSourcesPath, "claude-code");
};

const installedPluginSources = (
  paths: LifecyclePaths,
  environment: PreviewLifecycleEnvironment,
): string =>
  paths.packaged
    ? join(paths.runtimeDirectory, PREVIEW_PLUGIN_SOURCES)
    : environment.pluginSourcesPath;

const installContext = (
  paths: LifecyclePaths,
  release: ReleaseManifest,
  pluginSourcesPath: string,
  host: HostName,
) => ({
  launcherPath: paths.launcher,
  pluginSourcePath: pluginSource(pluginSourcesPath, host),
  runtimeVersion: release.releaseVersion,
});

const writeManifest = async (path: string, manifest: PreviewInstallManifest): Promise<void> =>
  atomicWrite(path, jsonBytes(manifest), 0o600);

const removeBootstrap = async (
  paths: LifecyclePaths,
  runtimeDigest?: ContentDigest,
): Promise<void> => {
  await removeIfPresent(paths.launcher);
  await removeEmptyDirectory(dirname(paths.launcher));
  if (paths.packaged) {
    if (runtimeDigest === undefined) {
      throw fail("The owned packaged runtime digest is required for removal.");
    }
    await removePreviewRuntimePackage(paths.runtimeDirectory, runtimeDigest);
  } else {
    await removeIfPresent(paths.runtime);
    await removeEmptyDirectory(paths.runtimeDirectory);
  }
  await removeEmptyDirectory(dirname(paths.runtimeDirectory));
};

const assertEnvironment = (environment: PreviewLifecycleEnvironment): void => {
  if (
    !isAbsolute(environment.homeDirectory) ||
    !isAbsolute(environment.nodePath) ||
    !isAbsolute(environment.entryPath) ||
    !isAbsolute(environment.pluginSourcesPath) ||
    (environment.runtimePackagePath !== undefined && !isAbsolute(environment.runtimePackagePath))
  ) {
    throw fail("Preview lifecycle paths must be absolute.");
  }
  const [majorText, minorText] = process.versions.node.split(".");
  const major = Number(majorText);
  const minor = Number(minorText);
  if (!((major === 22 && minor >= 19) || major === 24)) {
    throw fail("Distilly Developer Preview requires Node 22.19+ or Node 24.");
  }
  if (!new Set(["darwin", "linux"]).has(process.platform)) {
    throw fail(`Distilly Developer Preview does not support ${process.platform}.`);
  }
};

/**
 * Installs one real host integration around the current checked built entry.
 *
 * @param hostValue - Codex, Claude Code, OpenClaw, Hermes, or DSH.
 * @param environment - Trusted local lifecycle paths and clock.
 * @param options - Install policy.
 * @param options.allowUnverifiedHost - Accepts an unrecorded host version on the
 * conservative floor instead of failing closed.
 * @returns The installed host and restart requirement.
 */
export const setupPreviewHost = async (
  hostValue: HostName,
  environment: PreviewLifecycleEnvironment,
  options: { readonly allowUnverifiedHost?: boolean } = {},
): Promise<PreviewSetupResult> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const sourceRuntime: VerifiedPreviewRuntimePackage | undefined =
    environment.runtimePackagePath === undefined
      ? undefined
      : await inspectPreviewRuntimePackage(environment.runtimePackagePath);
  if (
    sourceRuntime !== undefined &&
    (sourceRuntime.entryPath !== resolve(environment.entryPath) ||
      sourceRuntime.pluginSourcesPath !== resolve(environment.pluginSourcesPath))
  ) {
    throw fail("The Preview CLI entry does not match its runtime package manifest.");
  }
  const sourcePlugins = sourceRuntime?.pluginSourcesPath ?? environment.pluginSourcesPath;
  const release = await readPreviewRelease(sourcePlugins);
  if (sourceRuntime !== undefined && sourceRuntime.releaseVersion !== release.releaseVersion) {
    throw fail("The Preview runtime and plugin release versions do not match.");
  }
  const paths = pathsFor(
    environment.homeDirectory,
    release.releaseVersion,
    sourceRuntime !== undefined,
  );
  const installedEntry =
    sourceRuntime === undefined
      ? environment.entryPath
      : join(paths.runtimeDirectory, PREVIEW_RUNTIME_ENTRY);
  const installedPlugins =
    sourceRuntime === undefined
      ? environment.pluginSourcesPath
      : join(paths.runtimeDirectory, PREVIEW_PLUGIN_SOURCES);
  const executablePath = await findHostExecutable(host, environment.pathValue);
  if (host === BUILTIN_HOSTS.codex) {
    await ensureCodexHostHome(environment.homeDirectory);
  }
  const hostVersion = await probeHostVersion(
    host,
    executablePath,
    environment.homeDirectory,
    environment.nodePath,
    environment.pathValue,
  );
  const binding = createBinding(
    host,
    hostVersion,
    environment,
    release,
    executablePath,
    options.allowUnverifiedHost === true,
  );
  const preflight = await binding.preflight({ sessionId: `setup-${host}`, environment: "cli" });
  if (!preflight.ok) throw fail(preflight.error.message);
  const unverifiedHost =
    preflight.evidence.kind === "unverified_host_version" ? (true as const) : undefined;
  await ensureRoot(paths.root);
  await verifyLifecycleDirectories(paths, true);
  const previous = await readInstallManifest(paths.install);
  const expectedLauncher = launcherBytes(environment.nodePath, installedEntry);
  const expectedRuntime =
    sourceRuntime === undefined
      ? runtimeBytes(release.releaseVersion, environment.nodePath, installedEntry)
      : undefined;
  const launcherDigest = digest(expectedLauncher);
  const runtimeDigest =
    sourceRuntime === undefined ? digest(expectedRuntime!) : sourceRuntime.manifestDigest;
  let createdBootstrap = false;
  if (previous === undefined) {
    const runtimeExists = paths.packaged
      ? await lstat(paths.runtimeDirectory)
          .then(() => true)
          .catch((error: unknown) => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
            throw error;
          })
      : (await readOptionalRegularFile(paths.runtime)) !== undefined;
    if ((await readOptionalRegularFile(paths.launcher)) !== undefined || runtimeExists) {
      throw fail("Unowned Distilly bootstrap files already exist.");
    }
    try {
      if (sourceRuntime === undefined) {
        await ensureRegularDirectory(paths.runtimeDirectory, true);
        await atomicWrite(paths.runtime, expectedRuntime!, 0o600);
      } else {
        await installPreviewRuntimePackage(sourceRuntime, paths.runtimeDirectory);
      }
      await atomicWrite(paths.launcher, expectedLauncher, 0o700);
      createdBootstrap = true;
    } catch (error) {
      if (sourceRuntime === undefined) {
        await removeIfPresent(paths.runtime);
        await removeEmptyDirectory(paths.runtimeDirectory);
      } else {
        await removePreviewRuntimePackage(paths.runtimeDirectory, runtimeDigest).catch(
          () => undefined,
        );
      }
      await removeIfPresent(paths.launcher);
      throw error;
    }
  } else {
    if (
      previous.releaseVersion !== release.releaseVersion ||
      previous.launcherDigest !== launcherDigest ||
      previous.runtimeDigest !== runtimeDigest
    ) {
      throw fail("A different Distilly runtime is installed; Preview upgrade is not enabled yet.");
    }
    await verifyBootstrap(previous, environment);
  }

  const existed = previous?.hosts.some((entry) => entry.host === host) ?? false;
  // A host projection can predate the shared Preview install manifest (for
  // example, a manually installed Hermes Skill). Remember that state before
  // setup so a later lifecycle failure never uninstalls somebody else's
  // verified integration.
  const preexistingBinding =
    !existed &&
    (await binding
      .doctor({ sessionId: `setup-${host}-before`, environment: "cli" })
      .then((health) => health.installed)
      .catch(() => false));
  let bindingInstalled = false;
  try {
    const installed = await binding.installPlugin(
      installContext(paths, release, installedPlugins, host),
    );
    bindingInstalled = true;
    const health = await binding.doctor({ sessionId: `setup-${host}`, environment: "cli" });
    if (
      !installed.restartRequired ||
      !health.installed ||
      !health.launcherReachable ||
      !health.wireCompatible ||
      health.warnings.length > 0
    ) {
      throw fail(`Distilly setup could not verify the ${host} integration.`);
    }
    const priorHost = previous?.hosts.find((entry) => entry.host === host);
    const hostEntry: InstalledHost =
      priorHost === undefined
        ? {
            host,
            executablePath,
            hostVersion,
            installedAt: isoDateTimeSchema.parse(
              (environment.now ?? (() => new Date()))().toISOString(),
            ),
            ...(unverifiedHost === undefined ? {} : { unverifiedHostVersion: unverifiedHost }),
          }
        : unverifiedHost === undefined
          ? { ...withoutUnverifiedFlag(priorHost), executablePath, hostVersion }
          : { ...priorHost, executablePath, hostVersion, unverifiedHostVersion: unverifiedHost };
    const hosts = [
      ...(previous?.hosts.filter((entry) => entry.host !== host) ?? []),
      hostEntry,
    ].sort((left, right) => compareUtf8(left.host, right.host));
    await writeManifest(paths.install, {
      schemaVersion: 1,
      releaseVersion: release.releaseVersion,
      wireMajor: 3,
      nodePath: environment.nodePath,
      entryPath: installedEntry,
      launcherPath: paths.launcher,
      launcherDigest,
      runtimePath: paths.runtime,
      runtimeDigest,
      hosts,
    });
    return {
      host,
      launcherPath: paths.launcher,
      releaseVersion: release.releaseVersion,
      restartRequired: true,
    };
  } catch (error) {
    if (bindingInstalled && !existed && !preexistingBinding) {
      await binding
        .uninstallPlugin(installContext(paths, release, installedPlugins, host))
        .catch(() => undefined);
    }
    if (createdBootstrap) await removeBootstrap(paths, runtimeDigest).catch(() => undefined);
    throw error;
  }
};

const executableReachable = async (path: string): Promise<boolean> => {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile()) return false;
    if (process.platform !== "win32") await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads only lifecycle ownership and each installed binding's narrow doctor.
 *
 * @param environment - Trusted local lifecycle paths and clock.
 * @param hostFilter - Optional supported host to diagnose.
 * @returns Narrow lifecycle and binding health.
 */
export const doctorPreview = async (
  environment: PreviewLifecycleEnvironment,
  hostFilter?: HostName,
): Promise<PreviewDoctorReport> => {
  assertEnvironment(environment);
  const warnings: string[] = [];
  let manifest: PreviewInstallManifest | undefined;
  try {
    manifest = await readInstallManifest(
      join(environment.homeDirectory, ".distilly", INSTALL_FILE),
    );
  } catch (error) {
    return {
      ok: false,
      installed: false,
      launcherReachable: false,
      hosts: [],
      warnings: [error instanceof Error ? error.message : "The install manifest is invalid."],
    };
  }
  if (manifest === undefined) {
    return {
      ok: false,
      installed: false,
      launcherReachable: false,
      hosts: [],
      warnings: ["Distilly Developer Preview is not installed."],
    };
  }
  const paths = verifyManifestPaths(manifest, environment);
  let launcherReachable = true;
  try {
    await verifyBootstrap(manifest, environment);
  } catch (error) {
    launcherReachable = false;
    warnings.push(
      error instanceof Error ? error.message : "Distilly bootstrap verification failed.",
    );
  }
  const release = await readPreviewRelease(installedPluginSources(paths, environment));
  if (release.releaseVersion !== manifest.releaseVersion) {
    warnings.push("The installed Preview release does not match this CLI entry.");
  }
  const selected = manifest.hosts.filter(
    (entry) => hostFilter === undefined || entry.host === hostFilter,
  );
  if (hostFilter !== undefined && selected.length === 0) {
    warnings.push(`Distilly is not installed for ${hostFilter}.`);
  }
  const hosts = await Promise.all(
    selected.map(async (entry) => {
      const executableOk = await executableReachable(entry.executablePath);
      const observedVersion = executableOk
        ? await probeHostVersion(
            entry.host,
            entry.executablePath,
            environment.homeDirectory,
            environment.nodePath,
            environment.pathValue,
          ).catch(() => undefined)
        : undefined;
      // A recorded unverified-version install must keep preflighting on the same floor,
      // otherwise doctor would fail for the very state setup was allowed to create.
      const binding = createBinding(
        entry.host,
        observedVersion ?? "unavailable",
        environment,
        release,
        entry.executablePath,
        entry.unverifiedHostVersion === true,
      );
      const preflight = await binding.preflight({
        sessionId: `doctor-${entry.host}`,
        environment: "cli",
      });
      const health = await binding.doctor({
        sessionId: `doctor-${entry.host}`,
        environment: "cli",
      });
      const hostWarnings = [...health.warnings];
      if (!executableOk)
        hostWarnings.push(`The ${hostExecutableName(entry.host)} executable is missing.`);
      else if (observedVersion !== entry.hostVersion)
        hostWarnings.push("The installed host version changed after Distilly setup.");
      if (!preflight.ok) hostWarnings.push(preflight.error.message);
      if (entry.unverifiedHostVersion === true) {
        hostWarnings.push(
          `No capacity fixture is recorded for ${entry.host} ${entry.hostVersion}; this install runs on the conservative floor.`,
        );
      }
      return {
        host: entry.host,
        installed: health.installed,
        executableReachable: executableOk,
        launcherReachable: health.launcherReachable,
        wireCompatible: health.wireCompatible,
        warnings: hostWarnings,
      };
    }),
  );
  const ok =
    warnings.length === 0 &&
    hosts.length > 0 &&
    hosts.every(
      (entry) =>
        entry.installed &&
        entry.executableReachable &&
        entry.launcherReachable &&
        entry.wireCompatible &&
        entry.warnings.length === 0,
    );
  return {
    ok,
    installed: manifest.hosts.length > 0,
    releaseVersion: manifest.releaseVersion,
    launcherReachable,
    hosts,
    warnings,
  };
};

/**
 * Returns one verified installed host entry for the plugin-owned MCP command.
 *
 * @param environment - Trusted local lifecycle paths and clock.
 * @param hostValue - Supported host claimed by the owned plugin command.
 * @returns The exact installed host entry.
 */
const requireInstalledPreviewHost = async (
  environment: PreviewLifecycleEnvironment,
  hostValue: HostName,
): Promise<{
  readonly entry: InstalledHost;
  readonly manifest: PreviewInstallManifest;
  readonly paths: LifecyclePaths;
}> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const manifest = await readInstallManifest(
    join(environment.homeDirectory, ".distilly", INSTALL_FILE),
  );
  if (manifest === undefined) throw fail("Distilly Developer Preview is not installed.");
  const paths = await verifyBootstrap(manifest, environment);
  const entry = manifest.hosts.find((candidate) => candidate.host === host);
  if (entry === undefined) throw fail(`Distilly is not installed for ${host}.`);
  const observedVersion = await probeHostVersion(
    entry.host,
    entry.executablePath,
    environment.homeDirectory,
    environment.nodePath,
    environment.pathValue,
  );
  if (observedVersion !== entry.hostVersion) {
    throw fail("The installed host version changed; run Distilly setup again.");
  }
  return { entry, manifest, paths };
};

/**
 * Reconstructs the verified full binding used by one installed Preview host.
 *
 * @param environment - Trusted local lifecycle paths and clock.
 * @param hostValue - Supported host claimed by the owned plugin command.
 * @returns The full binding rooted in the exact installed host and release tuple.
 */
export const requireInstalledPreviewBinding = async (
  environment: PreviewLifecycleEnvironment,
  hostValue: HostName,
): Promise<HostBinding> => {
  const { entry, paths } = await requireInstalledPreviewHost(environment, hostValue);
  const release = await readPreviewRelease(installedPluginSources(paths, environment));
  // An install that setup recorded as unverified must keep running on the same floor,
  // otherwise the recorded state could never start its own MCP server.
  return createBinding(
    entry.host,
    entry.hostVersion,
    environment,
    release,
    entry.executablePath,
    entry.unverifiedHostVersion === true,
  );
};

/**
 * Removes one exact host projection and only last-host bootstrap files.
 *
 * @param hostValue - Supported host to remove.
 * @param environment - Trusted local lifecycle paths and clock.
 * @returns Whether the host and shared launcher were removed.
 */
export const uninstallPreviewHost = async (
  hostValue: HostName,
  environment: PreviewLifecycleEnvironment,
): Promise<PreviewUninstallResult> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const installPath = join(environment.homeDirectory, ".distilly", INSTALL_FILE);
  const manifest = await readInstallManifest(installPath);
  if (manifest === undefined) return { host, removed: false, launcherRemoved: false };
  const paths = await verifyBootstrap(manifest, environment);
  const entry = manifest.hosts.find((candidate) => candidate.host === host);
  if (entry === undefined) {
    if (manifest.hosts.length === 0) {
      await removeBootstrap(paths, manifest.runtimeDigest);
      await removeIfPresent(paths.install);
      return { host, removed: false, launcherRemoved: true };
    }
    return { host, removed: false, launcherRemoved: false };
  }
  const pluginSources = installedPluginSources(paths, environment);
  const release = await readPreviewRelease(pluginSources);
  const binding = createBinding(
    host,
    entry.hostVersion,
    environment,
    release,
    entry.executablePath,
  );
  await binding.uninstallPlugin(installContext(paths, release, pluginSources, host));
  const remaining = manifest.hosts.filter((candidate) => candidate.host !== host);
  if (remaining.length > 0) {
    await writeManifest(paths.install, { ...manifest, hosts: remaining });
    return { host, removed: true, launcherRemoved: false };
  }
  await removeBootstrap(paths, manifest.runtimeDigest);
  await removeIfPresent(paths.install);
  return { host, removed: true, launcherRemoved: true };
};
