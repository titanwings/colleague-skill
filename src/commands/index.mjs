/**
 * Command registry — the single registration point for the Distilly CLI.
 *
 * `bin/distilly.mjs` only parses global flags and dispatches; every subcommand
 * lives in its own module under `src/commands/` and registers itself here:
 *
 * ```js
 * import { register } from "./index.mjs";
 * register("skill create", {
 *   summary: "创建一个 Skill / Create a Skill",
 *   usage: "distilly skill create [options]",
 *   options: {...},                        // src/cli/args.mjs spec, for automatic usage
 *   run: async ({ flags, positionals, json, reporter, ctx }) => ({ receipt, lines }),
 * });
 * ```
 *
 * A definition returns `{receipt, lines, exitCode?}`; throwing `CliError` is the
 * supported way to fail loudly with a remedy. See `docs/v2/NODE-CORE.md`.
 *
 * Names may contain one space (`view check`, `skill create`); dispatch prefers
 * the two-token name. Commands promised by `docs/v2/CONTRACT.md` §1 but not yet
 * implemented are listed in `PLANNED` together with the branch that owns them,
 * so an unfinished build reports "not implemented" instead of "unknown command".
 */

import { CliError } from "../cli/receipt.mjs";

/**
 * The registry is created lazily: `index.mjs` imports the built-in command
 * modules at the bottom of this file, and those modules call `register()` while
 * this module is still being evaluated (an ES module import cycle). A lazily
 * created Map keeps that safe, and every accessor below goes through it.
 */
// `var` (not `let`) on purpose: it is hoisted before module evaluation, so the
// built-in command modules can call `register()` during the import cycle.
var registryInstance;

function registry() {
  if (!registryInstance) registryInstance = new Map();
  return registryInstance;
}

/** Commands frozen in CONTRACT §1 whose implementation ships in another branch. */
export const PLANNED = {
  harvest: "ds/02-parse-zero-cred",
  "parse-chat": "ds/02-parse-zero-cred",
  "parse-email": "ds/02-parse-zero-cred",
  "parse-subtitle": "ds/02-parse-zero-cred",
  "parse-doc": "ds/02-parse-zero-cred",
  "parse-archive": "ds/02-parse-zero-cred",
  retrospect: "ds/06-retrospect",
  collect: "ds/07-keys-and-schema",
  transcribe: "ds/07-keys-and-schema",
  note: "ds/02-parse-zero-cred",
  consent: "ds/07-keys-and-schema",
  view: "ds/03-render",
};

/**
 * Register one subcommand. Duplicate names are a programming error and throw.
 * @param {string} name
 * @param {{summary: string, usage: string, options?: object, run: Function, hidden?: boolean}} definition
 */
export function register(name, definition) {
  if (registry().has(name)) throw new Error(`command already registered: ${name}`);
  if (typeof definition?.run !== "function") {
    throw new Error(`command ${name} needs a run() function`);
  }
  registry().set(name, { name, hidden: false, options: {}, ...definition });
  return definition;
}

export function lookup(name) {
  return registry().get(name) ?? null;
}

export function listCommands({ includeHidden = false } = {}) {
  return [...registry().values()]
    .filter((command) => includeHidden || !command.hidden)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Split argv into a command name and its remaining arguments.
 * Two-token names win over one-token names (`view check` before `view`).
 */
export function resolveCommand(tokens) {
  if (tokens.length >= 2) {
    const twoToken = `${tokens[0]} ${tokens[1]}`;
    if (registry().has(twoToken)) return { name: twoToken, rest: tokens.slice(2) };
  }
  if (tokens.length >= 1 && registry().has(tokens[0])) {
    return { name: tokens[0], rest: tokens.slice(1) };
  }
  return { name: tokens[0] ?? null, rest: tokens.slice(1) };
}

/** `null` when the command is registered, otherwise a loud, actionable error. */
export function missingCommandError(name) {
  const branch = PLANNED[name] ?? PLANNED[`${name} ${""}`.trim()];
  if (branch) {
    return new CliError(`command not implemented in this build: ${name}`, {
      code: "not-implemented",
      remedy: `${name} is delivered by branch ${branch} (see docs/v2/STATUS.md); this branch (ds/01-node-core) ships skill/install/uninstall/doctor only.`,
    });
  }
  return new CliError(`unknown command: ${name}`, {
    code: "unknown-command",
    remedy: "run `distilly --help` for the command list.",
  });
}

/**
 * Single-file bilingual text (CONTRACT §6): 中文段 → `---` → `## English`.
 * @param {string} zh
 * @param {string} en
 */
export function bilingual(zh, en) {
  return `${zh}\n\n---\n\n## English\n\n${en}`;
}

/** Terminal columns for one string (CJK counts as two), used for help tables. */
export function displayWidth(text) {
  let width = 0;
  for (const character of text) {
    const code = character.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x3fffd);
    width += wide ? 2 : 1;
  }
  return width;
}

/** Pad to `width` terminal columns so bilingual help tables line up. */
export function padDisplay(text, width) {
  const padding = Math.max(1, width - displayWidth(text));
  return `${text}${" ".repeat(padding)}`;
}

const CATALOG_ZH = [
  ["skill create|update|list|version", "创建 / 更新 / 列出 / 归档 Skill（本分支）"],
  ["install <host>", "把 Distilly 装进某个宿主的 skills 目录（本分支）"],
  ["uninstall [<host>|--path]", "卸载已安装的 Distilly（本分支）"],
  ["doctor", "宿主与 Skill 库存体检（本分支，最小版）"],
];

const CATALOG_EN = [
  ["skill create|update|list|version", "create / update / list / archive Skills (this branch)"],
  ["install <host>", "install Distilly into a host skills directory (this branch)"],
  ["uninstall [<host>|--path]", "remove an installed Distilly (this branch)"],
  ["doctor", "host and skill inventory health check (this branch, minimal)"],
];

/** Bilingual help for the whole CLI (CONTRACT §6: 中文 → `---` → English). */
export function renderHelp({ version, binary = "distilly" } = {}) {
  const implemented = listCommands();
  const plannedNames = Object.keys(PLANNED).sort();

  const zh = [
    `Distilly ${version}`,
    "",
    "用法：",
    `  ${binary} <命令> [选项]`,
    `  ${binary} --help | --version`,
    "",
    "已实现：",
    ...implemented.map((command) => `  ${padDisplay(command.usage, 48)}${command.summary.split(" / ")[0]}`),
    "",
    "契约中已冻结、由其他分支交付：",
    `  ${plannedNames.join(", ")}`,
    "",
    "全局选项：",
    "  --json     以 JSON 回执输出（stdout 只有回执；人读信息走 stderr）",
    "  --help     显示帮助",
    "  --version  打印版本",
    "",
    "示例：",
    `  ${binary} skill create --character colleague --name "Zadie Smith" --work work.md --persona persona.md`,
    `  ${binary} skill list --character colleague`,
    `  ${binary} install claude-code --json`,
  ].join("\n");

  const en = [
    `Distilly ${version}`,
    "",
    "Usage:",
    `  ${binary} <command> [options]`,
    `  ${binary} --help | --version`,
    "",
    "Implemented:",
    ...implemented.map((command) => `  ${padDisplay(command.usage, 48)}${command.summary.split(" / ")[1] ?? command.summary}`),
    "",
    "Frozen by the contract, delivered by other branches:",
    `  ${plannedNames.join(", ")}`,
    "",
    "Global options:",
    "  --json     emit a JSON receipt (stdout holds only the receipt; prose goes to stderr)",
    "  --help     show this help",
    "  --version  print the package version",
    "",
    "Examples:",
    `  ${binary} skill create --character colleague --name "Zadie Smith" --work work.md --persona persona.md`,
    `  ${binary} skill list --character colleague`,
    `  ${binary} install claude-code --json`,
  ].join("\n");

  const catalogZh = ["命令总览：", ...CATALOG_ZH.map(([usage, text]) => `  ${padDisplay(usage, 48)}${text}`)].join("\n");
  const catalogEn = [
    "Command catalog:",
    ...CATALOG_EN.map(([usage, text]) => `  ${padDisplay(usage, 48)}${text}`),
  ].join("\n");

  return `${zh}\n\n${catalogZh}\n\n---\n\n## English\n\n${en}\n\n${catalogEn}\n`;
}

/** Usage string for one command, built from its registered options. */
export function renderCommandHelp(command, { binary = "distilly" } = {}) {
  return `${command.usage.replace(/^distilly/, binary)}\n\n${command.help ?? ""}`.trimEnd();
}

// Built-in commands register themselves on import. New commands are added by
// creating `src/commands/<name>.mjs` and listing it here — the only place the
// dispatcher needs to know about (see docs/v2/NODE-CORE.md).
import "./skill.mjs";
import "./install.mjs";
import "./doctor.mjs";
import "./legacy.mjs";
