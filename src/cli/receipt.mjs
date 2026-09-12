/**
 * CLI receipts, output routing and file fingerprints.
 *
 * The receipt shape is frozen by `docs/v2/CONTRACT.md` §3:
 * `{command, person, ok, inputs, outputs, anchors, warnings, unavailable}`.
 * Every entry in `inputs`/`outputs` carries `{path, sha256, bytes}`.
 *
 * `--json` writes the receipt to stdout as the only stdout content (human text
 * moves to stderr) so `JSON.parse(stdout)` always succeeds.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

/** User-facing failure with an explicit remedy. */
export class CliError extends Error {
  constructor(message, { code = "error", remedy = "", exitCode = 1 } = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.remedy = remedy;
    this.exitCode = exitCode;
  }
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sha256Text(text) {
  return sha256Buffer(Buffer.from(text, "utf8"));
}

/** `{path, sha256, bytes}` for a file, or null when it is missing. */
export function describeFile(filePath, { cwd = process.cwd() } = {}) {
  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    return null;
  }
  return {
    path: displayPath(filePath, cwd),
    sha256: sha256Buffer(buffer),
    bytes: buffer.length,
  };
}

/** `{path, bytes}` without hashing (used for directories and removals). */
export function describePath(filePath, { cwd = process.cwd() } = {}) {
  return { path: displayPath(filePath, cwd), bytes: directoryBytes(filePath) };
}

export function directoryBytes(dirPath) {
  try {
    return statSync(dirPath).size;
  } catch {
    return 0;
  }
}

/** Paths inside the working directory are reported relatively, like the old CLI. */
export function displayPath(filePath, cwd = process.cwd()) {
  const absolute = resolve(filePath);
  const rel = relative(resolve(cwd), absolute);
  if (rel === "") return ".";
  if (!rel.startsWith("..") && !rel.startsWith(`${sep}..`)) return rel;
  return absolute;
}

/** Build the contract receipt object (field order is contractual). */
export function createReceipt(command, options = {}) {
  const receipt = {
    command,
    person: options.person ?? null,
    ok: options.ok ?? true,
    inputs: options.inputs ?? [],
    outputs: options.outputs ?? [],
    anchors: options.anchors ?? { total: 0, cited: 0 },
    warnings: options.warnings ?? [],
    unavailable: options.unavailable ?? [],
  };
  if (options.error) receipt.error = options.error;
  return receipt;
}

/**
 * Route human text and machine receipts.
 * In `--json` mode stdout carries exactly one JSON object; prose goes to stderr.
 */
export function createReporter(json, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const lines = [];
  return {
    json,
    line(text) {
      lines.push(text);
      if (json) stderr.write(`${text}\n`);
      else stdout.write(`${text}\n`);
    },
    warn(text) {
      stderr.write(`${text}\n`);
    },
    /** Write the receipt last so `JSON.parse(stdout)` sees a single object. */
    finish(receipt) {
      if (!json) return;
      stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    },
  };
}
