/**
 * `distilly install <host>` / `distilly uninstall [<host>|--path <dir>]`.
 *
 * Host directories come from the shared matrix in `src/hosts/agents.mjs`; the
 * copy / verify / remove actions live in `src/install/hosts.mjs` (the merged
 * port of the eight `tools/install_*.py` scripts).
 */

import { register } from "./index.mjs";
import { CliError } from "../cli/receipt.mjs";

function pending() {
  throw new CliError("install/uninstall are not implemented in this build yet", {
    code: "not-implemented",
    remedy:
      "the merged host installer lands in the next commits of ds/01-node-core; see docs/v2/NODE-CORE.md.",
  });
}

function installHelp(binary = "distilly") {
  const zh = [
    "用法：",
    `  ${binary} install <host> [--force] [--dry-run] [--no-backup]`,
    `  ${binary} install --path <以 distilly 结尾的目录> [--force]`,
    "",
    "宿主 <host>（目录取自 src/hosts/agents.mjs，不猜路径）：",
    "  claude-code, openclaw, hermes, codex, deepseek-harness, grok-build, opencode, pi",
    "别名：claude → claude-code，deepseek → deepseek-harness，grok → grok-build",
    "",
    "选项：",
    "  --force      覆盖已存在的安装（默认先把旧副本改名备份）",
    "  --no-backup  覆盖时直接删除旧副本，不保留备份",
    "  --dry-run    只解析目标路径，不写盘",
    `  --path       自定义安装目录（最后一级必须叫 distilly）`,
    "",
    `卸载：${binary} uninstall <host>|--path <dir> [--force] [--dry-run]`,
  ].join("\n");
  const en = [
    "Usage:",
    `  ${binary} install <host> [--force] [--dry-run] [--no-backup]`,
    `  ${binary} install --path <dir-ending-in-distilly> [--force]`,
    "",
    "Hosts (paths come from src/hosts/agents.mjs, nothing is guessed):",
    "  claude-code, openclaw, hermes, codex, deepseek-harness, grok-build, opencode, pi",
    "Aliases: claude → claude-code, deepseek → deepseek-harness, grok → grok-build",
    "",
    "Options:",
    "  --force      replace an existing install (the old copy is renamed to a timestamped backup first)",
    "  --no-backup  with --force, delete the old copy instead of keeping a backup",
    "  --dry-run    resolve the target path without writing",
    "  --path       custom install directory whose final segment is distilly",
    "",
    `Uninstall: ${binary} uninstall <host>|--path <dir> [--force] [--dry-run]`,
  ].join("\n");
  return { zh, en };
}

register("install", {
  summary: "安装到宿主目录 / Install Distilly into a host skills directory",
  usage: "distilly install <host|--path <dir>> [--force] [--dry-run]",
  ...installHelp(),
  run: () => pending(),
});

register("uninstall", {
  summary: "卸载 / Remove an installed Distilly from a host directory",
  usage: "distilly uninstall [<host>|--path <dir>] [--force] [--dry-run]",
  ...installHelp(),
  run: () => pending(),
});
