#!/usr/bin/env node
/**
 * Prompt contract lint (zero dependencies).
 *
 * Scans SKILL.md and prompts/**.md and enforces the prompt-layer contract
 * documented in docs/v2/PROMPTS.md:
 *
 *   command     every `distilly <cmd>` must exist in docs/v2/CONTRACT.md §1
 *   sections    every prompt (and SKILL.md) has 必须/禁止/回执 + MUST/MUST NOT/RECEIPT
 *   bilingual   a `## English` half exists and both halves name the same commands
 *   anchor      anchors are [k00NN] / [k00NN:tM]
 *   forbidden   no shell HTTP client, no Python HTTP library usage,
 *               no literal credential assignment, no `sk-` shaped key
 *   deprecated  every tools/ ... .py or .sh reference is marked deprecated nearby
 *
 * Usage:
 *   node scripts/prompt-lint.mjs [--root <dir>] [--json]
 *
 * Exit codes: 0 = clean, 1 = findings, 2 = the lint itself could not run
 * (missing contract / unparsable command block) — never silently pass.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve, sep } from "node:path";

const RULE_ORDER = [
  "command",
  "sections",
  "bilingual",
  "anchor",
  "forbidden",
  "deprecated",
];

const ANCHOR_TEMPLATES = new Set(["[k00NN]", "[k00NN:tM]"]);
const ANCHOR_VALID = /^\[k\d{4}(:t\d+)?\]$/;
const ANCHOR_CANDIDATE = /\[[kK][0-9:tNMT]+\]/g;
const COMMAND_USE = /distilly[ \t]+([A-Za-z][A-Za-z0-9-]*)/g;

const FORBIDDEN = [
  {
    name: "shell-http-client",
    pattern: /\bcurl\b/i,
    message: "shell HTTP client must not be used; collect through `distilly collect`",
  },
  {
    name: "python-http-library",
    pattern:
      /\bimport\s+requests\b|\bfrom\s+requests\b|\brequests\.(get|post|put|patch|delete|head|options|request|Session)\b/,
    message: "hand-written API calls are forbidden; use `distilly collect`",
  },
  {
    name: "literal-credential",
    pattern:
      /(?:api[_-]?key|apikey|app[_-]?secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|password|passwd|secret|token)["'`]?\s*[:=]\s*["'`][^"'`\s]{3,}["'`]/i,
    message: "a credential literal is written down; read it from ~/.distilly/*_config.json or env",
  },
  {
    name: "key-prefix",
    pattern:
      /\bsk-(?:proj-|ant-|live-|test-|or-)?[A-Za-z0-9]{20,}\b|\bsk-(?:x{3,}|\.{3,}|<[^>]+>|\$\{[^}]+\}|YOUR|your|PLACEHOLDER|placeholder|redacted|REDACTED|abc|1234)/,
    message: "a key-shaped literal is written down; never put credentials in prompts",
  },
];

const ZERO_DEP_MARKER = "distilly";

function fail(message) {
  process.stderr.write(`prompt-lint: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { root: null, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[index + 1];
      if (!options.root) fail("--root requires a directory");
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      fail(`unknown option: ${arg}`);
    }
  }
  return options;
}

/** Command names come from the frozen contract, never from a second list. */
export function parseContractCommands(contractText) {
  const lines = contractText.split("\n");
  const headingIndex = lines.findIndex((line) => /^##\s+1\./.test(line));
  if (headingIndex < 0) return null;
  let fenceStart = -1;
  for (let index = headingIndex; index < lines.length; index += 1) {
    if (/^```/.test(lines[index])) {
      fenceStart = index;
      break;
    }
  }
  if (fenceStart < 0) return null;
  let fenceEnd = -1;
  for (let index = fenceStart + 1; index < lines.length; index += 1) {
    if (/^```/.test(lines[index])) {
      fenceEnd = index;
      break;
    }
  }
  if (fenceEnd < 0) return null;

  const commands = new Set();
  for (const raw of lines.slice(fenceStart + 1, fenceEnd)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const first = line.split(/\s+/)[0];
    if (/^[a-z][a-z0-9-]*$/.test(first)) commands.add(first);
    // `install <host> | uninstall` and `view check | view render` keep the
    // second bare word; angle-bracket groups are placeholders, not commands.
    const withoutPlaceholders = line.replace(/<[^>]*>/g, " ");
    for (const match of withoutPlaceholders.matchAll(/\|\s*([a-z][a-z0-9-]*)\b/g)) {
      commands.add(match[1]);
    }
  }
  return commands.size > 0 ? commands : null;
}

function englishMarkerIndex(lines) {
  return lines.findIndex((line) => /^##\s+English\b/.test(line));
}

function headingMissing(text, marker) {
  const pattern = new RegExp(`^#{2,3}\\s+${marker}\\s*$`, "m");
  return !pattern.test(text);
}

export function lintText({ path, text, commands, isPrompt }) {
  const findings = [];
  const lines = text.split("\n");
  const add = (line, rule, message) =>
    findings.push({ file: path, line: line + 1, rule, message });

  // --- command names -------------------------------------------------------
  lines.forEach((line, index) => {
    for (const match of line.matchAll(COMMAND_USE)) {
      const command = match[1];
      if (!commands.has(command)) {
        add(
          index,
          "command",
          `unknown command \`distilly ${command}\`; not in docs/v2/CONTRACT.md §1 (${[...commands].sort().join(", ")})`,
        );
      }
    }
  });

  // --- forbidden tokens ----------------------------------------------------
  lines.forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) {
        add(index, "forbidden", `${rule.name}: ${rule.message}`);
      }
    }
  });

  // --- anchors -------------------------------------------------------------
  lines.forEach((line, index) => {
    for (const match of line.matchAll(ANCHOR_CANDIDATE)) {
      const token = match[0];
      if (ANCHOR_VALID.test(token) || ANCHOR_TEMPLATES.has(token)) continue;
      add(
        index,
        "anchor",
        `malformed anchor ${token}; use [k00NN] or [k00NN:tM]`,
      );
    }
  });

  // --- deprecated legacy tooling ------------------------------------------
  const nonEmpty = lines.map((line) => line.trim().length > 0);
  lines.forEach((line, index) => {
    if (!/tools\/[\w./-]+\.(py|sh)/.test(line)) return;
    let start = index;
    while (start > 0 && nonEmpty[start - 1]) start -= 1;
    let end = index;
    while (end < lines.length - 1 && nonEmpty[end + 1]) end += 1;
    const paragraph = lines.slice(start, end + 1).join("\n");
    if (!/deprecated/i.test(paragraph)) {
      add(
        index,
        "deprecated",
        "legacy tools/... reference is not marked deprecated in its paragraph",
      );
    }
  });

  // --- bilingual split -----------------------------------------------------
  const marker = englishMarkerIndex(lines);
  const zhText = marker < 0 ? text : lines.slice(0, marker).join("\n");
  const enText = marker < 0 ? "" : lines.slice(marker).join("\n");
  if (marker < 0) {
    add(0, "bilingual", "missing `## English` section (中文段 → --- → ## English)");
  } else {
    const separator = lines
      .slice(Math.max(0, marker - 4), marker)
      .some((line) => /^---\s*$/.test(line));
    if (!separator) {
      add(marker, "bilingual", "`## English` must be preceded by a `---` separator");
    }
    const zhCommands = new Set(
      [...zhText.matchAll(COMMAND_USE)].map((match) => match[1]),
    );
    const enCommands = new Set(
      [...enText.matchAll(COMMAND_USE)].map((match) => match[1]),
    );
    for (const command of [...zhCommands].sort()) {
      if (!enCommands.has(command)) {
        add(
          marker,
          "bilingual",
          `command \`distilly ${command}\` appears only in the Chinese half`,
        );
      }
    }
    for (const command of [...enCommands].sort()) {
      if (!zhCommands.has(command)) {
        add(
          marker,
          "bilingual",
          `command \`distilly ${command}\` appears only in the English half`,
        );
      }
    }
  }

  // --- required sections ---------------------------------------------------
  if (isPrompt || path === "SKILL.md") {
    const at = marker < 0 ? 0 : marker;
    for (const markerText of ["必须", "禁止", "回执"]) {
      if (headingMissing(zhText, markerText)) {
        add(at, "sections", `missing Chinese \`## ${markerText}\` section`);
      }
    }
    for (const markerText of ["MUST", "MUST NOT", "RECEIPT"]) {
      if (headingMissing(enText, markerText)) {
        add(at, "sections", `missing English \`## ${markerText}\` section`);
      }
    }
  }

  return findings;
}

function collectTargets(root) {
  const targets = [];
  const skill = join(root, "SKILL.md");
  if (existsSync(skill)) targets.push({ path: "SKILL.md", isPrompt: false });

  const promptsRoot = join(root, "prompts");
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".md")) {
        targets.push({
          path: relative(root, full).split(sep).join("/"),
          isPrompt: true,
        });
      }
    }
  };
  walk(promptsRoot);
  return targets;
}

export function runLint(root) {
  const contractPath = join(root, "docs", "v2", "CONTRACT.md");
  if (!existsSync(contractPath)) {
    fail(`contract not found at ${contractPath}`);
  }
  const commands = parseContractCommands(readFileSync(contractPath, "utf8"));
  if (!commands) {
    fail(`could not parse the §1 command block from ${contractPath}`);
  }

  const targets = collectTargets(root);
  if (targets.length === 0) {
    fail(`no SKILL.md or prompts/**/*.md found under ${root}`);
  }

  const findings = [];
  for (const target of targets) {
    const text = readFileSync(join(root, target.path), "utf8");
    findings.push(
      ...lintText({ path: target.path, text, commands, isPrompt: target.isPrompt }),
    );
  }

  findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      RULE_ORDER.indexOf(left.rule) - RULE_ORDER.indexOf(right.rule) ||
      left.message.localeCompare(right.message),
  );

  return {
    commands: [...commands].sort(),
    files: targets.map((target) => target.path),
    findings,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      [
        "prompt-lint — prompt contract lint (zero dependencies)",
        "",
        "Usage: node scripts/prompt-lint.mjs [--root <dir>] [--json]",
        "",
        `Contract commands: parsed from docs/v2/CONTRACT.md §1 at run time (${ZERO_DEP_MARKER}).`,
        "",
      ].join("\n"),
    );
    return;
  }

  const root = resolve(
    options.root ?? fileURLToPath(new URL("..", import.meta.url)),
  );
  const result = runLint(root);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ root, ok: result.findings.length === 0, ...result }, null, 2)}\n`,
    );
  } else {
    for (const finding of result.findings) {
      process.stdout.write(
        `${finding.file}:${finding.line} ${finding.rule} ${finding.message}\n`,
      );
    }
    const filesWithFindings = new Set(result.findings.map((f) => f.file)).size;
    process.stdout.write(
      `prompt-lint: ${result.findings.length} finding(s) in ${filesWithFindings} file(s) across ${result.files.length} file(s) scanned (contract commands: ${result.commands.length})\n`,
    );
  }

  if (result.findings.length > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
