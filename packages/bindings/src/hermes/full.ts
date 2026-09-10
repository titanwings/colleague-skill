import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  BUILTIN_HOSTS,
  contentDigestSchema,
  DistillyError,
  type ContentDigest,
} from "@distilly/protocol";

import { createHostFormRenderer } from "../full/form-renderer.js";
import { createHostInjector } from "../full/injector.js";
import { defaultHostCommandRunner } from "../full/command-runner.js";
import { ensureRegularDirectoryChain } from "../full/safe-directories.js";
import type {
  HermesHostBindingOptions,
  HostBinding,
  HostContext,
  HostDoctorResult,
  HostCommandRunner,
  InstallContext,
} from "../protocol.js";
import { createHermesCapabilityBinding } from "./capability.js";

const SKILL_MANIFEST = ".distilly-install.json";
const HOST = BUILTIN_HOSTS.hermes;

interface OwnedFile {
  readonly path: string;
  readonly contentDigest: ContentDigest;
}

interface HermesInstallManifest {
  readonly schemaVersion: 1;
  readonly host: typeof HOST;
  readonly runtimeVersion: string;
  readonly launcherPath: string;
  readonly wrapperPath: string;
  readonly wrapperDigest: ContentDigest;
  readonly skillDigest: ContentDigest;
  /** True only when Distilly created the Hermes MCP entry during setup. */
  readonly configOwned: boolean;
  readonly files: readonly OwnedFile[];
}

interface HermesMcpEntry {
  readonly command: string;
  readonly args: readonly string[];
  readonly enabled: boolean;
  readonly resources: boolean;
  readonly prompts: boolean;
}

const invalid = (message: string): DistillyError =>
  new DistillyError({ code: "invalid_input", message, retryable: false });

const corrupt = (message: string): DistillyError =>
  new DistillyError({
    code: "storage_corrupt",
    message,
    retryable: false,
    remediation: "Preserve the modified Hermes files, then restore the owned entry manually.",
  });

const commandFailed = (action: "configure" | "remove" | "verify"): DistillyError =>
  new DistillyError({
    code: action === "verify" ? "host_unsupported" : "internal_error",
    message: `Hermes could not ${action} the Distilly MCP integration.`,
    retryable: false,
  });

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const digest = (bytes: Uint8Array | string): ContentDigest =>
  contentDigestSchema.parse(`sha256_${createHash("sha256").update(bytes).digest("hex")}`);

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

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...keys].sort(compareUtf8);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const lstatOrUndefined = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const inside = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
};

const safeRelative = (value: string): string => {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw corrupt("The Hermes Skill ownership manifest contains an unsafe path.");
  }
  return value;
};

const walkFiles = async (
  root: string,
  current = root,
): Promise<ReadonlyMap<string, Uint8Array>> => {
  const result = new Map<string, Uint8Array>();
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => compareUtf8(left.name, right.name));
  for (const entry of entries) {
    const path = join(current, entry.name);
    const relativePath = relative(root, path).split(sep).join("/");
    if (entry.isSymbolicLink()) throw invalid("Hermes Skill sources may not contain symlinks.");
    if (entry.isDirectory()) {
      for (const [nested, bytes] of await walkFiles(root, path)) result.set(nested, bytes);
      continue;
    }
    if (!entry.isFile()) throw invalid("Hermes Skill sources may contain only regular files.");
    result.set(safeRelative(relativePath), Uint8Array.from(await readFile(path)));
  }
  return result;
};

const skillTreeDigest = (files: ReadonlyMap<string, Uint8Array>): ContentDigest => {
  const records = [...files.entries()]
    .filter(([path]) => path !== SKILL_MANIFEST)
    .map(([path, bytes]) => ({ path, contentDigest: digest(bytes) }))
    .sort((left, right) => compareUtf8(left.path, right.path));
  return digest(`canonical-skill-tree-v1\0${canonicalJson(records)}`);
};

const readJsonObject = (bytes: Uint8Array, label: string): Record<string, unknown> => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw corrupt(`${label} is not valid JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
};

const parseOwnership = (bytes: Uint8Array): HermesInstallManifest => {
  const value = readJsonObject(bytes, "The Hermes Skill ownership manifest");
  const filesValue = value.files;
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "host",
      "runtimeVersion",
      "launcherPath",
      "wrapperPath",
      "wrapperDigest",
      "skillDigest",
      "configOwned",
      "files",
    ]) ||
    value.schemaVersion !== 1 ||
    value.host !== HOST ||
    typeof value.runtimeVersion !== "string" ||
    typeof value.launcherPath !== "string" ||
    !isAbsolute(value.launcherPath) ||
    typeof value.wrapperPath !== "string" ||
    !isAbsolute(value.wrapperPath) ||
    !contentDigestSchema.safeParse(value.wrapperDigest).success ||
    !contentDigestSchema.safeParse(value.skillDigest).success ||
    typeof value.configOwned !== "boolean" ||
    !Array.isArray(filesValue)
  ) {
    throw corrupt("The Hermes Skill ownership manifest is invalid.");
  }
  const files = filesValue.map((entry): OwnedFile => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw corrupt("The Hermes Skill ownership manifest is invalid.");
    }
    const record = entry as Record<string, unknown>;
    const contentDigest = contentDigestSchema.safeParse(record.contentDigest);
    if (
      !hasExactKeys(record, ["path", "contentDigest"]) ||
      typeof record.path !== "string" ||
      !contentDigest.success
    ) {
      throw corrupt("The Hermes Skill ownership manifest is invalid.");
    }
    return { path: safeRelative(record.path), contentDigest: contentDigest.data };
  });
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    throw corrupt("The Hermes Skill ownership manifest contains duplicate files.");
  }
  return {
    schemaVersion: 1,
    host: HOST,
    runtimeVersion: value.runtimeVersion,
    launcherPath: value.launcherPath,
    wrapperPath: value.wrapperPath,
    wrapperDigest: value.wrapperDigest as ContentDigest,
    skillDigest: value.skillDigest as ContentDigest,
    configOwned: value.configOwned,
    files,
  };
};

const readRegular = async (path: string): Promise<Uint8Array> => {
  const metadata = await lstatOrUndefined(path);
  if (metadata === undefined || !metadata.isFile() || metadata.isSymbolicLink()) {
    throw corrupt(`Expected a regular Hermes file at ${path}.`);
  }
  return Uint8Array.from(await readFile(path));
};

const readVerifiedInstall = async (
  skillRoot: string,
  wrapperPath: string,
  runtimeVersion: string,
  launcherPath?: string,
): Promise<HermesInstallManifest> => {
  const rootMetadata = await lstatOrUndefined(skillRoot);
  if (rootMetadata === undefined || !rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw corrupt("The Hermes Skill destination is not a regular directory.");
  }
  const manifest = parseOwnership(await readRegular(join(skillRoot, SKILL_MANIFEST)));
  if (
    manifest.host !== HOST ||
    manifest.runtimeVersion !== runtimeVersion ||
    (launcherPath !== undefined && manifest.launcherPath !== launcherPath) ||
    manifest.wrapperPath !== wrapperPath
  ) {
    throw corrupt("The Hermes Skill ownership manifest does not match this runtime.");
  }
  const actual = await walkFiles(skillRoot);
  const expected = new Set([SKILL_MANIFEST, ...manifest.files.map((file) => file.path)]);
  if (actual.size !== expected.size || [...actual.keys()].some((path) => !expected.has(path))) {
    throw corrupt("The Hermes Skill contains files not owned by Distilly.");
  }
  for (const file of manifest.files) {
    const path = resolve(skillRoot, file.path);
    if (!inside(skillRoot, path) || digest(actual.get(file.path)!) !== file.contentDigest) {
      throw corrupt("The Hermes Skill contains a modified file.");
    }
  }
  const treeDigest = skillTreeDigest(actual);
  if (treeDigest !== manifest.skillDigest) throw corrupt("The Hermes Skill digest is invalid.");
  const wrapper = await readRegular(wrapperPath);
  if (digest(wrapper) !== manifest.wrapperDigest)
    throw corrupt("The Hermes launcher wrapper changed.");
  return manifest;
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", `"'"'`)}'`;

const wrapperBytes = (launcherPath: string): Uint8Array =>
  Buffer.from(`#!/bin/sh\nexec ${shellQuote(launcherPath)} mcp --host hermes "$@"\n`, "utf8");

const hermesHome = (homeDirectory: string): string => join(homeDirectory, ".hermes");
const configPath = (homeDirectory: string): string =>
  join(hermesHome(homeDirectory), "config.yaml");
const wrapperPath = (homeDirectory: string): string =>
  join(homeDirectory, ".distilly", "bin", "distilly-hermes");

const hostEnvironment = (homeDirectory: string): Readonly<Record<string, string>> => ({
  HERMES_HOME: hermesHome(homeDirectory),
});

const ensureHermesHome = async (homeDirectory: string): Promise<void> => {
  try {
    await ensureRegularDirectoryChain(hermesHome(homeDirectory), true, homeDirectory);
  } catch {
    throw invalid("The Hermes state directory is not a safe regular path.");
  }
};

const runHost = async (
  options: HermesHostBindingOptions,
  homeDirectory: string,
  args: readonly string[],
  input?: string,
): Promise<ReturnType<HostCommandRunner["run"]>> =>
  (options.commandRunner ?? defaultHostCommandRunner).run({
    executablePath: options.executablePath,
    args,
    homeDirectory,
    environment: hostEnvironment(homeDirectory),
    ...(input === undefined ? {} : { input }),
  });

const parseScalar = (value: string): string | boolean | undefined => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === "string" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    trimmed.includes("\0") ||
    /\s+#/u.test(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
};

const isBlankOrComment = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith("#");
};

/**
 * Parses the exact MCP shape emitted by Hermes' config commands.
 *
 * Unknown keys, inline collections, aliases, and nested values are treated as
 * untrusted so an uninstall can never remove a user's augmented entry.
 *
 * @param homeDirectory - Isolated user home containing Hermes config.
 * @returns The owned entry, undefined when absent, or null when its shape is
 *   not the exact supported subset.
 */
const readHermesMcpEntry = async (
  homeDirectory: string,
): Promise<HermesMcpEntry | undefined | null> => {
  const metadata = await lstatOrUndefined(configPath(homeDirectory));
  if (metadata === undefined) return undefined;
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw corrupt("Hermes config.yaml is not a regular file.");
  }
  const lines = (await readFile(configPath(homeDirectory), "utf8")).split(/\r?\n/u);
  const rootIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^mcp_servers:(?:\s*)(.*)$/u.test(line));
  if (rootIndexes.length === 0) return undefined;
  if (rootIndexes.length !== 1 || !/^mcp_servers:\s*$/u.test(rootIndexes[0]!.line)) {
    return null;
  }
  const rootIndex = rootIndexes[0]!.index;
  let entryStart = -1;
  let entryEnd = lines.length;
  for (let index = rootIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (isBlankOrComment(line)) continue;
    if (/^\S/u.test(line)) {
      entryEnd = index;
      break;
    }
    if (/^ {2}distilly:\s*$/u.test(line)) {
      if (entryStart >= 0) return null;
      entryStart = index;
      continue;
    }
    if (entryStart >= 0 && /^ {2}\S/u.test(line)) {
      entryEnd = index;
      break;
    }
  }
  if (entryStart < 0) return undefined;

  let command: string | undefined;
  let enabled: boolean | undefined;
  let resources: boolean | undefined;
  let prompts: boolean | undefined;
  const args: string[] = [];
  const seen = new Set<string>();
  let section: "args" | "tools" | undefined;
  let continuingCommand = false;
  for (const line of lines.slice(entryStart + 1, entryEnd)) {
    if (isBlankOrComment(line)) continue;
    // Hermes' YAML writer emits an unquoted command as a folded plain scalar
    // when the absolute path contains spaces. Reconstruct only that exact
    // command continuation; any resulting value is still compared byte-for-
    // byte with Distilly's wrapper path below.
    if (continuingCommand && /^ {6}\S/u.test(line)) {
      const continuation = line.trim();
      if (
        continuation.length === 0 ||
        continuation.startsWith("-") ||
        continuation.includes("\0") ||
        continuation.includes("\n")
      ) {
        return null;
      }
      command = `${command!} ${continuation}`;
      continue;
    }
    const top = /^ {4}([a-z][a-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
    if (top !== null) {
      const key = top[1]!;
      const value = top[2] ?? "";
      if (seen.has(key)) return null;
      seen.add(key);
      section = undefined;
      continuingCommand = false;
      if (key === "command") {
        const parsed = parseScalar(value);
        if (typeof parsed !== "string") return null;
        command = parsed;
        continuingCommand = true;
      } else if (key === "enabled") {
        const parsed = parseScalar(value);
        if (typeof parsed !== "boolean") return null;
        enabled = parsed;
      } else if (key === "args") {
        if (value.length > 0 && value !== "[]") return null;
        section = "args";
      } else if (key === "tools") {
        if (value.length > 0 && value !== "{}") return null;
        section = "tools";
      } else if (HOST_OWNED_ENTRY_KEYS.has(key)) {
        // Hermes writes its own scalar keys into the entry it owns, such as the
        // `connect_timeout` added in v0.19.0. Distilly never writes them, never reads
        // them, and never removes them: the entry is still recognized as managed only
        // because its command matches the owned wrapper byte for byte, and uninstall
        // compares the whole snapshot it recorded. Rejecting the entry outright made
        // every newer host version unconfigurable.
        if (value.length === 0) return null;
      } else {
        return null;
      }
      continue;
    }
    if (section === "args") {
      // Distilly's wrapper intentionally has no arguments. Reject every list
      // item, including inline/empty forms, instead of guessing its meaning.
      return null;
    }
    const tool = /^ {6}([a-z][a-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
    if (section === "tools" && tool !== null) {
      const key = `tools.${tool[1]!}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const parsed = parseScalar(tool[2] ?? "");
      if (typeof parsed !== "boolean") return null;
      if (tool[1] === "resources") resources = parsed;
      else if (tool[1] === "prompts") prompts = parsed;
      else return null;
      continue;
    }
    return null;
  }
  if (command === undefined) return null;
  return {
    command,
    args,
    enabled: enabled ?? true,
    resources: resources ?? true,
    prompts: prompts ?? true,
  };
};

/**
 * Entry keys Hermes writes for its own transport configuration.
 *
 * Distilly reads none of them and writes none of them. The set stays deliberately tiny
 * and evidence-based: `connect_timeout` was observed on a real Hermes v0.19.0 entry,
 * whose presence otherwise made every newer host unconfigurable. Any other unknown key
 * still makes the entry unreadable and setup fails closed, which keeps a hand-edited
 * entry from being silently adopted or removed.
 */
const HOST_OWNED_ENTRY_KEYS = new Set(["connect_timeout"]);

const expectedMcpEntry = (wrapper: string): HermesMcpEntry => ({
  command: wrapper,
  args: [],
  enabled: true,
  resources: false,
  prompts: false,
});

const mcpEqual = (left: HermesMcpEntry, right: HermesMcpEntry): boolean =>
  canonicalJson(left) === canonicalJson(right);

const isManagedMcpEntry = (entry: HermesMcpEntry, wrapper: string): boolean =>
  entry.command === wrapper &&
  entry.args.length === 0 &&
  // Hermes may persist a just-added server as disabled when its first
  // connection attempt fails. That is still an exact host-generated state;
  // ownership is guarded by the last-observed snapshot in the rollback path.
  (entry.enabled === true || entry.enabled === false) &&
  (entry.resources === true || entry.resources === false) &&
  (entry.prompts === true || entry.prompts === false);

/**
 * Reports whether one host test output announced exactly five discovered tools.
 *
 * A real Hermes v0.19.0 prefixes the line with a status glyph ("✓ Tools discovered: 5")
 * while an older build printed the bare text, so any run of non-alphanumeric decoration is
 * allowed before the phrase. The count itself stays exact: "15" cannot match.
 *
 * @param stdout - Captured standard output of one host `mcp test` run.
 * @returns True when the output announced exactly five discovered tools.
 */
const discoveredExactlyFiveTools = (stdout: string): boolean =>
  /(?:^|\r?\n)[^A-Za-z0-9\r\n]*Tools discovered:\s*5\s*(?:\r?\n|$)/u.test(stdout);

const installSkill = async (
  sourceRoot: string,
  skillRoot: string,
  wrapper: string,
  context: InstallContext,
  runtimeVersion: string,
  expectedSkillDigest: ContentDigest,
  homeDirectory: string,
  configOwned: boolean,
): Promise<{ readonly manifest: HermesInstallManifest; readonly created: boolean }> => {
  if (
    !isAbsolute(context.launcherPath) ||
    !isAbsolute(context.pluginSourcePath) ||
    context.runtimeVersion !== runtimeVersion
  ) {
    throw invalid("Hermes installation paths and runtime version must match the active release.");
  }
  const sourceMeta = await lstatOrUndefined(sourceRoot);
  if (sourceMeta === undefined || !sourceMeta.isDirectory() || sourceMeta.isSymbolicLink()) {
    throw invalid("The Hermes Skill source must be a regular directory.");
  }
  const sourceFiles = await walkFiles(sourceRoot);
  if (!sourceFiles.has("SKILL.md") || skillTreeDigest(sourceFiles) !== expectedSkillDigest) {
    throw invalid("The Hermes Skill source canonical digest does not match this release.");
  }

  const existing = await lstatOrUndefined(skillRoot);
  if (existing !== undefined) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw corrupt("The Hermes Skill destination is not a regular directory.");
    }
    const manifest = await readVerifiedInstall(
      skillRoot,
      wrapper,
      runtimeVersion,
      context.launcherPath,
    );
    if (manifest.skillDigest !== expectedSkillDigest)
      throw corrupt("The Hermes Skill digest changed.");
    return { manifest, created: false };
  }

  const txRoot = join(homeDirectory, ".distilly", "host-install");
  try {
    await ensureRegularDirectoryChain(txRoot, true, homeDirectory);
    await ensureRegularDirectoryChain(dirname(skillRoot), true, homeDirectory);
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw invalid("The Hermes Skill or transaction directory is not a safe regular path.");
  }
  const staging = join(txRoot, `hermes-skill-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const wrapperBytesValue = wrapperBytes(context.launcherPath);
  let skillCreated = false;
  let wrapperCreated = false;
  const manifest: HermesInstallManifest = {
    schemaVersion: 1,
    host: HOST,
    runtimeVersion,
    launcherPath: context.launcherPath,
    wrapperPath: wrapper,
    wrapperDigest: digest(wrapperBytesValue),
    skillDigest: expectedSkillDigest,
    configOwned,
    files: [...sourceFiles.entries()]
      .map(([path, bytes]) => ({ path, contentDigest: digest(bytes) }))
      .sort((left, right) => compareUtf8(left.path, right.path)),
  };
  try {
    await mkdir(staging, { recursive: false, mode: 0o700 });
    for (const [path, bytes] of sourceFiles) {
      const destination = resolve(staging, path);
      if (!inside(staging, destination)) throw invalid("A Hermes Skill path escaped its root.");
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    }
    await writeFile(join(staging, SKILL_MANIFEST), `${canonicalJson(manifest)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(staging, skillRoot);
    skillCreated = true;
    const wrapperExisting = await lstatOrUndefined(wrapper);
    if (wrapperExisting !== undefined) throw invalid("The Hermes launcher wrapper already exists.");
    await ensureRegularDirectoryChain(dirname(wrapper), true, homeDirectory);
    await writeFile(wrapper, wrapperBytesValue, { flag: "wx", mode: 0o700 });
    wrapperCreated = true;
    await chmod(wrapper, 0o700);
    return { manifest, created: true };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (skillCreated) await rm(skillRoot, { recursive: true, force: true });
    if (wrapperCreated) await unlink(wrapper).catch(() => undefined);
    throw error;
  }
};

const removeSkill = async (
  skillRoot: string,
  wrapper: string,
  manifest: HermesInstallManifest,
  trustedRoot: string,
): Promise<void> => {
  try {
    await ensureRegularDirectoryChain(dirname(skillRoot), false, trustedRoot);
    await ensureRegularDirectoryChain(dirname(wrapper), false, trustedRoot);
  } catch {
    throw corrupt("The Hermes Skill or launcher parent directory is no longer safe.");
  }
  const wrapperBytesValue = await readRegular(wrapper);
  if (digest(wrapperBytesValue) !== manifest.wrapperDigest) {
    throw corrupt("The Hermes launcher wrapper changed.");
  }
  const backup = join(
    dirname(skillRoot),
    `.distilly-hermes-remove-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await rename(skillRoot, backup);
  let wrapperRemoved = false;
  try {
    await unlink(wrapper);
    wrapperRemoved = true;
    await rm(backup, { recursive: true, force: false });
    await rmdir(dirname(wrapper)).catch(() => undefined);
  } catch (error) {
    if (wrapperRemoved) {
      await mkdir(dirname(wrapper), { recursive: true, mode: 0o700 });
      await writeFile(wrapper, wrapperBytesValue, { flag: "wx", mode: 0o700 }).catch(
        () => undefined,
      );
    }
    await rename(backup, skillRoot).catch(() => undefined);
    throw error;
  }
};

const validateOptions = (options: HermesHostBindingOptions): void => {
  if (!isAbsolute(options.homeDirectory))
    throw new TypeError("Hermes homeDirectory must be absolute.");
  if (!isAbsolute(options.executablePath))
    throw new TypeError("Hermes executablePath must be absolute.");
  if (typeof options.forms?.ask !== "function")
    throw new TypeError("Hermes requires a trusted form presenter.");
  if (options.now !== undefined && typeof options.now !== "function")
    throw new TypeError("Hermes now must be a function.");
  if (options.commandRunner !== undefined && typeof options.commandRunner.run !== "function") {
    throw new TypeError("Hermes commandRunner must provide run.");
  }
};

/**
 * Creates Hermes' local compatibility binding.
 *
 * Hermes 0.9 does not load Codex/Claude bundle manifests. Distilly therefore
 * installs the canonical Skill in Hermes' managed Skill directory and uses
 * Hermes' own MCP CLI/config to register the same five-tool stdio server. No
 * Python plugin or provider credential is added to the repository.
 *
 * @param options - Trusted release, Hermes executable, home, forms, and clock.
 * @returns Full binding for Hermes Skill/MCP lifecycle and profile injection.
 */
export const createHermesHostBinding = (options: HermesHostBindingOptions): HostBinding => {
  validateOptions(options);
  const capability = createHermesCapabilityBinding({
    provider: options.provider,
    release: options.release,
  });
  const homeDirectory = resolve(options.homeDirectory);
  const skillRoot = join(hermesHome(homeDirectory), "skills", "distilly");
  const wrapper = wrapperPath(homeDirectory);
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    kind: "full" as const,
    host: HOST,
    preflight: (context: HostContext) => capability.preflight(context),
    createInjector: () => createHostInjector(HOST, homeDirectory, now),
    createFormRenderer: (context: HostContext) =>
      createHostFormRenderer(HOST, context, options.forms),
    installPlugin: async (context: InstallContext) => {
      await ensureHermesHome(homeDirectory);
      const config = await readHermesMcpEntry(homeDirectory);
      if (config === null)
        throw corrupt("Hermes config.yaml has an unreadable Distilly MCP entry.");
      const expected = expectedMcpEntry(wrapper);
      if (config !== undefined && !mcpEqual(config, expected)) {
        throw invalid(
          "Hermes already has a different MCP server named distilly; rename it explicitly.",
        );
      }
      const existingSkill = await lstatOrUndefined(skillRoot);
      if (config !== undefined && existingSkill === undefined) {
        throw invalid(
          "Hermes already has a user-owned MCP server named distilly; remove it explicitly before setup.",
        );
      }
      if (config === undefined && existingSkill !== undefined) {
        // A previously installed Skill may have been user-owned. Recreating
        // its missing MCP entry would change ownership without a durable
        // manifest update and could leave an orphaned entry on uninstall.
        const existingManifest = await readVerifiedInstall(
          skillRoot,
          wrapper,
          options.release.releaseVersion,
        );
        if (!existingManifest.configOwned) {
          throw invalid(
            "Hermes has an existing Distilly Skill without an owned MCP entry; remove it explicitly before setup.",
          );
        }
      }
      const sourceRoot = resolve(context.pluginSourcePath);
      const installed = await installSkill(
        sourceRoot,
        skillRoot,
        wrapper,
        context,
        options.release.releaseVersion,
        contentDigestSchema.parse(options.release.canonicalSkillDigest),
        homeDirectory,
        config === undefined,
      );
      let configuredByDistilly = false;
      let lastObservedConfig: HermesMcpEntry | undefined;
      try {
        if (config === undefined) {
          // Mark the entry as Distilly-owned before invoking the host. The
          // command may write config and then return a non-zero status; the
          // rollback below must still inspect and clean that partial write.
          configuredByDistilly = true;
          // `mcp add` is discovery-first: it starts the server and waits for its tool
          // list before writing the entry. Distilly's launcher opens a SQLite store and
          // validates its binding first, which a real Hermes v0.19.0 abandoned after its
          // short default, so the entry landed disabled and setup failed verification.
          const added = await runHost(
            options,
            homeDirectory,
            ["mcp", "add", "distilly", "--command", wrapper, "--connect-timeout", "20"],
            "y\n",
          );
          if (added.exitCode !== 0) throw commandFailed("configure");
          const afterAdd = await readHermesMcpEntry(homeDirectory);
          if (
            afterAdd === undefined ||
            afterAdd === null ||
            !isManagedMcpEntry(afterAdd, wrapper)
          ) {
            throw commandFailed("configure");
          }
          // A discovery that still failed is recoverable: the entry names our wrapper, so
          // enabling it is the operator's own setup request and the five-tool check below
          // is what actually proves the integration.
          if (afterAdd.enabled === false) {
            const enabled = await runHost(options, homeDirectory, [
              "config",
              "set",
              "mcp_servers.distilly.enabled",
              "true",
            ]);
            if (enabled.exitCode !== 0) throw commandFailed("configure");
            const afterEnable = await readHermesMcpEntry(homeDirectory);
            if (
              afterEnable === undefined ||
              afterEnable === null ||
              !isManagedMcpEntry(afterEnable, wrapper) ||
              afterEnable.enabled !== true
            ) {
              throw commandFailed("configure");
            }
            lastObservedConfig = afterEnable;
          } else {
            lastObservedConfig = afterAdd;
          }
          for (const key of ["resources", "prompts"] as const) {
            const result = await runHost(options, homeDirectory, [
              "config",
              "set",
              `mcp_servers.distilly.tools.${key}`,
              "false",
            ]);
            if (result.exitCode !== 0) throw commandFailed("configure");
            const afterSet = await readHermesMcpEntry(homeDirectory);
            if (
              afterSet === undefined ||
              afterSet === null ||
              !isManagedMcpEntry(afterSet, wrapper)
            ) {
              throw commandFailed("configure");
            }
            lastObservedConfig = afterSet;
          }
        }
        const finalConfig = await readHermesMcpEntry(homeDirectory);
        if (finalConfig === undefined || finalConfig === null || !mcpEqual(finalConfig, expected)) {
          throw commandFailed("configure");
        }
        lastObservedConfig = finalConfig;
        const tested = await runHost(options, homeDirectory, ["mcp", "test", "distilly"]);
        if (tested.exitCode !== 0 || !discoveredExactlyFiveTools(tested.stdout)) {
          throw commandFailed("verify");
        }
        return {
          host: HOST,
          manifestPath: join(skillRoot, SKILL_MANIFEST),
          installedPaths: [skillRoot, wrapper, configPath(homeDirectory)],
          restartRequired: true,
        };
      } catch (error) {
        const cleanupErrors: string[] = [];
        let configClean = !configuredByDistilly;
        if (configuredByDistilly) {
          try {
            const current = await readHermesMcpEntry(homeDirectory);
            if (current === undefined) {
              configClean = true;
            } else if (
              current === null ||
              lastObservedConfig === undefined ||
              !mcpEqual(current, lastObservedConfig) ||
              !isManagedMcpEntry(current, wrapper)
            ) {
              throw corrupt(
                "Hermes' partially configured Distilly MCP entry changed outside this setup.",
              );
            } else {
              const removed = await runHost(
                options,
                homeDirectory,
                ["mcp", "remove", "distilly"],
                "y\n",
              );
              if (removed.exitCode !== 0) throw commandFailed("remove");
              const remaining = await readHermesMcpEntry(homeDirectory);
              if (remaining !== undefined) throw commandFailed("remove");
              configClean = true;
            }
          } catch (cleanupError) {
            cleanupErrors.push(
              cleanupError instanceof Error
                ? cleanupError.message
                : "the Hermes MCP entry could not be removed",
            );
          }
        }
        if (installed.created && configClean) {
          try {
            await removeSkill(skillRoot, wrapper, installed.manifest, homeDirectory);
          } catch (cleanupError) {
            cleanupErrors.push(
              cleanupError instanceof Error
                ? cleanupError.message
                : "the new Hermes Skill could not be removed",
            );
          }
        } else if (installed.created && !configClean) {
          cleanupErrors.push("the new Hermes Skill was retained because its MCP entry remains");
        }
        if (cleanupErrors.length > 0) {
          throw corrupt(
            `Hermes setup failed and cleanup is incomplete: ${cleanupErrors.join("; ")}`,
          );
        }
        throw error;
      }
    },
    uninstallPlugin: async (context: InstallContext) => {
      const stateRoot = await lstatOrUndefined(hermesHome(homeDirectory));
      if (stateRoot === undefined) return;
      try {
        await ensureRegularDirectoryChain(hermesHome(homeDirectory), false, homeDirectory);
      } catch {
        throw corrupt("The Hermes state directory is no longer a safe regular path.");
      }
      const existing = await lstatOrUndefined(skillRoot);
      if (existing === undefined) return;
      const manifest = await readVerifiedInstall(
        skillRoot,
        wrapper,
        options.release.releaseVersion,
        context.launcherPath,
      );
      const config = await readHermesMcpEntry(homeDirectory);
      const expected = expectedMcpEntry(wrapper);
      if (config === null || (config !== undefined && !mcpEqual(config, expected))) {
        throw corrupt("The Hermes Distilly MCP entry was modified outside Distilly.");
      }
      if (!manifest.configOwned && config !== undefined) {
        throw corrupt(
          "The Hermes Distilly MCP entry is user-owned; remove it explicitly before uninstalling the Skill.",
        );
      }
      if (manifest.configOwned && config !== undefined) {
        const removed = await runHost(options, homeDirectory, ["mcp", "remove", "distilly"], "y\n");
        if (removed.exitCode !== 0) throw commandFailed("remove");
        const remaining = await readHermesMcpEntry(homeDirectory);
        if (remaining !== undefined) throw commandFailed("remove");
      }
      await removeSkill(skillRoot, wrapper, manifest, homeDirectory);
    },
    doctor: async (): Promise<HostDoctorResult> => {
      const stateRoot = await lstatOrUndefined(hermesHome(homeDirectory));
      if (stateRoot === undefined) {
        return {
          host: HOST,
          installed: false,
          launcherReachable: false,
          wireCompatible: false,
          warnings: ["Distilly is not installed for Hermes."],
          remediation: `Run distilly setup --host ${HOST}.`,
        };
      }
      try {
        await ensureRegularDirectoryChain(hermesHome(homeDirectory), false, homeDirectory);
      } catch {
        return {
          host: HOST,
          installed: true,
          launcherReachable: false,
          wireCompatible: false,
          warnings: ["The Hermes state directory is not a safe regular path."],
          remediation: `Preserve local changes, then re-run distilly setup --host ${HOST}.`,
        };
      }
      const existing = await lstatOrUndefined(skillRoot);
      if (existing === undefined) {
        return {
          host: HOST,
          installed: false,
          launcherReachable: false,
          wireCompatible: false,
          warnings: ["Distilly is not installed for Hermes."],
          remediation: `Run distilly setup --host ${HOST}.`,
        };
      }
      let manifest: HermesInstallManifest;
      try {
        manifest = await readVerifiedInstall(skillRoot, wrapper, options.release.releaseVersion);
      } catch {
        return {
          host: HOST,
          installed: true,
          launcherReachable: false,
          wireCompatible: false,
          warnings: ["The Hermes Distilly Skill ownership manifest is invalid."],
          remediation: `Preserve local changes, then re-run distilly setup --host ${HOST}.`,
        };
      }
      const warnings: string[] = [];
      let launcherReachable = true;
      try {
        await access(manifest.launcherPath, constants.X_OK);
        await access(manifest.wrapperPath, constants.X_OK);
      } catch {
        launcherReachable = false;
        warnings.push("The Hermes Distilly launcher or wrapper is not executable.");
      }
      try {
        const config = await readHermesMcpEntry(homeDirectory);
        if (
          config === null ||
          config === undefined ||
          !mcpEqual(config, expectedMcpEntry(manifest.wrapperPath))
        ) {
          warnings.push("Hermes does not have the expected Distilly MCP entry.");
        } else {
          const tested = await runHost(options, homeDirectory, ["mcp", "test", "distilly"]);
          if (tested.exitCode !== 0 || !discoveredExactlyFiveTools(tested.stdout)) {
            warnings.push("Hermes could not reopen the five-tool Distilly MCP server.");
          }
        }
      } catch {
        warnings.push("Hermes could not verify its Distilly MCP entry.");
      }
      return {
        host: HOST,
        installed: true,
        launcherReachable,
        wireCompatible: warnings.length === 0,
        warnings,
        ...(warnings.length === 0 ? {} : { remediation: `Re-run distilly setup --host ${HOST}.` }),
      };
    },
  });
};
