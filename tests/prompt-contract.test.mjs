/**
 * Prompt contract test.
 *
 * Drives scripts/prompt-lint.mjs with node --test (zero dependencies):
 *   - the real repository tree must lint clean
 *   - the contract command table is parsed from docs/v2/CONTRACT.md §1
 *   - three negative fixtures built in a temp directory must be caught:
 *       unknown `distilly <cmd>`, a missing 禁止/MUST NOT section,
 *       and a command that appears in only one language half
 *   - the CLI must exit non-zero and print file:line for every finding
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseContractCommands, runLint } from "../scripts/prompt-lint.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const lintPath = join(repoRoot, "scripts", "prompt-lint.mjs");
const contractPath = join(repoRoot, "docs", "v2", "CONTRACT.md");

const REQUIRED_COMMANDS = [
  "collect",
  "consent",
  "doctor",
  "harvest",
  "install",
  "note",
  "parse-archive",
  "parse-chat",
  "parse-doc",
  "parse-email",
  "parse-subtitle",
  "retrospect",
  "skill",
  "transcribe",
  "uninstall",
  "view",
];

function bilingualPrompt({ heading, zhBody, enBody }) {
  return `# ${heading}

## 必须

${zhBody}

## 禁止

- 禁止无证据推断。

## 回执

- 读过哪些文件。

---

## English

## MUST

${enBody}

## MUST NOT

- No inference.

## RECEIPT

- Files read.
`;
}

const GOOD_PROMPT = bilingualPrompt({
  heading: "好的 prompt",
  zhBody: "- 先跑 `distilly retrospect`，再读派生文件。",
  enBody: "- Run `distilly retrospect` before reading derived files.",
});

const BAD_COMMAND_PROMPT = bilingualPrompt({
  heading: "命令名不存在",
  zhBody: "- 先跑 `distilly frobnicate`。",
  enBody: "- Run `distilly frobnicate` first.",
});

const MISSING_PROHIBITION_PROMPT = `# 缺禁止段

## 必须

- 先跑 \`distilly retrospect\`。

## 回执

- 读过哪些文件。

---

## English

## MUST

- Run \`distilly retrospect\` first.

## RECEIPT

- Files read.
`;

const HALF_COMMAND_PROMPT = bilingualPrompt({
  heading: "双语命令集合不一致",
  zhBody: "- 先跑 `distilly retrospect`。",
  enBody: "- Restate what was read before writing conclusions.",
});

function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), "prompt-lint-"));
  mkdirSync(join(root, "docs", "v2"), { recursive: true });
  mkdirSync(join(root, "prompts"), { recursive: true });
  cpSync(contractPath, join(root, "docs", "v2", "CONTRACT.md"));
  writeFileSync(join(root, "prompts", "good.md"), GOOD_PROMPT);
  writeFileSync(join(root, "prompts", "bad-command.md"), BAD_COMMAND_PROMPT);
  writeFileSync(
    join(root, "prompts", "missing-prohibition.md"),
    MISSING_PROHIBITION_PROMPT,
  );
  writeFileSync(join(root, "prompts", "half-command.md"), HALF_COMMAND_PROMPT);
  return root;
}

function findingsFor(result, file) {
  return result.findings.filter((finding) => finding.file === file);
}

test("the contract command block is the single source of truth", () => {
  const commands = parseContractCommands(readFileSync(contractPath, "utf8"));
  assert.ok(commands, "the §1 command block must parse");
  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commands.has(command), `contract must define \`distilly ${command}\``);
  }
  assert.equal(
    commands.size,
    REQUIRED_COMMANDS.length,
    "unexpected extra command in the contract block — update the prompts and this test together",
  );
});

test("the repository tree lints clean (positive case)", () => {
  const result = runLint(repoRoot);
  assert.deepEqual(
    result.findings,
    [],
    `expected zero findings, got:\n${result.findings
      .map((finding) => `${finding.file}:${finding.line} ${finding.rule} ${finding.message}`)
      .join("\n")}`,
  );
  assert.ok(result.files.length >= 20, "SKILL.md + every prompt must be scanned");
  assert.ok(result.files.includes("SKILL.md"));
  assert.ok(result.files.includes("prompts/collectors.md"));
  assert.ok(result.files.includes("prompts/retrospection.md"));
  assert.ok(result.files.includes("prompts/computer-use.md"));
});

test("negative fixtures: the three contract violations are caught", (t) => {
  const root = buildFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = runLint(root);

  // 1. a command name that does not exist in the contract table
  const commandFindings = findingsFor(result, "prompts/bad-command.md").filter(
    (finding) => finding.rule === "command",
  );
  assert.ok(commandFindings.length >= 1, "unknown command must be reported");
  assert.match(commandFindings[0].message, /frobnicate/);
  assert.ok(commandFindings[0].line >= 1, "findings must carry a line number");

  // 2. a missing 禁止 / MUST NOT section
  const sectionFindings = findingsFor(
    result,
    "prompts/missing-prohibition.md",
  ).filter((finding) => finding.rule === "sections");
  const sectionMessages = sectionFindings.map((finding) => finding.message).join("\n");
  assert.match(sectionMessages, /## 禁止/, "missing Chinese 禁止 must be reported");
  assert.match(sectionMessages, /## MUST NOT/, "missing English MUST NOT must be reported");

  // 3. the two language halves name different command sets
  const bilingualFindings = findingsFor(result, "prompts/half-command.md").filter(
    (finding) => finding.rule === "bilingual",
  );
  assert.equal(bilingualFindings.length, 1, "exactly one half-sided command");
  assert.match(bilingualFindings[0].message, /distilly retrospect/);
  assert.match(bilingualFindings[0].message, /Chinese half/);

  // the control fixture stays clean
  assert.deepEqual(findingsFor(result, "prompts/good.md"), []);
});

test("the CLI exits non-zero and prints file:line for every finding", (t) => {
  const root = buildFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const failing = spawnSync(process.execPath, [lintPath, "--root", root], {
    encoding: "utf8",
  });
  assert.equal(failing.status, 1, "findings must exit non-zero");
  assert.match(failing.stdout, /prompts\/bad-command\.md:\d+ command /);
  assert.match(failing.stdout, /prompts\/missing-prohibition\.md:\d+ sections /);
  assert.match(failing.stdout, /prompts\/half-command\.md:\d+ bilingual /);
  assert.match(failing.stdout, /prompt-lint: \d+ finding\(s\)/);

  const passing = spawnSync(process.execPath, [lintPath, "--root", repoRoot], {
    encoding: "utf8",
  });
  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  assert.match(passing.stdout, /prompt-lint: 0 finding\(s\)/);
});

test("the CLI fails loudly when the contract is missing", (t) => {
  const root = mkdtempSync(join(tmpdir(), "prompt-lint-empty-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [lintPath, "--root", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2, "a missing contract must not silently pass");
  assert.match(result.stderr, /contract not found/);
});
