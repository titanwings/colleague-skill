#!/usr/bin/env node
/**
 * Distilly entry point.
 *
 * Contract: `docs/v2/CONTRACT.md` §1 — this is the only user-facing entry. It
 * parses global flags, resolves a subcommand through the registry in
 * `src/commands/index.mjs`, prints a bilingual help screen, and always answers
 * with the receipt shape from §3 when `--json` is set.
 *
 * Adding a command: create `src/commands/<name>.mjs`, call `register(...)` from
 * it, and import that module below. See `docs/v2/NODE-CORE.md`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ArgError, wantsHelp } from "../src/cli/args.mjs";
import { CliError, createReceipt, createReporter } from "../src/cli/receipt.mjs";
// Importing the registry also registers every built-in command module.
import { lookup, missingCommandError, renderHelp, resolveCommand } from "../src/commands/index.mjs";

export const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const packageMetadata = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const version = packageMetadata.version;
const binary = "distilly";

/** Files/directories copied into a host by `install <host>`. */
export const payloadEntries = [
  "SKILL.md",
  "prompts",
  "references",
  "bin",
  "src",
  "assets",
  "scripts",
  "package.json",
  "INSTALL.md",
  "INSTALL_EN.md",
  "LICENSE",
  "CITATION.cff",
];

/** Prepack guard: the published payload must be complete and version-consistent. */
export function validatePayload(root = packageRoot) {
  const missing = payloadEntries.filter((entry) => !existsSync(join(root, entry)));
  if (missing.length > 0) {
    throw new CliError(`package payload is missing: ${missing.join(", ")}`, {
      code: "payload-incomplete",
      remedy: "restore the missing paths or update payloadEntries in bin/distilly.mjs.",
    });
  }

  const skill = readFileSync(join(root, "SKILL.md"), "utf8");
  if (!skill.includes(`version: "${version}"`)) {
    throw new CliError("package.json version does not match SKILL.md", {
      code: "version-mismatch",
      remedy: `set SKILL.md frontmatter version to "${version}" (or bump package.json).`,
    });
  }
}

function failureReceipt(command, error) {
  return createReceipt(command, {
    ok: false,
    error: {
      code: error.code ?? "error",
      message: error.message,
      ...(error.remedy ? { remedy: error.remedy } : {}),
    },
    warnings: [error.message],
  });
}

async function main(argv) {
  // `--json` is global (CONTRACT §1): every subcommand answers with a receipt.
  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  const reporter = createReporter(json);

  if (args.includes("--check-package")) {
    validatePayload();
    reporter.line("Distilly package payload is valid.");
    return 0;
  }

  if (args.includes("--version")) {
    reporter.line(version);
    return 0;
  }

  if (args.length === 0 || args[0] === "help" || wantsHelp(args)) {
    process.stdout.write(renderHelp({ version, binary }));
    return 0;
  }

  const { name, rest } = resolveCommand(args);
  const command = lookup(name);
  if (!command) throw missingCommandError(name);

  if (wantsHelp(rest)) {
    process.stdout.write(`${command.help ?? command.usage}\n`);
    return 0;
  }

  const result = (await command.run({
    argv: rest,
    json,
    reporter,
    ctx: { packageRoot, version, binary },
  })) ?? {};

  const receipt = result.receipt ?? createReceipt(name);
  reporter.finish(receipt);
  if (result.exitCode !== undefined) return result.exitCode;
  return receipt.ok === false ? 1 : 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  const json = process.argv.includes("--json");
  const command = process.argv.slice(2).find((arg) => !arg.startsWith("-")) ?? null;
  const reporter = createReporter(json);
  const failure =
    error instanceof CliError || error instanceof ArgError
      ? error
      : new CliError(error?.message ?? String(error), { code: "unexpected" });

  reporter.warn(`Error: ${failure.message}`);
  if (failure.remedy) reporter.warn(`Remedy: ${failure.remedy}`);
  reporter.finish(failureReceipt(command, failure));
  process.exitCode = failure.exitCode ?? 1;
}
