import { lstat, readdir } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";

import { DistillyError } from "@distilly/protocol";

/**
 * Reports whether one ingest call refused the selection for expanding past the record budget.
 *
 * The runtime raises this when the selected files parse into more material records than one
 * call carries, which is not the same failure as an unreadable file: the caller can still make
 * progress by sending fewer files, so it must be recognizable instead of matched by message.
 *
 * @param error - Error thrown by an ingest call.
 * @returns True when the selection must be split into smaller calls.
 */
export const recordBudgetExceeded = (error: unknown): boolean =>
  error instanceof DistillyError &&
  error.code === "invalid_input" &&
  error.details?.["reason"] === "record_budget_exceeded";

/** Why one discovered path was not selected as evidence. */
export type HarvestSkipReason =
  | "credential"
  | "dependency-or-build"
  | "duplicate-name"
  | "hidden"
  | "not-a-regular-file"
  | "symlink"
  | "unsupported-format";

/** One selected regular file, with the label the engine records for it. */
export interface HarvestFile {
  readonly path: string;
  readonly pathLabel: string;
  readonly mediaType: string;
  /** Root-relative path with POSIX separators, used for deterministic ordering. */
  readonly relativePath: string;
  /** Size in bytes, used to decide whether one file must be ingested on its own. */
  readonly sizeBytes: number;
}

/** Complete, deterministic result of selecting evidence from one directory. */
export interface HarvestSelection {
  readonly files: readonly HarvestFile[];
  readonly skipped: Readonly<Partial<Record<HarvestSkipReason, number>>>;
  /** Why each individual path was left out, in walk order, bounded for reporting. */
  readonly skippedEntries: readonly {
    readonly relativePath: string;
    readonly reason: HarvestSkipReason;
  }[];
  readonly directoriesVisited: number;
  /** True when the selection cap stopped the walk before every entry was considered. */
  readonly truncated: boolean;
}

/** How many individual skip reasons one selection keeps for reporting. */
const MAXIMUM_SKIP_DETAILS = 200;

/** Selection limits; a caller may lower them but never silently exceed them. */
export interface HarvestOptions {
  readonly maximumFiles?: number;
}

const DEFAULT_MAXIMUM_FILES = 512;

/** Directory names that hold dependencies, build output, or tool state rather than evidence. */
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".hg",
  ".svn",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

/** Names that hold secrets rather than material, matched case-insensitively. */
const CREDENTIAL_NAMES = new Set([
  ".env",
  ".netrc",
  "auth.json",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ed25519",
  "id_rsa",
  "secrets.json",
  "token.json",
]);

const CREDENTIAL_EXTENSIONS = new Set([".key", ".p12", ".pem", ".pfx"]);

/** Extensions the built-in local parsers accept, mapped to their exact media type. */
const SUPPORTED_EXTENSIONS = new Map<string, string>([
  [".eml", "message/rfc822"],
  [".json", "application/json"],
  [".markdown", "text/markdown"],
  [".mbx", "application/mbox"],
  [".mbox", "application/mbox"],
  [".md", "text/markdown"],
  [".srt", "application/x-subrip"],
  [".txt", "text/plain"],
  [".vtt", "text/vtt"],
]);

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

const isCredentialName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return CREDENTIAL_NAMES.has(lower) || CREDENTIAL_EXTENSIONS.has(extname(lower));
};

/**
 * Selects evidence files from one directory the user explicitly named.
 *
 * The walk is deterministic (entries sorted by UTF-8 bytes of the root-relative path),
 * never follows a symlink, and never leaves the selected root. Every discovered path is
 * either selected or counted under one skip reason, so a caller can report what was left
 * out instead of silently treating it as evidence.
 *
 * @param root - Absolute directory the user selected.
 * @param options - Optional selection cap.
 * @returns Selected files plus the skip tally.
 */
export const selectHarvestFiles = async (
  root: string,
  options: HarvestOptions = {},
): Promise<HarvestSelection> => {
  const maximumFiles = options.maximumFiles ?? DEFAULT_MAXIMUM_FILES;
  const skipped: Partial<Record<HarvestSkipReason, number>> = {};
  const skippedEntries: { relativePath: string; reason: HarvestSkipReason }[] = [];
  const files: HarvestFile[] = [];
  const labels = new Set<string>();
  let directoriesVisited = 0;
  let truncated = false;

  const skip = (reason: HarvestSkipReason, relativePath?: string): void => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
    if (relativePath !== undefined && skippedEntries.length < MAXIMUM_SKIP_DETAILS) {
      skippedEntries.push({ relativePath, reason });
    }
  };

  const walk = async (directory: string): Promise<void> => {
    if (truncated) return;
    directoriesVisited += 1;
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareUtf8(left.name, right.name));
    for (const entry of entries) {
      if (truncated) return;
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).split(sep).join("/");
      if (entry.isSymbolicLink()) {
        // A directory entry for a symlink does not reveal its target, and following it is
        // exactly what this boundary must not do, so every link is reported as one kind.
        skip("symlink", relativePath);
        continue;
      }
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name)) {
          skip("dependency-or-build", relativePath);
          continue;
        }
        await walk(path);
        continue;
      }
      // Credentials are checked first so a dotfile such as `.env` is reported as a
      // credential rather than lumped in with ordinary hidden files.
      if (isCredentialName(entry.name)) {
        skip("credential", relativePath);
        continue;
      }
      if (entry.name.startsWith(".")) {
        skip("hidden", relativePath);
        continue;
      }
      const mediaType = SUPPORTED_EXTENSIONS.get(extname(entry.name).toLowerCase());
      if (mediaType === undefined) {
        skip("unsupported-format", relativePath);
        continue;
      }
      const metadata = await lstat(path).catch(() => undefined);
      if (metadata === undefined || !metadata.isFile() || metadata.isSymbolicLink()) {
        skip("not-a-regular-file", relativePath);
        continue;
      }
      const pathLabel = basename(path);
      if (pathLabel.length === 0 || labels.has(pathLabel)) {
        // The engine records one label per file and rejects duplicates, so a repeated
        // basename is reported rather than silently overwriting another file's evidence.
        skip("duplicate-name", relativePath);
        continue;
      }
      if (files.length >= maximumFiles) {
        truncated = true;
        return;
      }
      labels.add(pathLabel);
      files.push({ path, pathLabel, mediaType, relativePath, sizeBytes: metadata.size });
    }
  };

  await walk(root);
  // The walk already emits entries in order, but a directory boundary can interleave a
  // deeper path before a sibling file, so the final order is fixed explicitly.
  files.sort((left, right) => compareUtf8(left.relativePath, right.relativePath));
  return { files, skipped, skippedEntries, directoriesVisited, truncated };
};

/**
 * Renders the individual files a selection left out, so lost evidence is visible by name.
 *
 * @param selection - Result of one directory selection.
 * @param limit - Largest number of entries to render.
 * @returns One line per skipped path, plus a count when more were left out.
 */
export const describeSkippedEntries = (
  selection: HarvestSelection,
  limit = 20,
): readonly string[] => {
  const lines = selection.skippedEntries
    .slice(0, limit)
    .map((entry) => `  skipped ${entry.relativePath}: ${entry.reason}`);
  const remaining = selection.skippedEntries.length - lines.length;
  if (remaining > 0) lines.push(`  ... and ${String(remaining)} more skipped entry(ies).`);
  return lines;
};

/**
 * Renders a selection report as the exact lines a human reads.
 *
 * @param selection - Result of one directory selection.
 * @returns Stable, sorted report lines.
 */
export const describeHarvestSelection = (selection: HarvestSelection): readonly string[] => {
  const lines = [
    `Selected ${String(selection.files.length)} file(s) from ${String(selection.directoriesVisited)} director(ies).`,
  ];
  const reasons = Object.keys(selection.skipped).sort(compareUtf8) as HarvestSkipReason[];
  for (const reason of reasons) {
    lines.push(`  skipped ${reason}: ${String(selection.skipped[reason] ?? 0)}`);
  }
  if (selection.truncated) {
    lines.push("  selection cap reached; remaining entries were not considered.");
  }
  return lines;
};
