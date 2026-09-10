import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, realpath } from "node:fs/promises";

import { BUILTIN_HOSTS, WIRE_LIMITS, subjectIdSchema, type HostName } from "@distilly/protocol";

import {
  doctorPreview,
  requireInstalledPreviewBinding,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";
import { describeHarvestSelection, selectHarvestFiles } from "./harvest.js";
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

/**
 * Resolves when the operator interrupts the process or closes standard input.
 *
 * @returns A promise that settles on the first shutdown signal.
 */
const waitForShutdown = async (): Promise<void> => {
  await new Promise<void>((resolvePromise) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      process.stdin.off("end", finish);
      resolvePromise();
    };
    process.once("SIGINT", finish);
    process.once("SIGTERM", finish);
    // A closed stdin means the operator or a supervisor stopped waiting for the panel.
    process.stdin.once("end", finish);
  });
};

const runPanel = async (
  host: HostName,
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const application = await openApplication(host, environment);
  try {
    const url = await application.startPanel();
    io.stdout.write(
      `Distilly review panel for ${host}: ${url}\nReview local profiles in a browser; press Ctrl-C to stop.\n`,
    );
    await waitForShutdown();
  } finally {
    await application.close();
  }
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

/**
 * Parses the harvest command's arguments into one validated request.
 *
 * @param args - Directory path followed by flag pairs.
 * @returns Directory, host, subject selection, sensitivity, and optional cap.
 */
const harvestOptions = (
  args: readonly string[],
): {
  readonly directory: string;
  readonly host: HostName;
  readonly subjectId?: string;
  readonly displayName?: string;
  readonly sensitivity?: "private" | "shareable";
  readonly maximumFiles?: number;
} => {
  const [directory, ...rest] = args;
  if (directory === undefined || directory.startsWith("--")) {
    throw new Error("This command requires a directory path, then --host <host>.");
  }
  let host: HostName | undefined;
  const parsed: {
    subjectId?: string;
    displayName?: string;
    sensitivity?: "private" | "shareable";
    maximumFiles?: number;
  } = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") host = parseHost(value);
    else if (flag === "--subject") parsed.subjectId = value;
    else if (flag === "--name") parsed.displayName = value;
    else if (flag === "--sensitivity") {
      if (value !== "private" && value !== "shareable") {
        throw new Error("--sensitivity must be private or shareable.");
      }
      parsed.sensitivity = value;
    } else if (flag === "--limit") {
      const limit = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit must be positive.");
      parsed.maximumFiles = limit;
    } else {
      throw new Error(`Unknown harvest option: ${String(flag)}.`);
    }
  }
  if (host === undefined) throw new Error("This command requires --host.");
  if ((parsed.subjectId === undefined) === (parsed.displayName === undefined)) {
    throw new Error("Pass exactly one of --subject <subject-id> or --name <display-name>.");
  }
  return { directory, host, ...parsed };
};

/**
 * Selects a directory and ingests its evidence in wire-sized batches.
 *
 * Batches are capped by the protocol's per-call material limit, so a large export folder
 * is ingested over several calls with visible progress rather than one oversized request.
 *
 * @param args - Directory plus host, subject, sensitivity, and cap options.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runHarvest = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const options = harvestOptions(args);
  const selection = await selectHarvestFiles(options.directory, {
    ...(options.maximumFiles === undefined ? {} : { maximumFiles: options.maximumFiles }),
  });
  for (const line of describeHarvestSelection(selection)) io.stdout.write(`${line}\n`);
  if (selection.files.length === 0) {
    io.stdout.write("Nothing to ingest.\n");
    return;
  }
  const application = await openApplication(options.host, environment);
  try {
    // A file larger than one material is split by the runtime into parts, so it must travel
    // alone: a batch of several oversized files could exceed the wire limit for one result.
    const batches: (readonly (typeof selection.files)[number][])[] = [];
    let pending: (typeof selection.files)[number][] = [];
    for (const file of selection.files) {
      if (file.sizeBytes > WIRE_LIMITS.materialContentBytes) {
        if (pending.length > 0) batches.push(pending);
        batches.push([file]);
        pending = [];
        continue;
      }
      pending.push(file);
      if (pending.length === WIRE_LIMITS.ingestMaterials) {
        batches.push(pending);
        pending = [];
      }
    }
    if (pending.length > 0) batches.push(pending);

    let subjectId: string | undefined = options.subjectId;
    let ingested = 0;
    for (const batch of batches) {
      const result = await application.distilly.ingestFiles({
        subject:
          subjectId === undefined
            ? { kind: "create", input: { displayName: options.displayName ?? "" } }
            : { kind: "existing", subjectId: subjectIdSchema.parse(subjectId) },
        paths: batch.map((file) => file.path),
        enqueue: "auto",
        ...(options.sensitivity === undefined ? {} : { sensitivity: options.sensitivity }),
      });
      subjectId = result.subject.id;
      ingested += batch.length;
      io.stdout.write(
        `Ingested ${String(ingested)}/${String(selection.files.length)} file(s) as ${result.subject.displayName} (${result.subject.id}).\n`,
      );
    }
  } finally {
    await application.close();
  }
};

const help = `Distilly Developer Preview

Usage:
  distilly setup --host codex
  distilly setup --host claude-code|openclaw|hermes|dsh [--allow-unverified-host]
  distilly doctor [--host <host>]
  distilly install <subject-id> --host <host>
  distilly uninstall --host <host>
  distilly panel --host <host>
  distilly harvest <directory> --host <host> --subject <subject-id>|--name <display-name>
                   [--sensitivity private|shareable] [--limit <n>]
  # <host>: codex | claude-code | openclaw | hermes | dsh

The host bindings share the same five-tool MCP contract. Setup remains
fail-closed until this release has an exact verified capacity fixture for the
selected host version; no synthetic capacity is used. --allow-unverified-host
accepts an unrecorded version on a conservative floor budget, records the state,
and keeps doctor reporting it. Other hosts:
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
    const allowUnverifiedHost = args.includes("--allow-unverified-host");
    const host = hostOption(
      args.filter((argument) => argument !== "--allow-unverified-host"),
      true,
    );
    if (host === undefined) throw new Error("This command requires --host.");
    const result = await setupPreviewHost(host, environment.lifecycle, { allowUnverifiedHost });
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
  if (command === "harvest") {
    await runHarvest(args, environment, io);
    return 0;
  }
  if (command === "panel") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    await runPanel(host, environment, io);
    return 0;
  }
  io.stderr.write(`Unknown or unavailable Developer Preview command: ${command}.\n`);
  return 2;
};
