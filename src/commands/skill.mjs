/**
 * `distilly skill ...` — create / update / list / archive generated Skills.
 *
 * This module owns the argument surface; the behaviour lives in `src/skill/*`
 * (presets, schema, writer, versions), which is a direct port of
 * `tools/skill_presets.py`, `tools/skill_schema.py`, `tools/skill_writer.py`
 * and `tools/version_manager.py`.
 */

import { register } from "./index.mjs";
import { CliError } from "../cli/receipt.mjs";

export const SKILL_SUBCOMMANDS = ["create", "update", "list", "version"];

export function skillHelp(binary = "distilly") {
  const zh = [
    "用法：",
    `  ${binary} skill create  --character <colleague|relationship|celebrity> [--slug <slug>|--name <name>]`,
    "                        [--meta <meta.json>] [--work <work.md>] [--persona <persona.md>]",
    "                        [--base-dir <dir>] [--research-profile <name>]",
    "                        [--install-claude-skill] [--install-openclaw-skill] [--install-codex-skill]",
    `  ${binary} skill update  --slug <slug> [--character <family>] [--base-dir <dir>]`,
    "                        [--work-patch <file>] [--persona-patch <file>] [--correction-json <file>]",
    `  ${binary} skill list    [--character <family>] [--base-dir <dir>]`,
    `  ${binary} skill version <list|backup|rollback|cleanup> --slug <slug> [--version <vN>]`,
    "",
    "说明：",
    "  create 写出 SKILL.md / work.md / persona.md / work_skill.md / persona_skill.md / manifest.json / meta.json。",
    "  不带 --slug 时用 --name 生成拼音 slug；拼音表缺失或字符未覆盖时会明确失败并要求 --slug。",
    "  update 先把当前产物归档到 versions/<当前版本>/，版本号 +1。",
    "  version 管理归档：list / backup / rollback / cleanup（默认保留最近 10 个）。",
  ].join("\n");
  const en = [
    "Usage:",
    `  ${binary} skill create  --character <colleague|relationship|celebrity> [--slug <slug>|--name <name>]`,
    "                        [--meta <meta.json>] [--work <work.md>] [--persona <persona.md>]",
    "                        [--base-dir <dir>] [--research-profile <name>]",
    "                        [--install-claude-skill] [--install-openclaw-skill] [--install-codex-skill]",
    `  ${binary} skill update  --slug <slug> [--character <family>] [--base-dir <dir>]`,
    "                        [--work-patch <file>] [--persona-patch <file>] [--correction-json <file>]",
    `  ${binary} skill list    [--character <family>] [--base-dir <dir>]`,
    `  ${binary} skill version <list|backup|rollback|cleanup> --slug <slug> [--version <vN>]`,
    "",
    "Notes:",
    "  create writes SKILL.md / work.md / persona.md / work_skill.md / persona_skill.md / manifest.json / meta.json.",
    "  Without --slug the slug is derived from --name; a missing pinyin table or an uncovered character fails loudly and asks for --slug.",
    "  update archives the current artifacts under versions/<current>/ first, then bumps the version.",
    "  version manages the archive: list / backup / rollback / cleanup (keeps the newest 10 by default).",
  ].join("\n");
  return { zh, en };
}

function pending() {
  throw new CliError("skill commands are not implemented in this build yet", {
    code: "not-implemented",
    remedy:
      "the ported schema/writer/version-manager modules land in the next commits of ds/01-node-core; see docs/v2/NODE-CORE.md.",
  });
}

const commonOptions = {
  character: { type: "string", alias: "c", value: "family" },
  type: { type: "string", value: "family" },
  "base-dir": { type: "string", value: "dir" },
  slug: { type: "string", value: "slug" },
};

register("skill", {
  summary: "Skill 子命令入口 / Skill subcommand entry",
  usage: "distilly skill <create|update|list|version> [options]",
  ...skillHelp(),
  run: () => pending(),
});

register("skill create", {
  summary: "创建 Skill / Create a Skill",
  usage: "distilly skill create [options]",
  options: commonOptions,
  ...skillHelp(),
  run: () => pending(),
});

register("skill update", {
  summary: "更新 Skill / Update a Skill",
  usage: "distilly skill update [options]",
  options: commonOptions,
  ...skillHelp(),
  run: () => pending(),
});

register("skill list", {
  summary: "列出已有 Skill / List generated Skills",
  usage: "distilly skill list [options]",
  options: commonOptions,
  ...skillHelp(),
  run: () => pending(),
});

register("skill version", {
  summary: "版本归档 / Archive, roll back and prune Skill versions",
  usage: "distilly skill version <list|backup|rollback|cleanup> [options]",
  options: commonOptions,
  ...skillHelp(),
  run: () => pending(),
});
