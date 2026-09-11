import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { BUILTIN_HOSTS, DistillyError } from "@distilly/protocol";

import { createHostFormRenderer } from "../full/form-renderer.js";
import { createHostInjector } from "../full/injector.js";
import { doctorPluginTree, installPluginTree, uninstallPluginTree } from "../full/plugin-tree.js";
import { defaultHostCommandRunner } from "../full/command-runner.js";
import { ensureRegularDirectoryChain } from "../full/safe-directories.js";
import type {
  HostBinding,
  HostContext,
  HostCommandRunner,
  OpenClawHostBindingOptions,
  InstallContext,
} from "../protocol.js";
import { createOpenClawCapabilityBinding } from "./capability.js";

const PLATFORM_MANIFEST = ".claude-plugin/plugin.json";

const invalid = (message: string): DistillyError =>
  new DistillyError({ code: "invalid_input", message, retryable: false });

const lstatOrUndefined = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const commandFailed = (): DistillyError =>
  new DistillyError({
    code: "internal_error",
    message: "OpenClaw did not discover the installed Distilly bundle.",
    retryable: false,
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

const hostEnvironment = (homeDirectory: string): Readonly<Record<string, string>> => ({
  OPENCLAW_STATE_DIR: join(homeDirectory, ".openclaw"),
  OPENCLAW_CONFIG_PATH: join(homeDirectory, ".openclaw", "openclaw.json"),
});

const ensureOpenClawHome = async (homeDirectory: string): Promise<void> => {
  try {
    await ensureRegularDirectoryChain(join(homeDirectory, ".openclaw"), true, homeDirectory);
  } catch {
    throw invalid("The OpenClaw state directory is not a safe regular path.");
  }
};

const runHost = async (
  options: OpenClawHostBindingOptions,
  homeDirectory: string,
  args: readonly string[],
): Promise<Awaited<ReturnType<HostCommandRunner["run"]>>> =>
  (options.commandRunner ?? defaultHostCommandRunner).run({
    executablePath: options.executablePath,
    args,
    homeDirectory,
    environment: hostEnvironment(homeDirectory),
  });

const parseJsonValue = (stdout: string): unknown => {
  const text = stdout.trim();
  // OpenClaw may print plugin diagnostics to stdout before its `--json`
  // payload. Accept exactly one trailing JSON value and ignore only the
  // known textual prefix; never merge or evaluate diagnostic text as JSON.
  const candidates: unknown[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{" && text[start] !== "[") continue;
    try {
      const value = JSON.parse(text.slice(start)) as unknown;
      if (value !== null && typeof value === "object") candidates.push(value);
    } catch {
      // Try the next opening delimiter; nested values fail until the outermost
      // payload is reached.
    }
  }
  if (candidates.length !== 1) throw invalid("OpenClaw returned an ambiguous JSON result.");
  return candidates[0];
};

const parseJsonObject = (stdout: string): Record<string, unknown> => {
  const value = parseJsonValue(stdout);
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    throw invalid("OpenClaw returned a JSON value instead of an object.");
  }
  return value as Record<string, unknown>;
};

const normalizeMcpServer = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("OpenClaw returned an invalid MCP server record.");
  }
  const record = value as Record<string, unknown>;
  const nested = record.config ?? record.server;
  const allowedRecordKeys = new Set(["name", "enabled", "config", "server"]);
  if (Object.keys(record).some((key) => !allowedRecordKeys.has(key) && nested !== undefined)) {
    return { command: "__distilly_conflicting_server__", args: [] };
  }
  const config =
    nested === undefined
      ? Object.fromEntries(
          Object.entries(record).filter(([key]) => key !== "name" && key !== "enabled"),
        )
      : nested !== null && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : undefined;
  if (config === undefined || typeof config.command !== "string") {
    throw invalid("OpenClaw returned an invalid MCP server command.");
  }
  const args = config.args ?? [];
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
    throw invalid("OpenClaw returned invalid MCP server arguments.");
  }
  // Do not ignore launch-affecting fields such as env/cwd. A server with any
  // such field is a conflict, rather than an entry Distilly can safely own.
  const allowedConfigKeys = new Set(["command", "args"]);
  if ([...Object.keys(config)].some((key) => !allowedConfigKeys.has(key))) {
    return { command: "__distilly_conflicting_server__", args: [] };
  }
  if (record.enabled === false || config.enabled === false) {
    return { command: "__distilly_disabled_server__", args: [] };
  }
  return { command: config.command, args };
};

const readGlobalMcpServer = async (
  options: OpenClawHostBindingOptions,
  homeDirectory: string,
): Promise<Record<string, unknown> | undefined> => {
  await ensureOpenClawHome(homeDirectory);
  const result = await runHost(options, homeDirectory, ["mcp", "list", "--json"]);
  if (result.exitCode !== 0) throw invalid("OpenClaw could not read its MCP configuration.");
  const value = parseJsonValue(result.stdout);
  if (value === null || typeof value !== "object") {
    throw invalid("OpenClaw returned an invalid MCP configuration.");
  }
  const record = Array.isArray(value) ? undefined : (value as Record<string, unknown>);
  // OpenClaw releases have emitted both a keyed object and a `servers` list;
  // accept the two observed wire shapes, but never silently ignore a named
  // entry that could override or disable the bundle server.
  if (record?.distilly !== undefined && record.servers !== undefined) {
    throw invalid("OpenClaw returned ambiguous MCP configuration.");
  }
  if (record?.distilly !== undefined) return normalizeMcpServer(record.distilly);
  const serverList = Array.isArray(value) ? value : record?.servers;
  if (serverList === undefined) return undefined;
  if (!Array.isArray(serverList)) {
    throw invalid("OpenClaw's MCP server list is invalid.");
  }
  const matches = serverList.filter((entry: unknown): entry is Record<string, unknown> => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return false;
    return (entry as Record<string, unknown>).name === "distilly";
  });
  if (matches.length > 1) throw invalid("OpenClaw has duplicate Distilly MCP entries.");
  const match = matches[0];
  if (match === undefined) return undefined;
  // Recent OpenClaw releases intentionally return a status summary from
  // `mcp list --json` (`configured`, `ok`, `transport`, `launch`, ...), not the
  // command/args that are persisted in the config. Read the named raw entry
  // before deciding whether Distilly may reuse it; treating a summary as a
  // complete config would either reject an idempotent install or miss a
  // conflicting command.
  const detail = await runHost(options, homeDirectory, ["mcp", "show", "distilly", "--json"]);
  if (detail.exitCode !== 0) {
    throw invalid("OpenClaw could not read the existing distilly MCP server.");
  }
  return normalizeMcpServer(parseJsonObject(detail.stdout));
};

const expectedServer = (launcherPath: string): Record<string, unknown> => ({
  command: launcherPath,
  args: ["mcp", "--host", "openclaw"],
});

const samePath = async (left: string, right: string): Promise<boolean> => {
  try {
    return (await realpath(left)) === (await realpath(right));
  } catch {
    return resolve(left) === resolve(right);
  }
};

interface OpenClawInspection {
  readonly plugin: Record<string, unknown>;
  readonly mcpServers: readonly Record<string, unknown>[];
}

const inspectBundle = async (
  options: OpenClawHostBindingOptions,
  homeDirectory: string,
  pluginRoot: string,
): Promise<OpenClawInspection> => {
  await ensureOpenClawHome(homeDirectory);
  const result = await runHost(options, homeDirectory, [
    "plugins",
    "inspect",
    "distilly",
    "--json",
  ]);
  if (result.exitCode !== 0) throw commandFailed();
  const report = parseJsonObject(result.stdout);
  const pluginValue = report.plugin;
  const serversValue = report.mcpServers;
  if (
    pluginValue === null ||
    typeof pluginValue !== "object" ||
    Array.isArray(pluginValue) ||
    !Array.isArray(serversValue)
  ) {
    throw commandFailed();
  }
  const plugin = pluginValue as Record<string, unknown>;
  if (
    plugin.id !== "distilly" ||
    plugin.format !== "bundle" ||
    plugin.bundleFormat !== "claude" ||
    plugin.enabled !== true ||
    plugin.status !== "loaded" ||
    typeof plugin.rootDir !== "string" ||
    !(await samePath(plugin.rootDir, pluginRoot))
  ) {
    throw commandFailed();
  }
  const mcpServers = serversValue.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry),
  );
  const distillyEntries = mcpServers.filter((entry) => entry.name === "distilly");
  if (distillyEntries.length !== 1 || distillyEntries[0]?.hasStdioTransport !== true) {
    throw commandFailed();
  }
  return { plugin, mcpServers };
};

const validateOptions = (options: OpenClawHostBindingOptions): void => {
  if (!isAbsolute(options.homeDirectory)) {
    throw new TypeError("OpenClaw full binding homeDirectory must be absolute.");
  }
  if (!isAbsolute(options.executablePath)) {
    throw new TypeError("OpenClaw full binding executablePath must be absolute.");
  }
  if (typeof options.forms?.ask !== "function") {
    throw new TypeError("OpenClaw full binding requires a trusted form presenter.");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("OpenClaw full binding now must be a function when provided.");
  }
  if (options.commandRunner !== undefined && typeof options.commandRunner.run !== "function") {
    throw new TypeError("OpenClaw full binding commandRunner must provide run.");
  }
};

/**
 * Creates the OpenClaw bundle compatibility binding.
 *
 * OpenClaw can load the Claude-compatible bundle directly. Distilly writes a
 * real `.mcp.json` with an absolute launcher into the owned extension tree and
 * asks OpenClaw only to inspect that tree. It deliberately does not mutate the
 * user's global `mcp.servers` entry: a pre-existing entry is read and left
 * untouched, so uninstall cannot remove user-owned configuration.
 *
 * @param options - Trusted release, host executable, home, forms, and clock.
 * @returns A full OpenClaw binding with bundle and person-profile lifecycle.
 */
export const createOpenClawHostBinding = (options: OpenClawHostBindingOptions): HostBinding => {
  validateOptions(options);
  const capability = createOpenClawCapabilityBinding({
    provider: options.provider,
    release: options.release,
  });
  const host = BUILTIN_HOSTS.openclaw;
  const homeDirectory = resolve(options.homeDirectory);
  const pluginRoot = join(homeDirectory, ".openclaw", "extensions", "distilly");
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    kind: "full" as const,
    host,
    preflight: (context: HostContext) => capability.preflight(context),
    createInjector: () => createHostInjector(host, homeDirectory, now),
    createFormRenderer: (context: HostContext) =>
      createHostFormRenderer(host, context, options.forms),
    installPlugin: async (context: InstallContext) => {
      const globalServer = await readGlobalMcpServer(options, homeDirectory);
      if (
        globalServer !== undefined &&
        canonicalJson(globalServer) !== canonicalJson(expectedServer(context.launcherPath))
      ) {
        throw invalid(
          "OpenClaw already has a different MCP server named distilly; rename it explicitly before setup.",
        );
      }
      return installPluginTree(
        context,
        options.release.releaseVersion,
        {
          host,
          trustedRoot: homeDirectory,
          pluginRoot,
          transactionRoot: join(homeDirectory, ".distilly", "host-install"),
          platformManifestPath: PLATFORM_MANIFEST,
          expectedSkillDigest: options.release.canonicalSkillDigest,
          repairDamaged: options.repairDamagedHost === true,
          mcpShape: (launcherPath) => ({
            mcpServers: {
              distilly: { command: launcherPath, args: ["mcp", "--host", host] },
            },
          }),
        },
        async () => {
          await inspectBundle(options, homeDirectory, pluginRoot);
        },
      );
    },
    uninstallPlugin: async () => {
      await uninstallPluginTree(pluginRoot, host, homeDirectory);
    },
    doctor: async () => {
      const stateRoot = await lstatOrUndefined(join(homeDirectory, ".openclaw"));
      if (stateRoot !== undefined) {
        try {
          await ensureRegularDirectoryChain(join(homeDirectory, ".openclaw"), false, homeDirectory);
        } catch {
          return {
            host,
            installed: true,
            launcherReachable: false,
            wireCompatible: false,
            warnings: ["The OpenClaw state directory is not a safe regular path."],
            remediation: `Preserve local changes, then re-run distilly setup --host ${host}.`,
          };
        }
      }
      const health = await doctorPluginTree(pluginRoot, host, options.release.releaseVersion);
      if (!health.installed) return health;
      const warnings = [...health.warnings];
      try {
        await inspectBundle(options, homeDirectory, pluginRoot);
      } catch {
        warnings.push("OpenClaw does not discover a loaded Distilly bundle with an MCP server.");
      }
      return {
        ...health,
        wireCompatible: health.wireCompatible && warnings.length === 0,
        warnings,
        ...(warnings.length === 0 ? {} : { remediation: `Re-run distilly setup --host ${host}.` }),
      };
    },
  });
};
