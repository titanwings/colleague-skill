/**
 * `distilly legacy <tool> [args...]` — migration adapter (CONTRACT §1).
 *
 * Translates the old `python3 tools/*.py` command lines onto the new
 * subcommands and prints a deprecation warning. It is deleted again in PR③
 * once the last Python entry point is gone and `SKILL.md` calls the CLI.
 */

import { register } from "./index.mjs";
import { CliError } from "../cli/receipt.mjs";

function pending() {
  throw new CliError("the legacy python3 tools/*.py adapter is not implemented in this build yet", {
    code: "not-implemented",
    remedy: "lands with the writer port in ds/01-node-core; see docs/v2/NODE-CORE.md.",
  });
}

function legacyHelp(binary = "distilly") {
  const zh = [
    "用法（迁移期）：",
    `  ${binary} legacy tools/skill_writer.py --action create --slug <slug> [...]`,
    `  ${binary} legacy tools/version_manager.py --action rollback --slug <slug> --version v1 [...]`,
    `  ${binary} legacy tools/install_generated_skill.py --skill-dir <dir> --host <host> [...]`,
    "",
    "说明：参数会原样翻译到 `skill create|update|list|version`、`install`；",
    "命令会向 stderr 打印弃用警告，退出码与目标子命令一致。",
  ].join("\n");
  const en = [
    "Usage (migration window):",
    `  ${binary} legacy tools/skill_writer.py --action create --slug <slug> [...]`,
    `  ${binary} legacy tools/version_manager.py --action rollback --slug <slug> --version v1 [...]`,
    `  ${binary} legacy tools/install_generated_skill.py --skill-dir <dir> --host <host> [...]`,
    "",
    "Arguments are translated onto `skill create|update|list|version` and `install`;",
    "a deprecation warning goes to stderr and the exit code matches the target subcommand.",
  ].join("\n");
  return { zh, en };
}

register("legacy", {
  summary: "旧 python3 tools/*.py 入口转发 / Forward legacy python3 tools/*.py calls",
  usage: "distilly legacy <tool.py> [--action ...] [options]",
  hidden: true,
  ...legacyHelp(),
  run: () => pending(),
});
