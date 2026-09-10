import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { lstat, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { BUILTIN_HOSTS, DistillyError } from "@distilly/protocol";

import { createHostFormRenderer } from "../full/form-renderer.js";
import { createHostInjector } from "../full/injector.js";
import { doctorPluginTree, installPluginTree, uninstallPluginTree } from "../full/plugin-tree.js";
import { ensureRegularDirectoryChain } from "../full/safe-directories.js";
import type {
  DshHostBindingOptions,
  HostBinding,
  HostContext,
  HostDoctorResult,
  InstallContext,
} from "../protocol.js";
import { createDshCapabilityBinding } from "./capability.js";

/** Bundles a Distilly DSH profile stacks beneath its own patch layer. */
const BASE_BUNDLES = Object.freeze(["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless"]);

const DEFAULT_PROFILE_NAME = "distilly";

/** Profile patch file DSH composes after every bundle layer. */
const PATCH_FILE = "cordis.patch.yml";

/** Platform manifest carrier that the shared installer verifies and rewrites. */
const PROFILE_MANIFEST = "package.json";

/**
 * The profile composition DSH reads: stacked bundles plus reload policy.
 *
 * It is a separate owned file because the shared installer publishes the platform
 * manifest from its own verified shape, which cannot carry DSH composition fields.
 */
const PROFILE_COMPOSITION = "distilly-profile.json";

/** Ownership manifest written by the shared plugin-tree installer. */
const OWNERSHIP_FILE = ".distilly-plugin-install.json";

/** MCP row id owned by Distilly inside the profile patch layer. */
const MCP_ROW_ID = "mcp-distilly";

/** MCP server namespace that prefixes the five model-facing tool names. */
const MCP_SERVER_NAME = "distilly";

/** Canonical Skill path relative to the installed profile and to the DSH skill root. */
const SKILL_RELATIVE = join("skills", "distilly", "SKILL.md");

const invalid = (message: string): DistillyError =>
  new DistillyError({ code: "invalid_input", message, retryable: false });

const compareUtf8 = (left: string, right: string): number => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
};

const lstatOrUndefined = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

/**
 * Returns the lowercase SHA-256 hex digest of file bytes, or undefined when unreadable.
 *
 * @param path - Absolute file path.
 * @returns Digest hex, or undefined.
 */
const fileDigest = async (path: string): Promise<string | undefined> => {
  const bytes = await readFile(path).catch(() => undefined);
  if (bytes === undefined) return undefined;
  return createHash("sha256").update(bytes).digest("hex");
};

/**
 * Builds the profile composition document that stacks the DSH bundles Distilly needs.
 *
 * @returns Deterministic profile composition bytes.
 */
const profileComposition = (): Uint8Array =>
  new TextEncoder().encode(
    `${JSON.stringify(
      {
        name: `dsh-profile-${DEFAULT_PROFILE_NAME}`,
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: [...BASE_BUNDLES], patchReload: "startup" } },
      },
      null,
      2,
    )}\n`,
  );

/**
 * Builds the profile patch layer that mounts the MCP client for one launcher.
 *
 * DSH converts an absolute entry name to a file URL inside its patch layer, so the
 * mount resolves the verified local MCP client package instead of requiring a network
 * install into the profile.
 *
 * @param launcherPath - Absolute Distilly launcher installed for this host.
 * @param mcpClientPackagePath - Absolute installed `@deepseek-ai/dsh-mcp-client` package.
 * @param host - Host name recorded in the launcher arguments.
 * @returns Deterministic patch-layer bytes.
 */
const patchLayer = (
  launcherPath: string,
  mcpClientPackagePath: string,
  host: string,
): Uint8Array => {
  const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
  return new TextEncoder().encode(
    [
      "# Distilly-owned DSH patch layer: a top-level array of loader patch entries.",
      "# Distilly inserts exactly one row, its own MCP client, and rewrites nothing else.",
      "- insert:",
      `    - id: ${MCP_ROW_ID}`,
      `      name: ${quote(mcpClientPackagePath)}`,
      "      config:",
      `        serverName: ${MCP_SERVER_NAME}`,
      "        transport: stdio",
      `        command: ${quote(launcherPath)}`,
      "        args:",
      "          - mcp",
      "          - '--host'",
      `          - ${quote(host)}`,
      "",
    ].join("\n"),
  );
};

/**
 * Reads back the single Distilly row and proves it mounts the expected launcher.
 *
 * @param patchPath - Absolute profile patch file.
 * @param launcherPath - Expected absolute launcher.
 * @returns True when exactly the expected row is mounted.
 */
const patchMountsLauncher = async (patchPath: string, launcherPath: string): Promise<boolean> => {
  const content = await readFile(patchPath, "utf8").catch(() => undefined);
  if (content === undefined) return false;
  const rowIndex = content.indexOf(`id: ${MCP_ROW_ID}`);
  if (rowIndex === -1) return false;
  const row = content.slice(rowIndex);
  const nextRow = row.indexOf("\n- ");
  const block = nextRow === -1 ? row : row.slice(0, nextRow);
  return block.includes(MCP_SERVER_NAME) && block.includes(`'${launcherPath}'`);
};

/**
 * Locates the installed `@deepseek-ai/dsh-mcp-client` package beside a DSH executable.
 *
 * Node resolves a package from the nearest `node_modules` ancestor and never from a
 * farther one, so this walks to the last `node_modules` segment and checks only that
 * root. Continuing upward would silently accept an unrelated installation and mount a
 * plugin package the DSH executable does not actually own.
 *
 * @param executablePath - Absolute DSH launcher or package entry.
 * @returns Absolute plugin package directory.
 */
const resolveMcpClientPackage = (executablePath: string): string => {
  let real: string;
  try {
    real = realpathSync(executablePath);
  } catch {
    throw invalid(`The DSH executable at ${executablePath} is not reachable.`);
  }
  const segments = real.split("/");
  const boundary = segments.lastIndexOf("node_modules");
  if (boundary === -1) {
    throw invalid("The DSH executable is not inside a node_modules tree.");
  }
  const candidate = join(
    segments.slice(0, boundary + 1).join("/"),
    "@deepseek-ai",
    "dsh-mcp-client",
  );
  const metadata = ((): ReturnType<typeof lstatSync> | undefined => {
    try {
      return lstatSync(candidate);
    } catch {
      return undefined;
    }
  })();
  if (metadata === undefined) {
    throw invalid(
      `The installed DSH tree does not expose @deepseek-ai/dsh-mcp-client at ${candidate}.`,
    );
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw invalid(`The DSH MCP client package at ${candidate} is not a regular directory.`);
  }
  return candidate;
};

/**
 * Reads the launcher recorded by the shared installer's ownership manifest.
 *
 * DSH mounts its server through the profile patch row rather than a JSON server map,
 * so the launcher is read from the manifest Distilly verified, not from a host file.
 *
 * @param profileRoot - Installed profile directory.
 * @returns Recorded absolute launcher path, or undefined.
 */
const ownedLauncher = async (profileRoot: string): Promise<string | undefined> => {
  const content = await readFile(join(profileRoot, OWNERSHIP_FILE), "utf8").catch(() => undefined);
  if (content === undefined) return undefined;
  try {
    const parsed = JSON.parse(content) as { readonly launcherPath?: unknown };
    const launcher = parsed.launcherPath;
    return typeof launcher === "string" && isAbsolute(launcher) ? launcher : undefined;
  } catch {
    return undefined;
  }
};

const validateOptions = (options: DshHostBindingOptions): void => {
  if (!isAbsolute(options.homeDirectory)) {
    throw new TypeError("DSH full binding homeDirectory must be absolute.");
  }
  if (!isAbsolute(options.executablePath)) {
    throw new TypeError("DSH full binding executablePath must be absolute.");
  }
  for (const [name, value] of [
    ["profilesRoot", options.profilesRoot],
    ["mcpClientPackagePath", options.mcpClientPackagePath],
  ] as const) {
    if (value !== undefined && !isAbsolute(value)) {
      throw new TypeError(`DSH full binding ${name} must be absolute when provided.`);
    }
  }
  if (typeof options.forms?.ask !== "function") {
    throw new TypeError("DSH full binding requires a trusted form presenter.");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("DSH full binding now must be a function when provided.");
  }
  if (options.commandRunner !== undefined && typeof options.commandRunner.run !== "function") {
    throw new TypeError("DSH full binding commandRunner must provide run.");
  }
};

/**
 * Creates the DeepSeek Harness binding.
 *
 * DSH boots one profile composed from bundle layers plus a user patch layer. Distilly
 * owns a dedicated profile directory and inserts exactly one row — its own MCP client,
 * mounted by absolute launcher path — so no shared profile and no user-authored row is
 * rewritten. The canonical Skill is mirrored into both the installed profile tree and
 * the DSH user skill root that DSH already scans, so one set of bytes serves the
 * five-tool path and host-native skill discovery.
 *
 * @param options - Trusted release, host executable, home, profile root, forms, and clock.
 * @returns A full DSH binding with profile and person-profile lifecycle.
 */
export const createDshHostBinding = (options: DshHostBindingOptions): HostBinding => {
  validateOptions(options);
  const capability = createDshCapabilityBinding({
    provider: options.provider,
    release: options.release,
  });
  const host = BUILTIN_HOSTS.dsh;
  const homeDirectory = resolve(options.homeDirectory);
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  const profilesRoot = resolve(options.profilesRoot ?? join(homeDirectory, "profiles"));
  const profileRoot = join(profilesRoot, profileName);
  const patchPath = join(profileRoot, PATCH_FILE);
  const userSkillRoot = join(homeDirectory, "skills", "distilly");
  const userSkillPath = join(homeDirectory, SKILL_RELATIVE);
  const now = options.now ?? (() => new Date());
  const clientPackage =
    options.mcpClientPackagePath ?? resolveMcpClientPackage(options.executablePath);

  return Object.freeze({
    kind: "full" as const,
    host,
    preflight: (context: HostContext) => capability.preflight(context),
    createInjector: () => createHostInjector(host, homeDirectory, now),
    createFormRenderer: (context: HostContext) =>
      createHostFormRenderer(host, context, options.forms),
    installPlugin: async (context: InstallContext) => {
      const result = await installPluginTree(
        context,
        options.release.releaseVersion,
        {
          host,
          trustedRoot: homeDirectory,
          pluginRoot: profileRoot,
          transactionRoot: join(homeDirectory, ".distilly", "host-install"),
          platformManifestPath: PROFILE_MANIFEST,
          expectedSkillDigest: options.release.canonicalSkillDigest,
          mcpShape: () => ({}),
          preservePlatformManifestFields: true,
          extraOwnedFiles: (launcherPath) =>
            new Map([
              [PATCH_FILE, patchLayer(launcherPath, clientPackage, host)],
              [PROFILE_COMPOSITION, profileComposition()],
            ]),
        },
        async () => {
          const canonical = await readFile(join(profileRoot, SKILL_RELATIVE)).catch(
            () => undefined,
          );
          if (canonical === undefined) {
            throw invalid("The canonical Distilly Skill is missing from the installed profile.");
          }
          await ensureRegularDirectoryChain(userSkillRoot, true, homeDirectory);
          await writeFile(userSkillPath, canonical, { mode: 0o644 });
        },
      );
      return {
        ...result,
        installedPaths: [
          ...result.installedPaths,
          patchPath,
          join(profileRoot, PROFILE_COMPOSITION),
          userSkillPath,
        ].sort(compareUtf8),
      };
    },
    uninstallPlugin: async () => {
      await uninstallPluginTree(profileRoot, host, homeDirectory);
      const owned = await lstatOrUndefined(userSkillRoot);
      if (owned !== undefined && owned.isDirectory() && !owned.isSymbolicLink()) {
        await rm(userSkillRoot, { recursive: true, force: true });
      }
    },
    doctor: async (): Promise<HostDoctorResult> => {
      const home = await lstatOrUndefined(homeDirectory);
      if (home !== undefined) {
        try {
          await ensureRegularDirectoryChain(homeDirectory, false, homeDirectory);
        } catch {
          return {
            host,
            installed: true,
            launcherReachable: false,
            wireCompatible: false,
            warnings: ["The DSH home is not a safe regular path."],
            remediation: `Preserve local changes, then re-run distilly setup --host ${host}.`,
          };
        }
      }
      const health = await doctorPluginTree(profileRoot, host, options.release.releaseVersion);
      if (!health.installed) return health;
      const warnings = [...health.warnings];
      const launcherPath = await ownedLauncher(profileRoot);
      if (launcherPath === undefined) {
        warnings.push("The installed DSH profile ownership manifest records no launcher.");
      } else if (!(await patchMountsLauncher(patchPath, launcherPath))) {
        warnings.push("The DSH profile patch layer does not mount the Distilly launcher.");
      }
      const [profileDigest, userDigest] = await Promise.all([
        fileDigest(join(profileRoot, SKILL_RELATIVE)),
        fileDigest(userSkillPath),
      ]);
      if (profileDigest === undefined || profileDigest !== userDigest) {
        warnings.push("The DSH user Skill does not match the canonical installed Skill bytes.");
      }
      return warnings.length === 0
        ? { ...health, wireCompatible: health.wireCompatible }
        : {
            ...health,
            wireCompatible: false,
            warnings,
            remediation: `Re-run distilly setup --host ${host}.`,
          };
    },
  });
};
