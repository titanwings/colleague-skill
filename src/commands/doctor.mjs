/**
 * `distilly doctor` — minimal inventory health check.
 *
 * Reports what actually exists on disk (host installs, generated Skills,
 * knowledge ledgers) and lists what it cannot check yet in `unavailable`.
 * Nothing is silently skipped; see CONTRACT §3.
 */

import { register } from "./index.mjs";
import { CliError } from "../cli/receipt.mjs";

function pending() {
  throw new CliError("doctor is not implemented in this build yet", {
    code: "not-implemented",
    remedy:
      "the inventory check lands in the next commits of ds/01-node-core; see docs/v2/NODE-CORE.md.",
  });
}

function doctorHelp(binary = "distilly") {
  const zh = [
    "用法：",
    `  ${binary} doctor [--base-dir <dir>] [--json]`,
    "",
    "检查项（最小版）：",
    "  1. 宿主矩阵里每个宿主是否已安装 Distilly（路径、SKILL.md 版本）；",
    "  2. 生成的 Skill 清单（skills/<family>/<slug>，含版本与 corrections）；",
    "  3. 账本覆盖率：有 knowledge/index.json 时统计条目与字节数；",
    "  4. 未实现能力（parse/view/collect 等）写进回执的 unavailable，不静默跳过。",
  ].join("\n");
  const en = [
    "Usage:",
    `  ${binary} doctor [--base-dir <dir>] [--json]`,
    "",
    "Checks (minimal):",
    "  1. whether Distilly is installed for each host in the shared matrix (path, SKILL.md version);",
    "  2. the generated Skill inventory (skills/<family>/<slug> with version and corrections);",
    "  3. ledger coverage: entry and byte counts whenever knowledge/index.json exists;",
    "  4. capabilities this build cannot run yet (parse/view/collect …) are reported in the receipt's unavailable list, never skipped silently.",
  ].join("\n");
  return { zh, en };
}

register("doctor", {
  summary: "体检宿主与 Skill 库存 / Health-check hosts and skill inventory",
  usage: "distilly doctor [--base-dir <dir>] [--json]",
  ...doctorHelp(),
  run: () => pending(),
});
