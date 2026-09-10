import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, realpath } from "node:fs/promises";

import { BUILTIN_HOSTS, subjectIdSchema, type HostName } from "@distilly/protocol";

import {
  doctorPreview,
  requireInstalledPreviewBinding,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";
import {
  PREVIEW_PANEL_ASSETS,
  PREVIEW_PLUGIN_SOURCES,
  PREVIEW_RUNTIME_MANIFEST,
} from "./runtime-package.js";

/** Process streams kept injectable for focused command tests. */
export interface PreviewCliIo {
  readonly stdout: { write(value: string): unknown };
  readonly stderr: { write(value: string): unknown };
}

/** Explicit command environment; packaged Preview assembly can replace repo-local paths later. */
export interface PreviewCliEnvironment {
  readonly lifecycle: PreviewLifecycleEnvironment;
  readonly panelAssetsPath: string;
}

const parseHost = (value: string | undefined): HostName => {
  if (value === BUILTIN_HOSTS.codex) return BUILTIN_HOSTS.codex;
  if (value === BUILTIN_HOSTS.claudeCode) return BUILTIN_HOSTS.claudeCode;
  if (value === BUILTIN_HOSTS.openclaw) return BUILTIN_HOSTS.openclaw;
  if (value === BUILTIN_HOSTS.hermes) return BUILTIN_HOSTS.hermes;
  if (value === BUILTIN_HOSTS.dsh) return BUILTIN_HOSTS.dsh;
  throw new Error(
    "Unknown host. Native bindings are available for codex, claude-code, openclaw, hermes, and dsh. Other hosts use the explicit Legacy Skill compatibility guide: https://github.com/titanwings/distilly/blob/distilly-plugin/INSTALL.md#legacy-skill-compatibility-for-hosts-without-a-verified-plugin-binding. Distilly did not switch modes.",
  );
};

const hostOption = (args: readonly string[], required: boolean): HostName | undefined => {
  if (args.length === 0 && !required) return undefined;
  if (args.length !== 2 || args[0] !== "--host") {
    throw new Error(required ? "This command requires --host." : "Expected only --host <host>.");
  }
  return parseHost(args[1]);
};

const openApplication = async (host: HostName, environment: PreviewCliEnvironment) => {
  const binding = await requireInstalledPreviewBinding(environment.lifecycle, host);
  const hostContext = {
    sessionId: `${host}-preview-mcp-${process.pid}`,
    environment: "cli" as const,
  };
  const preflight = await binding.preflight(hostContext);
  if (!preflight.ok) throw new Error(preflight.error.message);
  const { openPreviewMcpApplication } = await import("./preview.js");
  return openPreviewMcpApplication({
    root: join(environment.lifecycle.homeDirectory, ".distilly"),
    binding,
    hostContext,
    capacity: preflight.capacity,
    panel: {
      assetsDir: environment.panelAssetsPath,
    },
  });
};

const runMcp = async (host: HostName, environment: PreviewCliEnvironment): Promise<void> => {
  const application = await openApplication(host, environment);
  try {
    await application.runStdio();
  } finally {
    await application.close();
  }
};

/**
 * Resolves the repo-local built entry used before packaged Preview assembly.
 *
 * @returns Trusted paths derived from this built command entry.
 */
export const resolvePreviewCliEnvironment = async (): Promise<PreviewCliEnvironment> => {
  const configuredHome = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
  if (!isAbsolute(configuredHome)) throw new Error("The user home path must be absolute.");
  const entryPath = await realpath(fileURLToPath(new URL("./bin.js", import.meta.url)));
  const packageRoot = resolve(dirname(entryPath), "..");
  const runtimeRoot = resolve(packageRoot, "../..");
  const packaged = await lstat(join(runtimeRoot, PREVIEW_RUNTIME_MANIFEST))
    .then((metadata) => metadata.isFile() && !metadata.isSymbolicLink())
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    });
  return {
    lifecycle: {
      homeDirectory: resolve(configuredHome),
      nodePath: await realpath(process.execPath),
      entryPath,
      pluginSourcesPath: await realpath(
        packaged
          ? join(runtimeRoot, PREVIEW_PLUGIN_SOURCES)
          : resolve(packageRoot, "../..", "plugins"),
      ),
      ...(packaged ? { runtimePackagePath: runtimeRoot } : {}),
      pathValue: process.env.PATH ?? "",
    },
    panelAssetsPath: await realpath(
      packaged ? join(runtimeRoot, PREVIEW_PANEL_ASSETS) : resolve(packageRoot, "../panel/web"),
    ),
  };
};

const help = `Distilly Developer Preview

Usage:
  distilly setup --host codex
  distilly setup --host claude-code|openclaw|hermes
  distilly doctor [--host <host>]
  distilly install <subject-id> --host <host>
  distilly uninstall --host <host>
  # <host>: codex | claude-code | openclaw | hermes

The four host bindings share the same five-tool MCP contract. Setup remains
fail-closed until this release has an exact verified capacity fixture for the
selected host version; no synthetic capacity is used. Other hosts:
  Use the explicit Legacy Skill compatibility path documented in INSTALL.md.
`;

/**
 * Runs the narrow real Developer Preview command surface.
 *
 * @param argv - Command arguments after the executable name.
 * @param environment - Trusted lifecycle and Panel paths.
 * @param io - Process output streams.
 * @returns The process exit code.
 */
export const runPreviewCli = async (
  argv: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<number> => {
  const [command, ...args] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.stdout.write(help);
    return 0;
  }
  if (command === "setup") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    const result = await setupPreviewHost(host, environment.lifecycle);
    io.stdout.write(
      `Installed Distilly ${result.releaseVersion} for ${result.host}. Restart the host to discover it.\n`,
    );
    return 0;
  }
  if (command === "doctor") {
    const report = await doctorPreview(environment.lifecycle, hostOption(args, false));
    io.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  if (command === "uninstall") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    const result = await uninstallPreviewHost(host, environment.lifecycle);
    io.stdout.write(
      `${result.removed ? "Removed" : "No installed integration for"} ${result.host}; person data was preserved.\n`,
    );
    return 0;
  }
  if (command === "install") {
    if (args.length !== 3 || args[1] !== "--host") {
      throw new Error("This command requires <subject-id> --host <host>.");
    }
    const subjectId = subjectIdSchema.parse(args[0]);
    const host = parseHost(args[2]);
    const application = await openApplication(host, environment);
    try {
      const installed = await application.distilly.person(subjectId).install(host);
      io.stdout.write(`Installed ${subjectId} for ${host} at ${installed.path}.\n`);
    } finally {
      await application.close();
    }
    return 0;
  }
  if (command === "mcp") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    await runMcp(host, environment);
    return 0;
  }
  io.stderr.write(`Unknown or unavailable Developer Preview command: ${command}.\n`);
  return 2;
};
