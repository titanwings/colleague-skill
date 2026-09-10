import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  DistillyError,
  contentDigestSchema,
  hostNameSchema,
  type HostName,
} from "@distilly/protocol";

import type { HostDoctorResult, InstallContext, PluginInstallResult } from "../protocol.js";
import { ensureRegularDirectoryChain } from "./safe-directories.js";

const OWNERSHIP_FILE = ".distilly-plugin-install.json";
const TEMPLATE_FILE = ".mcp.json.template";
const INSTALLED_MCP_FILE = ".mcp.json";

interface OwnedFile {
  readonly path: string;
  readonly contentDigest: `sha256_${string}`;
}

interface PluginOwnershipManifest {
  readonly schemaVersion: 1;
  readonly host: HostName;
  readonly runtimeVersion: string;
  readonly launcherPath: string;
  readonly files: readonly OwnedFile[];
}

interface PreparedPlugin {
  readonly files: ReadonlyMap<string, Uint8Array>;
}

type PluginActivation = () => Promise<void>;

/** Host-specific paths and MCP rendering for a verified plugin tree. */
export interface PluginTreeOptions {
  readonly host: HostName;
  readonly trustedRoot: string;
  readonly pluginRoot: string;
  readonly transactionRoot: string;
  readonly platformManifestPath: string;
  readonly expectedSkillDigest: `sha256_${string}`;
  readonly mcpShape: (launcherPath: string) => unknown;
  /**
   * Host-specific files the binding owns inside the plugin root, keyed by a root-relative
   * POSIX path. They are written into the staging tree and recorded in the ownership
   * manifest, so ownership verification still rejects unlisted files. A host that mounts
   * its server through a patch or config document instead of `INSTALLED_MCP_FILE` uses
   * this to publish that document without escaping ownership.
   */
  readonly extraOwnedFiles?: (launcherPath: string) => ReadonlyMap<string, Uint8Array>;
  /**
   * Preserve the source platform manifest's own fields when publishing the installed
   * manifest, adding only the recorded server pointer. A host whose manifest carries
   * real configuration (a profile, a bundle list) needs this; the default rewrites the
   * manifest into the minimal name/version/pointer carrier.
   */
  readonly preservePlatformManifestFields?: boolean;
}

const fail = (message: string, fieldPath?: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message,
    retryable: false,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });

const corrupt = (message: string): DistillyError =>
  new DistillyError({
    code: "storage_corrupt",
    message,
    retryable: false,
    remediation: "Re-run Distilly setup after preserving any locally modified plugin files.",
  });

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

const sha256 = (bytes: Uint8Array | string): `sha256_${string}` =>
  contentDigestSchema.parse(`sha256_${createHash("sha256").update(bytes).digest("hex")}`);

const prettyJson = (value: unknown): Uint8Array =>
  Buffer.from(`${JSON.stringify(value, undefined, 2)}\n`, "utf8");

const isInside = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
};

const safeRelativePath = (value: string): string => {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw corrupt("The installed plugin ownership manifest contains an unsafe path.");
  }
  return value;
};

const walkRegularFiles = async (
  root: string,
  current = root,
): Promise<ReadonlyMap<string, Uint8Array>> => {
  const result = new Map<string, Uint8Array>();
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => compareUtf8(left.name, right.name));
  for (const entry of entries) {
    const path = join(current, entry.name);
    const relativePath = relative(root, path).split(sep).join("/");
    if (entry.isSymbolicLink()) throw fail("Plugin source may not contain symbolic links.");
    if (entry.isDirectory()) {
      for (const [nestedPath, bytes] of await walkRegularFiles(root, path)) {
        result.set(nestedPath, bytes);
      }
      continue;
    }
    if (!entry.isFile()) throw fail("Plugin source may contain only regular files.");
    result.set(safeRelativePath(relativePath), Uint8Array.from(await readFile(path)));
  }
  return result;
};

const skillTreeDigest = (files: ReadonlyMap<string, Uint8Array>): `sha256_${string}` => {
  const skillPrefix = "skills/distilly/";
  const records = [...files.entries()]
    .filter(([path]) => path.startsWith(skillPrefix))
    .map(([path, bytes]) => ({
      path: path.slice(skillPrefix.length),
      contentDigest: sha256(bytes),
    }))
    .sort((left, right) => compareUtf8(left.path, right.path));
  return sha256(`canonical-skill-tree-v1\0${canonicalJson(records)}`);
};

const parseJsonObject = (bytes: Uint8Array, label: string): Record<string, unknown> => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw fail(`${label} must be valid UTF-8 JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail(`${label} must contain a JSON object.`);
  }
  return value as Record<string, unknown>;
};

const validateInstallContext = (context: InstallContext, expectedVersion: string): void => {
  if (!isAbsolute(context.launcherPath)) {
    throw fail("The Distilly launcher path must be absolute.", "launcherPath");
  }
  if (!isAbsolute(context.pluginSourcePath)) {
    throw fail("The plugin source path must be absolute.", "pluginSourcePath");
  }
  if (context.runtimeVersion !== expectedVersion) {
    throw fail("The plugin and runtime versions must match exactly.", "runtimeVersion");
  }
};

const preparePlugin = async (
  context: InstallContext,
  options: PluginTreeOptions,
): Promise<PreparedPlugin> => {
  const sourceMetadata = await lstat(context.pluginSourcePath).catch(() => undefined);
  if (
    sourceMetadata === undefined ||
    !sourceMetadata.isDirectory() ||
    sourceMetadata.isSymbolicLink()
  ) {
    throw fail("The plugin source must be a regular directory.", "pluginSourcePath");
  }
  const sourceFiles = await walkRegularFiles(context.pluginSourcePath);
  if (skillTreeDigest(sourceFiles) !== options.expectedSkillDigest) {
    throw fail("The plugin source canonical skill digest does not match this release.");
  }

  const platformManifestBytes = sourceFiles.get(options.platformManifestPath);
  if (platformManifestBytes === undefined) {
    throw fail("The plugin source is missing its platform manifest.");
  }
  const platformManifest = parseJsonObject(platformManifestBytes, "Plugin platform manifest");
  if (platformManifest.name !== "distilly" || platformManifest.version !== context.runtimeVersion) {
    throw fail("The plugin platform manifest does not match the active release.");
  }

  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of sourceFiles) {
    if (path === TEMPLATE_FILE || path === INSTALLED_MCP_FILE || path === OWNERSHIP_FILE) continue;
    files.set(path, bytes);
  }
  files.set(
    options.platformManifestPath,
    options.preservePlatformManifestFields === true
      ? prettyJson({ ...platformManifest, mcpServers: `./${INSTALLED_MCP_FILE}` })
      : prettyJson({
          ...platformManifest,
          version: context.runtimeVersion,
          mcpServers: `./${INSTALLED_MCP_FILE}`,
        }),
  );
  files.set(INSTALLED_MCP_FILE, prettyJson(options.mcpShape(context.launcherPath)));
  for (const [path, bytes] of options.extraOwnedFiles?.(context.launcherPath) ?? []) {
    files.set(safeRelativePath(path), bytes);
  }

  const ownership: PluginOwnershipManifest = {
    schemaVersion: 1,
    host: options.host,
    runtimeVersion: context.runtimeVersion,
    launcherPath: context.launcherPath,
    files: [...files.entries()]
      .map(([path, bytes]) => ({ path, contentDigest: sha256(bytes) }))
      .sort((left, right) => compareUtf8(left.path, right.path)),
  };
  files.set(OWNERSHIP_FILE, Buffer.from(`${canonicalJson(ownership)}\n`, "utf8"));
  return { files };
};

/**
 * Verifies an existing owned plugin tree without mutating it.
 *
 * @param pluginRoot - Exact host plugin directory.
 * @param expectedHost - Host that must own the manifest.
 * @returns Whether a Distilly ownership manifest exists.
 */
export const verifyPluginTree = async (
  pluginRoot: string,
  expectedHost: HostName,
): Promise<boolean> => (await readVerifiedPluginTree(pluginRoot, expectedHost)) !== undefined;

const parseOwnership = (bytes: Uint8Array): PluginOwnershipManifest => {
  const value = parseJsonObject(bytes, "Plugin ownership manifest");
  if (
    value.schemaVersion !== 1 ||
    !hostNameSchema.safeParse(value.host).success ||
    typeof value.runtimeVersion !== "string" ||
    typeof value.launcherPath !== "string" ||
    !isAbsolute(value.launcherPath) ||
    !Array.isArray(value.files)
  ) {
    throw corrupt("The installed plugin ownership manifest is invalid.");
  }
  const files: OwnedFile[] = value.files.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof (entry as Record<string, unknown>).path !== "string" ||
      !contentDigestSchema.safeParse((entry as Record<string, unknown>).contentDigest).success
    ) {
      throw corrupt("The installed plugin ownership manifest is invalid.");
    }
    return {
      path: safeRelativePath((entry as { path: string }).path),
      contentDigest: (entry as { contentDigest: `sha256_${string}` }).contentDigest,
    };
  });
  const unique = new Set(files.map((file) => file.path));
  if (unique.size !== files.length || unique.has(OWNERSHIP_FILE)) {
    throw corrupt("The installed plugin ownership manifest contains duplicate paths.");
  }
  return {
    schemaVersion: 1,
    host: value.host as HostName,
    runtimeVersion: value.runtimeVersion,
    launcherPath: value.launcherPath,
    files,
  };
};

const readOwnership = async (pluginRoot: string): Promise<PluginOwnershipManifest> =>
  parseOwnership(Uint8Array.from(await readFile(join(pluginRoot, OWNERSHIP_FILE))));

const verifyOwnedFiles = async (
  pluginRoot: string,
  ownership: PluginOwnershipManifest,
): Promise<void> => {
  for (const file of ownership.files) {
    const path = resolve(pluginRoot, file.path);
    if (!isInside(pluginRoot, path)) throw corrupt("An owned plugin path escapes its root.");
    let bytes: Uint8Array;
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("not regular");
      bytes = Uint8Array.from(await readFile(path));
    } catch {
      throw corrupt("An installed plugin file is missing or no longer regular.");
    }
    if (sha256(bytes) !== file.contentDigest) {
      throw corrupt("An installed plugin file was modified outside Distilly.");
    }
  }
};

const readVerifiedPluginTree = async (
  pluginRoot: string,
  expectedHost: HostName,
): Promise<PluginOwnershipManifest | undefined> => {
  const metadata = await lstat(pluginRoot).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (metadata === undefined) return undefined;
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw corrupt("The installed plugin root is no longer a regular directory.");
  }
  const ownership = await readOwnership(pluginRoot).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (ownership === undefined) return undefined;
  if (ownership.host !== expectedHost) {
    throw corrupt("The installed plugin belongs to another host.");
  }
  await verifyOwnedFiles(pluginRoot, ownership);
  const actualFiles = await walkRegularFiles(pluginRoot);
  const expectedFiles = new Set([OWNERSHIP_FILE, ...ownership.files.map((file) => file.path)]);
  if (
    actualFiles.size !== expectedFiles.size ||
    [...actualFiles.keys()].some((path) => !expectedFiles.has(path))
  ) {
    throw corrupt("The installed plugin contains files not owned by Distilly.");
  }
  return ownership;
};

const removeEmptyParents = async (pluginRoot: string, paths: readonly string[]): Promise<void> => {
  const directories = new Set<string>();
  for (const path of paths) {
    let directory = dirname(resolve(pluginRoot, path));
    while (isInside(pluginRoot, directory)) {
      directories.add(directory);
      if (directory === pluginRoot) break;
      directory = dirname(directory);
    }
  }
  for (const directory of [...directories].sort((left, right) => right.length - left.length)) {
    await rmdir(directory).catch((error: unknown) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "ENOENT") throw error;
    });
  }
};

/**
 * Verifies and removes only files named by the Distilly ownership manifest.
 *
 * @param pluginRoot - Exact host plugin directory.
 * @param expectedHost - Host that must own the manifest.
 * @param trustedRoot - User root under which the host path must remain.
 * @returns Completion after owned files are removed.
 */
export const uninstallPluginTree = async (
  pluginRoot: string,
  expectedHost: HostName,
  trustedRoot: string,
): Promise<void> => {
  const ownership = await readVerifiedPluginTree(pluginRoot, expectedHost);
  if (ownership === undefined) return;
  try {
    await ensureRegularDirectoryChain(dirname(pluginRoot), false, trustedRoot);
  } catch {
    throw corrupt("The host plugin parent directory is no longer safe.");
  }
  // Move the verified tree out of the discovery path before deleting it. A
  // failed unlink must never leave a half-installed bundle that can be
  // discovered with a missing manifest or MCP file.
  const backup = join(dirname(pluginRoot), `.distilly-plugin-remove-${randomUUID()}`);
  await rename(pluginRoot, backup);
  try {
    await rm(backup, { recursive: true, force: false });
  } catch {
    const restored = await rename(backup, pluginRoot)
      .then(() => true)
      .catch(() => false);
    throw corrupt(
      restored
        ? "The host plugin could not be removed atomically; its prior path was restored for review."
        : `The host plugin could not be removed atomically; preserve the recovery tree at ${backup}.`,
    );
  }
  await removeEmptyParents(
    pluginRoot,
    ownership.files.map((file) => file.path),
  );
};

/**
 * Materializes one verified release tree without shipping the launcher sentinel.
 *
 * @param context - Trusted source, launcher, and exact runtime version.
 * @param expectedVersion - Full binding's active release version.
 * @param options - Host-specific destination and MCP shape.
 * @param activate - Optional host registration completed before the old tree is released.
 * @returns Exact installed paths and restart requirement.
 */
export const installPluginTree = async (
  context: InstallContext,
  expectedVersion: string,
  options: PluginTreeOptions,
  activate?: PluginActivation,
): Promise<PluginInstallResult> => {
  validateInstallContext(context, expectedVersion);
  if (
    !isAbsolute(options.trustedRoot) ||
    !isAbsolute(options.pluginRoot) ||
    !isAbsolute(options.transactionRoot)
  ) {
    throw new TypeError("Trusted, plugin, and transaction roots must be absolute.");
  }
  const prepared = await preparePlugin(context, options);
  try {
    await ensureRegularDirectoryChain(dirname(options.pluginRoot), true, options.trustedRoot);
    await ensureRegularDirectoryChain(options.transactionRoot, true, options.trustedRoot);
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw fail("The host plugin or transaction directory is not a safe regular path.");
  }
  const transactionId = randomUUID();
  const staging = join(options.transactionRoot, `${options.host}-${transactionId}-staging`);
  const backup = join(options.transactionRoot, `${options.host}-${transactionId}-backup`);
  let installed = false;
  let backedUp = false;
  try {
    await mkdir(staging, { recursive: false });
    for (const [path, bytes] of prepared.files) {
      const destination = resolve(staging, path);
      if (!isInside(staging, destination)) throw fail("An installed plugin path escaped staging.");
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { mode: path === OWNERSHIP_FILE ? 0o600 : 0o644 });
    }
    const existingMetadata = await lstat(options.pluginRoot).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    const existingOwnership = await readVerifiedPluginTree(options.pluginRoot, options.host);
    if (existingMetadata !== undefined && existingOwnership === undefined) {
      throw fail("The host plugin destination is not owned by Distilly.");
    }
    if (existingOwnership !== undefined) {
      await rename(options.pluginRoot, backup);
      backedUp = true;
    }
    await rename(staging, options.pluginRoot);
    installed = true;
    await activate?.();
    if (backedUp) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (installed) await rm(options.pluginRoot, { recursive: true, force: true });
    if (backedUp) await rename(backup, options.pluginRoot);
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return {
    host: options.host,
    manifestPath: join(options.pluginRoot, options.platformManifestPath),
    installedPaths: [
      options.pluginRoot,
      join(options.pluginRoot, INSTALLED_MCP_FILE),
      join(options.pluginRoot, OWNERSHIP_FILE),
    ],
    restartRequired: true,
  };
};

const launcherReachable = async (path: string): Promise<boolean> => {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return false;
    if (process.platform !== "win32") await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads the narrow on-disk health required by Preview setup and uninstall.
 *
 * @param pluginRoot - Exact host plugin directory.
 * @param host - Host that should own the install.
 * @param expectedVersion - Full binding's active release version.
 * @returns Sanitized on-disk health report.
 */
export const doctorPluginTree = async (
  pluginRoot: string,
  host: HostName,
  expectedVersion: string,
): Promise<HostDoctorResult> => {
  let ownership: PluginOwnershipManifest | undefined;
  try {
    ownership = await readVerifiedPluginTree(pluginRoot, host);
    if (ownership === undefined) {
      const root = await lstat(pluginRoot).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      });
      if (root !== undefined)
        throw corrupt("The host plugin destination is not owned by Distilly.");
      return {
        host,
        installed: false,
        launcherReachable: false,
        wireCompatible: false,
        warnings: ["Distilly is not installed for this host."],
        remediation: `Run distilly setup --host ${host}.`,
      };
    }
  } catch {
    return {
      host,
      installed: true,
      launcherReachable: false,
      wireCompatible: false,
      warnings: ["The Distilly host installation manifest is invalid."],
      remediation: `Preserve local changes, then re-run distilly setup --host ${host}.`,
    };
  }

  const warnings: string[] = [];
  const reachable = await launcherReachable(ownership.launcherPath);
  if (!reachable) warnings.push("The installed Distilly launcher is not executable.");
  const compatible = ownership.host === host && ownership.runtimeVersion === expectedVersion;
  if (!compatible) warnings.push("The installed Distilly plugin version is incompatible.");
  return {
    host,
    installed: true,
    launcherReachable: reachable,
    wireCompatible: compatible,
    warnings,
    ...(warnings.length === 0 ? {} : { remediation: `Re-run distilly setup --host ${host}.` }),
  };
};
