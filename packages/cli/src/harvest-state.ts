import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { HarvestFile } from "./harvest.js";

/** One file this store already ingested for one subject, identified by its bytes. */
export interface HarvestStateEntry {
  /** Absolute path the bytes were read from. */
  readonly path: string;
  /** SHA-256 of the exact bytes that were ingested. */
  readonly sha256: string;
  /** Byte length when it was ingested, so an unchanged file needs no second read. */
  readonly sizeBytes: number;
}

/** Local record of what harvest already ingested, so a second run adds no duplicate evidence. */
export interface HarvestState {
  readonly version: 1;
  readonly entries: Readonly<Record<string, readonly HarvestStateEntry[]>>;
}

/** The empty state used when no record exists yet or the record is unreadable. */
export const EMPTY_HARVEST_STATE: HarvestState = Object.freeze({
  version: 1,
  entries: Object.freeze({}),
});

/**
 * Reads the harvest record, treating any unreadable or malformed file as "nothing recorded".
 *
 * The record is a cache of local decisions, never evidence: a corrupt or hand-edited file must
 * make harvest ingest everything again rather than fail the command or skip real material.
 *
 * @param path - State file path.
 * @returns Parsed state, or the empty state.
 */
export const loadHarvestState = async (path: string): Promise<HarvestState> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return EMPTY_HARVEST_STATE;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return EMPTY_HARVEST_STATE;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return EMPTY_HARVEST_STATE;
  }
  const record = value as { readonly version?: unknown; readonly entries?: unknown };
  if (record.version !== 1 || typeof record.entries !== "object" || record.entries === null) {
    return EMPTY_HARVEST_STATE;
  }
  const entries: Record<string, HarvestStateEntry[]> = {};
  for (const [subjectId, list] of Object.entries(record.entries as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const parsed: HarvestStateEntry[] = [];
    for (const item of list) {
      if (typeof item !== "object" || item === null) continue;
      const entry = item as { path?: unknown; sha256?: unknown; sizeBytes?: unknown };
      if (
        typeof entry.path !== "string" ||
        typeof entry.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(entry.sha256) ||
        typeof entry.sizeBytes !== "number" ||
        !Number.isSafeInteger(entry.sizeBytes)
      ) {
        continue;
      }
      parsed.push({ path: entry.path, sha256: entry.sha256, sizeBytes: entry.sizeBytes });
    }
    if (parsed.length > 0) entries[subjectId] = parsed;
  }
  return { version: 1, entries };
};

/**
 * Writes the harvest record atomically, so an interrupted run cannot leave half a record.
 *
 * @param path - State file path.
 * @param state - Record to persist.
 */
export const saveHarvestState = async (path: string, state: HarvestState): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${String(process.pid)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, undefined, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
};

/**
 * Hashes one file's exact bytes.
 *
 * @param path - Absolute file path.
 * @returns Lowercase hexadecimal SHA-256.
 */
export const hashFile = async (path: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

/** One selected file together with the digest of the bytes that will be ingested. */
export interface HashedHarvestFile extends HarvestFile {
  readonly sha256: string;
}

/** What one harvest run should ingest and what it can skip as already recorded. */
export interface HarvestDedupePlan {
  readonly ingest: readonly HashedHarvestFile[];
  readonly alreadyIngested: readonly HashedHarvestFile[];
}

/**
 * Splits a selection into files this subject already has and files it still needs.
 *
 * A file counts as already ingested only when the recorded bytes hash to the same digest, so
 * an edited file with the same size is still ingested. A file recorded for a different subject
 * is always ingested: two people may own byte-identical material on purpose.
 *
 * @param files - Selected files with their digests.
 * @param entries - Recorded entries for the target subject.
 * @returns The files to ingest and the files already present.
 */
export const planHarvest = (
  files: readonly HashedHarvestFile[],
  entries: readonly HarvestStateEntry[],
): HarvestDedupePlan => {
  const recorded = new Map(entries.map((entry) => [resolve(entry.path), entry.sha256] as const));
  const ingest: HashedHarvestFile[] = [];
  const alreadyIngested: HashedHarvestFile[] = [];
  for (const file of files) {
    const previous = recorded.get(resolve(file.path));
    if (previous !== undefined && previous === file.sha256) alreadyIngested.push(file);
    else ingest.push(file);
  }
  return { ingest, alreadyIngested };
};

/**
 * Records the files one ingest call stored for a subject, replacing earlier entries per path.
 *
 * @param state - Current record.
 * @param subjectId - Subject the call ingested into.
 * @param files - Files that call stored, with their digests.
 * @returns A new record with those entries updated.
 */
export const recordHarvest = (
  state: HarvestState,
  subjectId: string,
  files: readonly HashedHarvestFile[],
): HarvestState => {
  const existing = (state.entries[subjectId] ?? []).filter(
    (entry) => !files.some((file) => resolve(file.path) === resolve(entry.path)),
  );
  const added = files.map((file) => ({
    path: resolve(file.path),
    sha256: file.sha256,
    sizeBytes: file.sizeBytes,
  }));
  return {
    version: 1,
    entries: { ...state.entries, [subjectId]: [...existing, ...added] },
  };
};
