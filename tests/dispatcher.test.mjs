/**
 * Entry-point contract: dispatch, bilingual help, JSON receipts, exit codes.
 *
 * Ported/expanded from the CLI half of `tests/test_cli_lifecycle.py`, plus the
 * registration point promised by `docs/v2/CONTRACT.md` §1.
 */

import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PLANNED, listCommands, resolveCommand } from "../src/commands/index.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(projectRoot, "bin", "distilly.mjs");

export function runCli(args, { cwd = projectRoot, env = {} } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function parseReceipt(stdout) {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `no JSON receipt in stdout: ${stdout}`);
  return JSON.parse(stdout.slice(start));
}

test("--help prints one Chinese section, a --- divider and an English section", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /用法：/);
  assert.match(result.stdout, /\n---\n/);
  assert.match(result.stdout, /## English/);
  assert.match(result.stdout, /Usage:/);
});

test("--version prints the package version", () => {
  const result = runCli(["--version"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("an unknown command exits non-zero and is not confused with a planned one", () => {
  const result = runCli(["definitely-not-a-command"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command: definitely-not-a-command/);
});

test("planned commands fail loudly with the owning branch", () => {
  const result = runCli(["harvest", ".", "--json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not implemented/i);
  const receipt = parseReceipt(result.stdout);
  assert.equal(receipt.ok, false);
  assert.equal(receipt.command, "harvest");
  assert.match(receipt.error.remedy, /ds\/02-parse-zero-cred/);
});

test("--json emits a receipt with the contract shape and nothing else on stdout", () => {
  const result = runCli(["skill", "list", "--json"]);
  assert.notEqual(result.status, 0); // still a stub in this build
  const receipt = parseReceipt(result.stdout);
  assert.deepEqual(Object.keys(receipt).slice(0, 8), [
    "command",
    "person",
    "ok",
    "inputs",
    "outputs",
    "anchors",
    "warnings",
    "unavailable",
  ]);
  assert.equal(typeof receipt.ok, "boolean");
  assert.ok(Array.isArray(receipt.inputs));
  assert.ok(Array.isArray(receipt.outputs));
});

test("the registry is the single registration point and prefers two-token names", () => {
  const names = listCommands().map((command) => command.name);
  assert.ok(names.includes("skill create"), `registered: ${names.join(", ")}`);
  assert.deepEqual(resolveCommand(["skill", "create", "--slug", "x"]), {
    name: "skill create",
    rest: ["--slug", "x"],
  });
  assert.deepEqual(resolveCommand(["install", "claude-code"]), {
    name: "install",
    rest: ["claude-code"],
  });
  for (const [name, branch] of Object.entries(PLANNED)) {
    assert.match(branch, /^ds\/\d\d-/);
    assert.ok(!names.includes(name), `${name} should not be registered by this branch yet`);
  }
});

test("every registered command answers --help with bilingual text", () => {
  for (const command of listCommands({ includeHidden: true })) {
    const result = runCli(command.name.split(" ").concat("--help"));
    assert.equal(result.status, 0, `${command.name} --help exited ${result.status}`);
    assert.match(result.stdout, /\n---\n/, `${command.name} help is not bilingual`);
  }
});
