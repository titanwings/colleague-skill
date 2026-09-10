import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, realpath } from "node:fs/promises";

import {
  BUILTIN_HOSTS,
  DistillyError,
  WIRE_LIMITS,
  subjectIdSchema,
  type HostName,
  type SubjectSummary,
} from "@distilly/protocol";
import { listPersonInstalls, type PersonInstallSummary } from "@distilly/bindings";
import type { Distilly } from "distilly";

import { ambiguousCandidates, reusableSubject } from "./subject-errors.js";

import {
  doctorPreview,
  requireInstalledPreviewBinding,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";
import { describeHarvestSelection, recordBudgetExceeded, selectHarvestFiles } from "./harvest.js";
import {
  hashFile,
  loadHarvestState,
  planHarvest,
  recordHarvest,
  recordedPath,
  saveHarvestState,
  type HashedHarvestFile,
} from "./harvest-state.js";
import {
  describeAmbiguousSubject,
  describePendingProfile,
  describeProfile,
  describeSubjectList,
  looksLikeSubjectId,
} from "./show.js";
import {
  describeProfileDiff,
  describeVersions,
  resolveVersionArgument,
  statusLabel,
} from "./versions.js";
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
  /**
   * DSH's own home directory.
   *
   * DSH reads `$DSH_HOME`, or `~/.dsh` when that variable is unset, so its profile tree and
   * skills root do not live under the ordinary user home and must not be guessed from it.
   */
  readonly dshHomeDirectory: string;
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

/**
 * Names the home directory one command must target for a host.
 *
 * DSH keeps its profile tree and skills root under `$DSH_HOME` (default `~/.dsh`), not under
 * the ordinary user home, so the two are resolved separately.
 *
 * @param host - Selected host.
 * @param environment - Resolved Preview CLI environment.
 * @returns Absolute host home directory.
 */
const hostHome = (host: HostName, environment: PreviewCliEnvironment): string =>
  host === BUILTIN_HOSTS.dsh ? environment.dshHomeDirectory : environment.lifecycle.homeDirectory;

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
  const dshHomeDirectory = resolve(
    process.env["DSH_HOME"] !== undefined && process.env["DSH_HOME"].trim().length > 0
      ? process.env["DSH_HOME"]
      : join(configuredHome, ".dsh"),
  );
  return {
    lifecycle: {
      homeDirectory: resolve(configuredHome),
      dshHomeDirectory,
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
    dshHomeDirectory,
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
  readonly force: boolean;
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
    force?: boolean;
  } = {};
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--force") {
      parsed.force = true;
      continue;
    }
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
    index += 1;
  }
  if (host === undefined) throw new Error("This command requires --host.");
  if ((parsed.subjectId === undefined) === (parsed.displayName === undefined)) {
    throw new Error("Pass exactly one of --subject <subject-id> or --name <display-name>.");
  }
  return { directory, host, force: parsed.force === true, ...parsed };
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
  // The limit applies to what is actually ingested, not to what is discovered: applying it
  // first would keep re-selecting files that are already stored and never reach the rest.
  const selection = await selectHarvestFiles(options.directory);
  for (const line of describeHarvestSelection(selection)) io.stdout.write(`${line}\n`);
  if (selection.files.length === 0) {
    io.stdout.write("Nothing to ingest.\n");
    return;
  }
  const application = await openApplication(options.host, environment);
  try {
    let subjectId: string | undefined = options.subjectId;
    if (subjectId === undefined) {
      // Resolve the name before creating anything. The engine answers with the one subject it
      // matched, several candidates, or none, and the CLI acts on that answer instead of
      // discovering a conflict after a create attempt.
      const resolution = await application.distilly.resolve({
        selector: { kind: "query", query: options.displayName ?? "" },
      });
      if (resolution.kind === "found") {
        subjectId = resolution.subject.id;
        io.stdout.write(
          `${resolution.subject.displayName} (${resolution.subject.id}) already exists in ${resolution.subject.space.displayName}, so this material is added to it.\n`,
        );
      } else if (resolution.kind === "ambiguous") {
        for (const line of describeAmbiguousSubject(
          options.displayName ?? "",
          resolution.candidates,
        )) {
          io.stdout.write(`${line}\n`);
        }
        throw new Error(
          "More than one subject matches that name. Repeat harvest with --subject <subject-id>.",
        );
      } else {
        // The engine treats differently capitalized names as different people, so a new
        // subject is correct here; say so when a near-duplicate exists instead of silently
        // splitting one person's material across two subjects.
        const wanted = (options.displayName ?? "").toLowerCase();
        let nearDuplicate: SubjectSummary | undefined;
        let cursor: string | undefined;
        // Page through the whole filtered listing: the case-variant may sort past any fixed
        // window, and a missed warning silently splits one person across two subjects.
        for (let page = 0; page < 20 && nearDuplicate === undefined; page += 1) {
          const listed = await application.distilly.list({
            text: options.displayName ?? "",
            limit: 200,
            ...(cursor === undefined ? {} : { cursor }),
          });
          nearDuplicate = listed.items.find(
            (candidate) => candidate.displayName.toLowerCase() === wanted,
          );
          cursor = listed.nextCursor;
          if (cursor === undefined) break;
        }
        if (nearDuplicate !== undefined) {
          io.stdout.write(
            `Note: ${nearDuplicate.displayName} (${nearDuplicate.id}) already exists in ${nearDuplicate.space.displayName} with different capitalization; a new subject is created. Pass --subject ${nearDuplicate.id} to add to that one instead.\n`,
          );
        }
      }
    }
    const statePath = join(environment.lifecycle.homeDirectory, ".distilly", "harvest-state.json");
    const state = await loadHarvestState(statePath);
    const failures: string[] = [];
    const hashed: HashedHarvestFile[] = [];
    for (const file of selection.files) {
      try {
        hashed.push({
          ...file,
          sha256: await hashFile(file.path),
          recordedPath: await recordedPath(file.path),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "the file could not be read";
        failures.push(`${file.pathLabel}: ${reason}`);
        io.stdout.write(`Could not read ${file.pathLabel}: ${reason}\n`);
      }
    }
    let files = hashed;
    const recorded = subjectId === undefined ? [] : (state.entries[subjectId] ?? []);
    if (!options.force && recorded.length > 0) {
      const plan = planHarvest(files, recorded);
      if (plan.alreadyIngested.length > 0) {
        for (const file of plan.alreadyIngested) {
          io.stdout.write(
            `Skipped ${file.pathLabel}: already ingested for this subject; pass --force to ingest it again.\n`,
          );
        }
      }
      files = [...plan.ingest];
    } else if (options.force && files.length > 0) {
      io.stdout.write(
        `--force re-ingests ${String(files.length)} file(s) even if they are unchanged, so the store gains a new material record for each one.\n`,
      );
    }
    if (options.maximumFiles !== undefined && files.length > options.maximumFiles) {
      const remaining = files.length - options.maximumFiles;
      files = files.slice(0, options.maximumFiles);
      io.stdout.write(
        `Reached --limit ${String(options.maximumFiles)}; ${String(remaining)} more file(s) still need ingesting. Re-run to continue.\n`,
      );
    }
    if (files.length === 0) {
      io.stdout.write("Nothing new to ingest.\n");
      if (failures.length > 0) {
        throw new Error(
          `${String(failures.length)} of ${String(selection.files.length)} file(s) could not be ingested:\n${failures.join("\n")}`,
        );
      }
      return;
    }
    // A file larger than one material is split by the runtime into parts, so it must travel
    // alone: a batch of several oversized files could exceed the wire limit for one result.
    const batches: (readonly (typeof files)[number][])[] = [];
    let pending: (typeof files)[number][] = [];
    for (const file of files) {
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

    let ingested = 0;
    let recordedState = state;
    // Harvest is an explicit user action, so distillation is queued now instead of waiting for
    // the engine's automatic threshold: a single small file previously produced no job and no
    // message, which read as nothing having happened.
    const ingest = async (
      target:
        | { readonly kind: "create"; readonly input: { readonly displayName: string } }
        | { readonly kind: "existing"; readonly subjectId: string },
      batch: readonly (typeof files)[number][],
    ) =>
      await application.distilly.ingestFiles({
        subject:
          target.kind === "create"
            ? { kind: "create", input: target.input }
            : { kind: "existing", subjectId: subjectIdSchema.parse(target.subjectId) },
        paths: batch.map((file) => file.path),
        enqueue: "now",
        ...(options.sensitivity === undefined ? {} : { sensitivity: options.sensitivity }),
      });
    const ingestTarget = () =>
      subjectId === undefined
        ? ({ kind: "create", input: { displayName: options.displayName ?? "" } } as const)
        : ({ kind: "existing", subjectId } as const);
    const ingestWithSubjectReuse = async (batch: readonly (typeof files)[number][]) => {
      try {
        return await ingest(ingestTarget(), batch);
      } catch (error) {
        // A second harvest for the same person is normal, not an error: the engine refuses to
        // guess between people and answers with the exact subject it matched. Reusing that
        // subject keeps the one-shot flow working instead of failing on a duplicate.
        const reuse = reusableSubject(error);
        if (reuse !== undefined) {
          subjectId = reuse.id;
          io.stdout.write(
            `${reuse.displayName} (${reuse.id}) already exists, so this material was added to it.\n`,
          );
          return await ingest({ kind: "existing", subjectId: reuse.id }, batch);
        }
        const candidates = ambiguousCandidates(error);
        if (candidates === undefined) throw error;
        for (const line of describeAmbiguousSubject(options.displayName ?? "", candidates)) {
          io.stdout.write(`${line}\n`);
        }
        throw new Error(
          "More than one subject matches that name. Repeat harvest with --subject <subject-id>.",
          { cause: error },
        );
      }
    };
    const store = async (): Promise<void> => {
      try {
        await saveHarvestState(statePath, recordedState);
      } catch {
        // The record is a local convenience, never evidence: failing to write it must not
        // fail a harvest that already stored its material.
      }
    };
    const recordResult = (
      result: {
        readonly subject: { readonly id: string; readonly displayName: string };
        readonly items: readonly {
          readonly pathLabel: string;
          readonly warnings: readonly string[];
        }[];
      },
      count: number,
      batch: readonly (typeof files)[number][],
    ) => {
      subjectId = result.subject.id;
      ingested += count;
      recordedState = recordHarvest(recordedState, result.subject.id, batch);
      io.stdout.write(
        `Ingested ${String(ingested)}/${String(files.length)} new file(s) as ${result.subject.displayName} (${result.subject.id}).\n`,
      );
      // A file can be stored and still not be usable as evidence: the parser may have skipped
      // parts, refused to split it, or found no text. Those observations must reach the user,
      // or a harvest looks complete while the material is not what they expect.
      for (const item of result.items) {
        if (item.warnings.length === 0) continue;
        io.stdout.write(`  ${item.pathLabel}: ${item.warnings.join(" ")}\n`);
      }
    };
    for (const batch of batches) {
      try {
        recordResult(await ingestWithSubjectReuse(batch), batch.length, batch);
      } catch (error) {
        // A batch can exceed the record budget because one file splits into several records.
        // Retry that batch one file per call so one expanding file cannot lose the others.
        if (!recordBudgetExceeded(error) || batch.length === 1) throw error;
        io.stdout.write(
          "That batch expands past one call's record budget; ingesting its files one at a time.\n",
        );
        for (const file of batch) {
          try {
            recordResult(await ingestWithSubjectReuse([file]), 1, [file]);
          } catch (fileError) {
            const reason = fileError instanceof Error ? fileError.message : "unknown failure";
            failures.push(`${file.pathLabel}: ${reason}`);
            io.stdout.write(`Skipped ${file.pathLabel}: ${reason}\n`);
          }
        }
      }
    }
    await store();
    if (failures.length > 0) {
      throw new Error(
        `${String(failures.length)} of ${String(files.length)} file(s) could not be ingested:\n${failures.join("\n")}`,
      );
    }
  } finally {
    await application.close();
  }
};

/**
 * Resolves a name or id argument to one subject, refusing to guess between candidates.
 *
 * @param distilly - Connected facade owning the local runtime.
 * @param argument - Subject id or display name typed by the operator.
 * @param io - Command output streams, used when a name matches several subjects.
 * @returns The resolved subject summary.
 */
const resolveSubjectArgument = async (
  distilly: Distilly,
  argument: string,
  io: PreviewCliIo,
): Promise<SubjectSummary> => {
  const asId = looksLikeSubjectId(argument);
  const resolution = await distilly.resolve(
    asId
      ? { selector: { kind: "id", subjectId: subjectIdSchema.parse(argument) } }
      : { selector: { kind: "query", query: argument } },
  );
  if (resolution.kind === "found") return resolution.subject;
  if (asId) {
    throw new Error(
      `No subject exists with id ${argument}. Run distilly subjects --host <host> to list what exists.`,
    );
  }
  if (argument.startsWith("subject_")) {
    throw new Error(
      `"${argument}" is not a valid subject id. Run distilly subjects --host <host> to list what exists.`,
    );
  }
  if (resolution.kind === "ambiguous") {
    for (const line of describeAmbiguousSubject(argument, resolution.candidates)) {
      io.stdout.write(`${line}\n`);
    }
    throw new Error(`More than one subject matches "${argument}".`);
  }
  throw new Error(
    `No subject matches "${argument}". Harvest their material first: distilly harvest <directory> --host <host> --name "${argument}".`,
  );
};

/**
 * Prints one profile with its maturity, evidence counts, and missing material.
 *
 * @param args - Subject id or display name, plus optional --host and --json.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runShow = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const [subjectArgument, ...rest] = args;
  if (
    subjectArgument === undefined ||
    subjectArgument.startsWith("--") ||
    subjectArgument.trim().length === 0
  ) {
    throw new Error("This command requires a subject id or display name, then --host <host>.");
  }
  let host: HostName | undefined;
  let asJson = false;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--json") {
      asJson = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") host = parseHost(value);
    else throw new Error(`Unknown show option: ${String(flag)}.`);
    index += 1;
  }
  if (host === undefined) throw new Error("This command requires --host.");
  const application = await openApplication(host, environment);
  try {
    const subject = await resolveSubjectArgument(application.distilly, subjectArgument, io);
    const person = application.distilly.person(subject.id);
    const status = await person.status();
    let profile;
    try {
      profile = await person.get();
    } catch (error) {
      // A harvested person with no committed version is the normal first state, not a fault:
      // report the queued distillation instead of the engine's not-found message.
      if (!(error instanceof DistillyError) || error.code !== "not_found") throw error;
      if (asJson) {
        io.stdout.write(`${JSON.stringify({ profile: null, status }, undefined, 2)}\n`);
        return;
      }
      io.stdout.write(`${describePendingProfile(subject, status).join("\n")}\n`);
      return;
    }
    if (asJson) {
      io.stdout.write(`${JSON.stringify({ profile, status }, undefined, 2)}\n`);
      return;
    }
    const report = describeProfile(profile, status);
    io.stdout.write(`${report.lines.join("\n")}\n`);
  } finally {
    await application.close();
  }
};

/**
 * Lists the people this local store knows about, so no one has to remember an id.
 *
 * @param args - Optional --host, --query, --limit, --cursor, and --json.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runSubjects = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  let host: HostName | undefined;
  let asJson = false;
  const query: { text?: string; limit?: number; cursor?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--json") {
      asJson = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") host = parseHost(value);
    else if (flag === "--query") {
      // An empty filter means "no filter": passing it through would surface a wire error.
      if (value.trim().length > 0) query.text = value;
    } else if (flag === "--cursor") query.cursor = value;
    else if (flag === "--limit") {
      const limit = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit must be positive.");
      query.limit = limit;
    } else {
      throw new Error(`Unknown subjects option: ${String(flag)}.`);
    }
    index += 1;
  }
  if (host === undefined) throw new Error("This command requires --host.");
  const application = await openApplication(host, environment);
  try {
    const page = await application.distilly.list(query);
    if (asJson) {
      io.stdout.write(`${JSON.stringify(page, undefined, 2)}\n`);
      return;
    }
    io.stdout.write(`${describeSubjectList(page, query.text).join("\n")}\n`);
  } finally {
    await application.close();
  }
};

/**
 * Renders one person Skill listing, verified installs first and unverified ones named.
 *
 * @param summaries - Installs found under the host's skills root.
 * @param skillsRoot - Root that was scanned, printed so the operator can check it.
 * @returns Stable report lines.
 */
const describePersonInstalls = (
  summaries: readonly PersonInstallSummary[],
  skillsRoot: string,
): readonly string[] => {
  if (summaries.length === 0) {
    return [
      `No person Skill is installed under ${skillsRoot}.`,
      "Install one with: distilly install <subject-id|display-name> --host <host>",
    ];
  }
  const lines = [`Person Skills under ${skillsRoot}:`];
  for (const summary of summaries) {
    lines.push(
      summary.verified
        ? `  ${summary.install.path} — ${summary.install.subjectId} @ ${summary.install.versionId} (installed ${summary.install.installedAt})`
        : `  ${summary.path} — not a verified Distilly install: ${summary.reason}`,
    );
  }
  return lines;
};

/**
 * Lists the person Skills installed for one host.
 *
 * @param args - Optional --host and --json.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runPersonas = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  let host: HostName | undefined;
  let asJson = false;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--json") {
      asJson = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") host = parseHost(value);
    else throw new Error(`Unknown personas option: ${String(flag)}.`);
    index += 1;
  }
  if (host === undefined) throw new Error("This command requires --host.");
  const summaries = await listPersonInstalls(host, hostHome(host, environment));
  if (asJson) {
    io.stdout.write(`${JSON.stringify({ host, installs: summaries }, undefined, 2)}\n`);
    return;
  }
  const root = summaries.find((summary) => (summary.verified ? true : summary.host === host));
  const skillsRoot =
    root === undefined
      ? "<no skills root found>"
      : root.verified
        ? dirname(root.install.path)
        : dirname(root.path);
  io.stdout.write(`${describePersonInstalls(summaries, skillsRoot).join("\n")}\n`);
};

/**
 * Removes one person Skill without touching the host integration.
 *
 * @param args - Subject id or display name, plus --host.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runRemove = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const [subjectArgument, ...rest] = args;
  if (
    subjectArgument === undefined ||
    subjectArgument.startsWith("--") ||
    subjectArgument.trim().length === 0
  ) {
    throw new Error("This command requires a subject id or display name, then --host <host>.");
  }
  let host: HostName | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") host = parseHost(value);
    else throw new Error(`Unknown remove option: ${String(flag)}.`);
    index += 1;
  }
  if (host === undefined) throw new Error("This command requires --host.");
  const application = await openApplication(host, environment);
  try {
    const subject = await resolveSubjectArgument(application.distilly, subjectArgument, io);
    const summaries = await listPersonInstalls(host, hostHome(host, environment));
    const install = summaries.find(
      (summary): summary is Extract<PersonInstallSummary, { verified: true }> =>
        summary.verified && summary.install.subjectId === subject.id,
    );
    if (install === undefined) {
      const blocked = summaries.find(
        (summary) => !summary.verified && summary.path.includes(String(subject.id).slice(8, 18)),
      );
      if (blocked !== undefined && !blocked.verified) {
        throw new Error(
          `The person Skill at ${blocked.path} is not a verified Distilly install: ${blocked.reason}`,
        );
      }
      throw new Error(
        `${subject.displayName} (${subject.id}) has no installed person Skill for ${host}.`,
      );
    }
    await application.distilly.person(subject.id).uninstall(install.install);
    io.stdout.write(
      `Removed the person Skill for ${subject.displayName} at ${install.install.path}.\n`,
    );
  } finally {
    await application.close();
  }
};

/**
 * Reads a version id argument plus optional flags shared by the version commands.
 *
 * @param rest - Arguments after the subject.
 * @param options - Which flags this command accepts.
 * @param options.withFrom - Whether this command accepts --from.
 * @param options.withReason - Whether this command accepts --reason.
 * @returns Parsed flags.
 */
const versionFlags = (
  rest: readonly string[],
  options: { readonly withFrom?: boolean; readonly withReason?: boolean },
): {
  readonly host?: string;
  readonly to?: string;
  readonly from?: string;
  readonly reason?: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly asJson: boolean;
} => {
  const parsed: {
    host?: string;
    to?: string;
    from?: string;
    reason?: string;
    limit?: number;
    cursor?: string;
    asJson: boolean;
  } = { asJson: false };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--json") {
      parsed.asJson = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${String(flag)}.`);
    if (flag === "--host") parsed.host = value;
    else if (flag === "--to") parsed.to = value;
    else if (flag === "--from" && options.withFrom === true) parsed.from = value;
    else if (flag === "--reason" && options.withReason === true) parsed.reason = value;
    else if (flag === "--cursor") parsed.cursor = value;
    else if (flag === "--limit") {
      const limit = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit must be positive.");
      parsed.limit = limit;
    } else {
      throw new Error(
        `Unknown ${options.withFrom === true ? "diff" : options.withReason === true ? "rollback" : "versions"} option: ${String(flag)}.`,
      );
    }
    index += 1;
  }
  return parsed;
};

/** One resolved subject, host, and open application shared by the version commands. */
interface VersionCommandTarget {
  readonly application: Awaited<ReturnType<typeof openApplication>>;
  readonly subject: SubjectSummary;
  readonly host: HostName;
}

/**
 * Opens the local application and resolves the subject named on the command line.
 *
 * @param args - Subject id or display name plus flags.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 * @param options - Which flags the calling command accepts.
 * @param options.withFrom - Whether this command accepts --from.
 * @param options.withReason - Whether this command accepts --reason.
 * @returns The open application, resolved subject, and host.
 */
const openVersionTarget = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
  options: { readonly withFrom?: boolean; readonly withReason?: boolean },
): Promise<{
  readonly target: VersionCommandTarget;
  readonly flags: ReturnType<typeof versionFlags>;
}> => {
  const [subjectArgument, ...rest] = args;
  if (
    subjectArgument === undefined ||
    subjectArgument.startsWith("--") ||
    subjectArgument.trim().length === 0
  ) {
    throw new Error("This command requires a subject id or display name, then --host <host>.");
  }
  const flags = versionFlags(rest, options);
  if (flags.host === undefined) throw new Error("This command requires --host.");
  const host = parseHost(flags.host);
  const application = await openApplication(host, environment);
  try {
    const subject = await resolveSubjectArgument(application.distilly, subjectArgument, io);
    return { target: { application, subject, host }, flags };
  } catch (error) {
    await application.close();
    throw error;
  }
};

/**
 * Prints one subject's version history.
 *
 * @param args - Subject, --host, and optional paging flags.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runVersions = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const { target, flags } = await openVersionTarget(args, environment, io, {});
  try {
    const page = await target.application.distilly.person(target.subject.id).versions({
      ...(flags.limit === undefined ? {} : { limit: flags.limit }),
      ...(flags.cursor === undefined ? {} : { cursor: flags.cursor }),
    });
    if (flags.asJson) {
      io.stdout.write(`${JSON.stringify(page, undefined, 2)}\n`);
      return;
    }
    io.stdout.write(`${describeVersions(page, target.subject.displayName).join("\n")}\n`);
  } finally {
    await target.application.close();
  }
};

/**
 * Prints the semantic diff between two versions of one subject.
 *
 * @param args - Subject, --host, --from, and --to.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runDiff = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const { target, flags } = await openVersionTarget(args, environment, io, { withFrom: true });
  try {
    if (flags.from === undefined || flags.to === undefined) {
      throw new Error("This command requires --from <version> and --to <version>.");
    }
    const person = target.application.distilly.person(target.subject.id);
    const history = await person.versions({ limit: 200 });
    const before = resolveVersionArgument(history.items, flags.from);
    const after = resolveVersionArgument(history.items, flags.to);
    const diff = await person.diff(before.id, after.id);
    if (flags.asJson) {
      io.stdout.write(
        `${JSON.stringify({ before: before.id, after: after.id, diff }, undefined, 2)}\n`,
      );
      return;
    }
    io.stdout.write(
      `${target.subject.displayName}: ${before.id} -> ${after.id}\n${describeProfileDiff(diff).join("\n")}\n`,
    );
  } finally {
    await target.application.close();
  }
};

/**
 * Restores an earlier version as a new current version, keeping every version immutable.
 *
 * @param args - Subject, --host, --to, and optional --reason.
 * @param environment - Resolved Preview CLI environment.
 * @param io - Command output streams.
 */
const runRollback = async (
  args: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<void> => {
  const { target, flags } = await openVersionTarget(args, environment, io, { withReason: true });
  try {
    if (flags.to === undefined) throw new Error("This command requires --to <version>.");
    const person = target.application.distilly.person(target.subject.id);
    const history = await person.versions({ limit: 200 });
    const target_ = resolveVersionArgument(history.items, flags.to);
    if (target_.status === "current") {
      io.stdout.write(`${target_.id} is already the current version; nothing to roll back.\n`);
      return;
    }
    const reason = flags.reason ?? `User rolled back to ${target_.id} from the distilly CLI.`;
    const rolled = await person.rollback({ versionId: target_.id, reason });
    io.stdout.write(
      `Rolled ${target.subject.displayName} back to ${target_.id}.\nNew current version: ${rolled.id} (${statusLabel(rolled.status)}).\nReason recorded: ${reason}\n`,
    );
  } finally {
    await target.application.close();
  }
};

const help = `Distilly Developer Preview

Usage:
  distilly setup --host codex
  distilly setup --host claude-code|openclaw|hermes|dsh [--allow-unverified-host]
  distilly doctor [--host <host>]
  distilly install <subject-id|display-name> --host <host>
  distilly versions <subject-id|display-name> --host <host> [--limit <n>] [--cursor <cursor>] [--json]
  distilly diff <subject-id|display-name> --host <host> --from <version> --to <version> [--json]
  distilly rollback <subject-id|display-name> --host <host> --to <version> [--reason <text>]
  distilly personas --host <host> [--json]
  distilly remove <subject-id|display-name> --host <host>
  distilly uninstall --host <host>
  distilly panel --host <host>
  distilly subjects --host <host> [--query <text>] [--limit <n>] [--cursor <cursor>] [--json]
  distilly show <subject-id|display-name> --host <host> [--json]
  distilly harvest <directory> --host <host> --subject <subject-id>|--name <display-name>
                   [--sensitivity private|shareable] [--limit <n>] [--force]
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
      throw new Error("This command requires <subject-id|display-name> --host <host>.");
    }
    const host = parseHost(args[2]);
    const application = await openApplication(host, environment);
    try {
      const subject = await resolveSubjectArgument(application.distilly, args[0] ?? "", io);
      const installed = await application.distilly.person(subject.id).install(host);
      io.stdout.write(
        `Installed ${subject.displayName} (${subject.id}) version ${installed.versionId} for ${host} at ${installed.path}.\n`,
      );
    } finally {
      await application.close();
    }
    return 0;
  }
  if (command === "versions") {
    await runVersions(args, environment, io);
    return 0;
  }
  if (command === "diff") {
    await runDiff(args, environment, io);
    return 0;
  }
  if (command === "rollback") {
    await runRollback(args, environment, io);
    return 0;
  }
  if (command === "personas") {
    await runPersonas(args, environment, io);
    return 0;
  }
  if (command === "remove") {
    await runRemove(args, environment, io);
    return 0;
  }
  if (command === "mcp") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    await runMcp(host, environment);
    return 0;
  }
  if (command === "show") {
    await runShow(args, environment, io);
    return 0;
  }
  if (command === "harvest") {
    await runHarvest(args, environment, io);
    return 0;
  }
  if (command === "subjects") {
    await runSubjects(args, environment, io);
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
