#!/usr/bin/env python3
"""
Skill file writer.

Writes generated `work.md` and `persona.md` files into the expected directory
structure, creates `meta.json`, and assembles the full `SKILL.md`.

Usage:
    python3 skill_writer.py --action create --slug zhangsan --meta meta.json \
        --work work_content.md --persona persona_content.md \
        --base-dir ./colleagues

    python3 skill_writer.py --action update --slug zhangsan \
        --work-patch work_patch.md --persona-patch persona_patch.md \
        --base-dir ./colleagues

    python3 skill_writer.py --action list --base-dir ./colleagues
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


LANG_CONFIG = {
    "en": {
        "identity_fallback": "colleague",
        "mbti_separator": ", MBTI ",
        "skill_md_template": """\
---
name: colleague_{slug}
description: {name}, {identity}
user-invocable: true
---

# {name}

{identity}

---

## PART A: Work Capabilities

{work_content}

---

## PART B: Persona

{persona_content}

---

## Execution Rules

When you receive any task or question:

1. **Let PART B decide first**: whether to take the task, and with what attitude
2. **Then let PART A execute**: use the person's technical skills and working style to complete the task
3. **Keep PART B's communication style in the output**: wording, tone, and sentence patterns

**PART B Layer 0 rules always take priority and must never be violated.**
""",
        "work_only_description": "{name}'s work capabilities (Work only, no Persona)",
        "persona_only_description": "{name}'s persona (Persona only, no Work capabilities)",
        "correction_section": "## Correction Log",
        "correction_placeholder": "(No entries yet)",
        "default_scene": "general",
        "correction_line": "- [Scene: {scene}] Should not {wrong}; should {correct}",
        "list_empty": "No colleague skills created yet",
        "list_header": "Created {count} colleague skills:\n",
        "list_item": "  [{slug}]  {name} - {identity}",
        "list_meta": "    Version: {version}  Corrections: {corrections_count}  Updated: {updated}",
        "reviewer_list_empty": "No reviewer skills created yet",
        "reviewer_list_header": "Created {count} reviewer skills:\n",
        "reviewer_list_meta": "    Type: {reviewer_type}  Version: {version}  Corrections: {corrections_count}  Updated: {updated}",
        "unknown_date": "unknown",
        "parser_description": "Skill file writer",
        "slug_help": "colleague slug (used as the directory name)",
        "name_help": "colleague name",
        "meta_help": "path to meta.json",
        "work_help": "path to the work.md content file",
        "persona_help": "path to the persona.md content file",
        "reviewer_type_help": "reviewer type (pr or design)",
        "review_help": "path to the review.md content file",
        "examples_help": "path to the examples.md content file",
        "work_patch_help": "path to the incremental work.md patch file",
        "persona_patch_help": "path to the incremental persona.md patch file",
        "base_dir_help": "root directory for colleague skills (default: ./colleagues)",
        "create_missing_name": "error: create requires --slug or --name",
        "create_reviewer_missing_type": "error: create-reviewer requires --reviewer-type",
        "create_reviewer_missing_review": "error: create-reviewer requires --review",
        "create_reviewer_missing_examples": "error: create-reviewer requires --examples",
        "created_skill": "Created skill: {skill_dir}",
        "created_reviewer": "Created {reviewer_label}: {skill_dir}",
        "trigger_phrase": "Trigger: /{slug}",
        "reviewer_trigger_phrase": "Trigger: /{trigger}",
        "update_missing_slug": "error: update requires --slug",
        "skill_dir_missing": "error: could not find skill directory {skill_dir}",
        "updated_skill": "Updated skill to {version}: {skill_dir}",
    },
    "zh": {
        "identity_fallback": "同事",
        "mbti_separator": "，MBTI ",
        "skill_md_template": """\
---
name: colleague_{slug}
description: {name}，{identity}
user-invocable: true
---

# {name}

{identity}

---

## PART A：工作能力

{work_content}

---

## PART B：人物性格

{persona_content}

---

## 运行规则

接收到任何任务或问题时：

1. **先由 PART B 判断**：你会不会接这个任务？用什么态度接？
2. **再由 PART A 执行**：用你的技术能力和工作方法完成任务
3. **输出时保持 PART B 的表达风格**：你说话的方式、用词习惯、句式

**PART B 的 Layer 0 规则永远优先，任何情况下不得违背。**
""",
        "work_only_description": "{name} 的工作能力（仅 Work，无 Persona）",
        "persona_only_description": "{name} 的人物性格（仅 Persona，无工作能力）",
        "correction_section": "## Correction 记录",
        "correction_placeholder": "（暂无记录）",
        "default_scene": "通用",
        "correction_line": "- [{scene}] 不应该 {wrong}，应该 {correct}",
        "list_empty": "暂无已创建的同事 Skill",
        "list_header": "已创建 {count} 个同事 Skill：\n",
        "list_item": "  [{slug}]  {name} - {identity}",
        "list_meta": "    版本: {version}  纠正次数: {corrections_count}  更新: {updated}",
        "reviewer_list_empty": "暂无已创建的审查者 Skill",
        "reviewer_list_header": "已创建 {count} 个审查者 Skill：\n",
        "reviewer_list_meta": "    类型: {reviewer_type}  版本: {version}  纠正次数: {corrections_count}  更新: {updated}",
        "unknown_date": "未知",
        "parser_description": "Skill 文件写入器",
        "slug_help": "同事 slug（用于目录名）",
        "name_help": "同事姓名",
        "meta_help": "meta.json 文件路径",
        "work_help": "work.md 内容文件路径",
        "persona_help": "persona.md 内容文件路径",
        "reviewer_type_help": "审查者类型（pr 或 design）",
        "review_help": "review.md 内容文件路径",
        "examples_help": "examples.md 内容文件路径",
        "work_patch_help": "work.md 增量更新内容文件路径",
        "persona_patch_help": "persona.md 增量更新内容文件路径",
        "base_dir_help": "同事 Skill 根目录（默认：./colleagues）",
        "create_missing_name": "错误：create 操作需要 --slug 或 --name",
        "create_reviewer_missing_type": "错误：create-reviewer 操作需要 --reviewer-type",
        "create_reviewer_missing_review": "错误：create-reviewer 操作需要 --review",
        "create_reviewer_missing_examples": "错误：create-reviewer 操作需要 --examples",
        "created_skill": "✅ Skill 已创建：{skill_dir}",
        "created_reviewer": "✅ 已创建 {reviewer_label}：{skill_dir}",
        "trigger_phrase": "   触发词：/{slug}",
        "reviewer_trigger_phrase": "   触发词：/{trigger}",
        "update_missing_slug": "错误：update 操作需要 --slug",
        "skill_dir_missing": "错误：找不到 Skill 目录 {skill_dir}",
        "updated_skill": "✅ Skill 已更新到 {version}：{skill_dir}",
    },
}


REVIEWER_LANG_CONFIG = {
    "en": {
        "identity_separator": " | ",
        "review_rules_heading": "## Review Rules",
        "review_examples_heading": "## Review Examples",
        "execution_heading": "## Execution Rules",
        "preserve_style_rule": "Preserve the reviewer's severity, framing, and phrasing style.",
        "ask_for_context_rule": "Ask for missing context when the material is insufficient to make a confident review call.",
        "no_implementation_rule": "Do not switch into implementation mode unless the user explicitly requests separate implementation help.",
    },
    "zh": {
        "identity_separator": "｜",
        "review_rules_heading": "## 评审规则",
        "review_examples_heading": "## 评审示例",
        "execution_heading": "## 执行规则",
        "preserve_style_rule": "保持该审查者的严重级别判断、表达框架和措辞风格。",
        "ask_for_context_rule": "当材料不足以做出可靠评审结论时，先要求补充上下文。",
        "no_implementation_rule": "除非用户明确要求单独的实现帮助，否则不要切换到实现模式。",
    },
}


REVIEWER_CONFIG = {
    "pr": {
        "skill_name_prefix": "pr-reviewer",
        "title": {"en": "PR Reviewer", "zh": "PR 审查者"},
        "description": {
            "en": "{name}, review-only clone for PR/code review",
            "zh": "{name}，仅用于 PR/代码评审的克隆",
        },
        "identity_suffix": {
            "en": "review-only PR/code reviewer",
            "zh": "仅用于 PR/代码评审",
        },
        "stay_in_domain_rule": {
            "en": "Stay in PR/code review mode only.",
            "zh": "只保持在 PR/代码评审模式。",
        },
        "apply_rule": {
            "en": "Review pull requests, diffs, tests, and release risk using the heuristics above.",
            "zh": "使用上述启发式方法评审 PR、代码 diff、测试和发布风险。",
        },
    },
    "design": {
        "skill_name_prefix": "design-reviewer",
        "title": {"en": "Design Reviewer", "zh": "设计审查者"},
        "description": {
            "en": "{name}, review-only clone for RFC/design/architecture review",
            "zh": "{name}，仅用于 RFC/设计/架构评审的克隆",
        },
        "identity_suffix": {
            "en": "review-only design/architecture reviewer",
            "zh": "仅用于设计/架构评审",
        },
        "stay_in_domain_rule": {
            "en": "Stay in RFC/design/architecture review mode only.",
            "zh": "只保持在 RFC/设计/架构评审模式。",
        },
        "apply_rule": {
            "en": "Review problem framing, contracts, tradeoffs, rollout, and reversibility using the heuristics above.",
            "zh": "使用上述启发式方法评审问题定义、契约、权衡、发布方案和可回滚性。",
        },
    },
}


def normalize_language(value: Optional[str]) -> str:
    if not value:
        return "en"
    return "zh" if str(value).lower().startswith("zh") else "en"


def get_language(meta: dict) -> str:
    return normalize_language(meta.get("language") or meta.get("lang"))


def render_skill_md(
    language: str,
    slug: str,
    name: str,
    identity: str,
    work_content: str,
    persona_content: str,
) -> str:
    template = LANG_CONFIG[language]["skill_md_template"]
    return template.format(
        slug=slug,
        name=name,
        identity=identity,
        work_content=work_content,
        persona_content=persona_content,
    )


def slugify(name: str) -> str:
    """
    Convert a human name into a slug.

    Prefer `pypinyin` when available so Chinese names can become readable slugs.
    Fall back to a simple ASCII-only conversion otherwise.
    """
    try:
        from pypinyin import lazy_pinyin

        parts = lazy_pinyin(name)
        slug = "_".join(parts)
    except ImportError:
        import unicodedata

        result = []
        for char in name.lower():
            if char.isascii() and (char.isalnum() or char in ("-", "_")):
                result.append(char)
            elif char == " ":
                result.append("_")
            else:
                cat = unicodedata.category(char)
                if cat.startswith("L") or cat.startswith("N"):
                    continue
        slug = "".join(result)

    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug if slug else "colleague"


def build_identity_string(meta: dict, language: str, default_value: Optional[str] = None) -> str:
    """Build a compact identity string from `meta`."""
    profile = meta.get("profile", {})
    parts = []

    company = profile.get("company", "")
    level = profile.get("level", "")
    role = profile.get("role", "")

    if company:
        parts.append(company)
    if level:
        parts.append(level)
    if role:
        parts.append(role)

    config = LANG_CONFIG[language]
    identity = " ".join(parts) if parts else (default_value or config["identity_fallback"])

    mbti = profile.get("mbti", "")
    if mbti:
        identity += f"{config['mbti_separator']}{mbti}"

    return identity


def get_reviewer_skill_name(reviewer_type: str, slug: str) -> str:
    return f"{REVIEWER_CONFIG[reviewer_type]['skill_name_prefix']}-{slug}"


def get_reviewer_label(reviewer_type: str, language: str) -> str:
    return REVIEWER_CONFIG[reviewer_type]["title"][language]


def build_reviewer_identity(meta: dict, language: str, reviewer_type: str) -> str:
    reviewer_config = REVIEWER_CONFIG[reviewer_type]
    reviewer_lang = REVIEWER_LANG_CONFIG[language]
    base_identity = build_identity_string(
        meta,
        language,
        default_value=reviewer_config["title"][language],
    )
    suffix = reviewer_config["identity_suffix"][language]

    if base_identity == reviewer_config["title"][language]:
        return suffix
    return f"{base_identity}{reviewer_lang['identity_separator']}{suffix}"


def render_reviewer_skill_md(
    language: str,
    reviewer_type: str,
    slug: str,
    name: str,
    identity: str,
    review_content: str,
    examples_content: str,
) -> str:
    reviewer_config = REVIEWER_CONFIG[reviewer_type]
    reviewer_lang = REVIEWER_LANG_CONFIG[language]
    execution_rules = [
        reviewer_config["stay_in_domain_rule"][language],
        reviewer_config["apply_rule"][language],
        reviewer_lang["preserve_style_rule"],
        reviewer_lang["ask_for_context_rule"],
        reviewer_lang["no_implementation_rule"],
    ]
    rendered_rules = "\n".join(
        f"{index}. {rule}" for index, rule in enumerate(execution_rules, start=1)
    )

    return """\
---
name: {skill_name}
description: {description}
user-invocable: true
---

# {name} - {title}

{identity}

---

{review_rules_heading}

{review_content}

---

{review_examples_heading}

{examples_content}

---

{execution_heading}

{execution_rules}
""".format(
        skill_name=get_reviewer_skill_name(reviewer_type, slug),
        description=reviewer_config["description"][language].format(name=name),
        name=name,
        title=reviewer_config["title"][language],
        identity=identity,
        review_rules_heading=reviewer_lang["review_rules_heading"],
        review_content=review_content.strip(),
        review_examples_heading=reviewer_lang["review_examples_heading"],
        examples_content=examples_content.strip(),
        execution_heading=reviewer_lang["execution_heading"],
        execution_rules=rendered_rules,
    )


def create_skill(
    base_dir: Path,
    slug: str,
    meta: dict,
    work_content: str,
    persona_content: str,
) -> Path:
    """Create a new colleague skill directory structure."""
    language = get_language(meta)
    config = LANG_CONFIG[language]

    skill_dir = base_dir / slug
    skill_dir.mkdir(parents=True, exist_ok=True)

    (skill_dir / "versions").mkdir(exist_ok=True)
    (skill_dir / "knowledge" / "docs").mkdir(parents=True, exist_ok=True)
    (skill_dir / "knowledge" / "messages").mkdir(parents=True, exist_ok=True)
    (skill_dir / "knowledge" / "emails").mkdir(parents=True, exist_ok=True)

    (skill_dir / "work.md").write_text(work_content, encoding="utf-8")
    (skill_dir / "persona.md").write_text(persona_content, encoding="utf-8")

    name = meta.get("name", slug)
    identity = build_identity_string(meta, language)

    skill_md = render_skill_md(
        language=language,
        slug=slug,
        name=name,
        identity=identity,
        work_content=work_content,
        persona_content=persona_content,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    work_only = (
        f"---\nname: colleague_{slug}_work\n"
        f"description: {config['work_only_description'].format(name=name)}\n"
        f"user-invocable: true\n---\n\n{work_content}\n"
    )
    (skill_dir / "work_skill.md").write_text(work_only, encoding="utf-8")

    persona_only = (
        f"---\nname: colleague_{slug}_persona\n"
        f"description: {config['persona_only_description'].format(name=name)}\n"
        f"user-invocable: true\n---\n\n{persona_content}\n"
    )
    (skill_dir / "persona_skill.md").write_text(persona_only, encoding="utf-8")

    now = datetime.now(timezone.utc).isoformat()
    meta["slug"] = slug
    meta.setdefault("created_at", now)
    meta["updated_at"] = now
    meta["version"] = "v1"
    meta.setdefault("corrections_count", 0)
    meta.setdefault("language", language)

    (skill_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return skill_dir


def create_reviewer_skill(
    base_dir: Path,
    reviewer_type: str,
    slug: str,
    meta: dict,
    review_content: str,
    examples_content: str,
) -> Path:
    """Create a new review-only skill directory structure."""
    language = get_language(meta)

    skill_dir = base_dir / slug
    skill_dir.mkdir(parents=True, exist_ok=True)

    (skill_dir / "versions").mkdir(exist_ok=True)
    (skill_dir / "knowledge").mkdir(exist_ok=True)

    (skill_dir / "review.md").write_text(review_content, encoding="utf-8")
    (skill_dir / "examples.md").write_text(examples_content, encoding="utf-8")

    name = meta.get("name", slug)
    identity = build_reviewer_identity(meta, language, reviewer_type)
    skill_md = render_reviewer_skill_md(
        language=language,
        reviewer_type=reviewer_type,
        slug=slug,
        name=name,
        identity=identity,
        review_content=review_content,
        examples_content=examples_content,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    now = datetime.now(timezone.utc).isoformat()
    meta["slug"] = slug
    meta["reviewer_type"] = reviewer_type
    meta.setdefault("created_at", now)
    meta["updated_at"] = now
    meta["version"] = "v1"
    meta.setdefault("corrections_count", 0)
    meta.setdefault("knowledge_sources", [])
    meta.setdefault("profile", {})
    meta.setdefault("language", language)

    (skill_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return skill_dir


def update_skill(
    skill_dir: Path,
    work_patch: Optional[str] = None,
    persona_patch: Optional[str] = None,
    correction: Optional[dict] = None,
) -> str:
    """Update an existing skill, archiving the current version first."""
    meta_path = skill_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    language = get_language(meta)
    config = LANG_CONFIG[language]

    current_version = meta.get("version", "v1")
    try:
        version_num = int(current_version.lstrip("v").split("_")[0]) + 1
    except ValueError:
        version_num = 2
    new_version = f"v{version_num}"

    version_dir = skill_dir / "versions" / current_version
    version_dir.mkdir(parents=True, exist_ok=True)
    for fname in ("SKILL.md", "work.md", "persona.md"):
        src = skill_dir / fname
        if src.exists():
            shutil.copy2(src, version_dir / fname)

    if work_patch:
        current_work = (skill_dir / "work.md").read_text(encoding="utf-8")
        new_work = current_work + "\n\n" + work_patch
        (skill_dir / "work.md").write_text(new_work, encoding="utf-8")

    if persona_patch or correction:
        current_persona = (skill_dir / "persona.md").read_text(encoding="utf-8")

        if correction:
            scene = correction.get("scene", config["default_scene"])
            correction_line = config["correction_line"].format(
                scene=scene,
                wrong=correction["wrong"],
                correct=correction["correct"],
            )
            section_candidates = ("## Correction Log", "## Correction 记录")
            placeholder_candidates = ("\n\n(No entries yet)", "\n\n（暂无记录）")

            target = next(
                (section for section in section_candidates if section in current_persona),
                config["correction_section"],
            )

            if target in current_persona:
                insert_pos = current_persona.index(target) + len(target)
                rest = current_persona[insert_pos:]
                for placeholder in placeholder_candidates:
                    if rest.startswith(placeholder):
                        rest = rest[len(placeholder):]
                        break
                new_persona = current_persona[:insert_pos] + "\n\n" + correction_line + rest
            else:
                new_persona = (
                    current_persona
                    + f"\n\n{config['correction_section']}\n\n{correction_line}\n"
                )

            meta["corrections_count"] = meta.get("corrections_count", 0) + 1
        else:
            new_persona = current_persona + "\n\n" + persona_patch

        (skill_dir / "persona.md").write_text(new_persona, encoding="utf-8")

    work_content = (skill_dir / "work.md").read_text(encoding="utf-8")
    persona_content = (skill_dir / "persona.md").read_text(encoding="utf-8")
    name = meta.get("name", skill_dir.name)
    identity = build_identity_string(meta, language)

    skill_md = render_skill_md(
        language=language,
        slug=skill_dir.name,
        name=name,
        identity=identity,
        work_content=work_content,
        persona_content=persona_content,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    meta["version"] = new_version
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return new_version


def list_skills(base_dir: Path) -> list:
    """List all created skills under a base directory."""
    skills = []

    if not base_dir.exists():
        return skills

    for skill_dir in sorted(base_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        meta_path = skill_dir / "meta.json"
        if not meta_path.exists():
            continue

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        language = get_language(meta)
        reviewer_type = meta.get("reviewer_type")
        identity = (
            build_reviewer_identity(meta, language, reviewer_type)
            if reviewer_type in REVIEWER_CONFIG
            else build_identity_string(meta, language)
        )
        skills.append(
            {
                "slug": meta.get("slug", skill_dir.name),
                "name": meta.get("name", skill_dir.name),
                "identity": identity,
                "version": meta.get("version", "v1"),
                "updated_at": meta.get("updated_at", ""),
                "corrections_count": meta.get("corrections_count", 0),
                "language": language,
                "reviewer_type": reviewer_type,
                "reviewer_label": (
                    get_reviewer_label(reviewer_type, language)
                    if reviewer_type in REVIEWER_CONFIG
                    else None
                ),
            }
        )

    return skills


def main() -> None:
    parser = argparse.ArgumentParser(description=LANG_CONFIG["en"]["parser_description"])
    parser.add_argument(
        "--action",
        required=True,
        choices=["create", "update", "list", "create-reviewer"],
    )
    parser.add_argument("--slug", help=LANG_CONFIG["en"]["slug_help"])
    parser.add_argument("--name", help=LANG_CONFIG["en"]["name_help"])
    parser.add_argument("--meta", help=LANG_CONFIG["en"]["meta_help"])
    parser.add_argument("--work", help=LANG_CONFIG["en"]["work_help"])
    parser.add_argument("--persona", help=LANG_CONFIG["en"]["persona_help"])
    parser.add_argument(
        "--reviewer-type",
        choices=sorted(REVIEWER_CONFIG),
        help=LANG_CONFIG["en"]["reviewer_type_help"],
    )
    parser.add_argument("--review", help=LANG_CONFIG["en"]["review_help"])
    parser.add_argument("--examples", help=LANG_CONFIG["en"]["examples_help"])
    parser.add_argument("--work-patch", help=LANG_CONFIG["en"]["work_patch_help"])
    parser.add_argument("--persona-patch", help=LANG_CONFIG["en"]["persona_patch_help"])
    parser.add_argument(
        "--base-dir",
        default="./colleagues",
        help=LANG_CONFIG["en"]["base_dir_help"],
    )

    args = parser.parse_args()
    base_dir = Path(args.base_dir).expanduser()
    is_reviewer_base_dir = "reviewers" in base_dir.parts

    if args.action == "list":
        skills = list_skills(base_dir)
        if not skills:
            empty_key = "reviewer_list_empty" if is_reviewer_base_dir else "list_empty"
            print(LANG_CONFIG["en"][empty_key])
        else:
            if all(skill["reviewer_type"] for skill in skills):
                print(LANG_CONFIG["en"]["reviewer_list_header"].format(count=len(skills)))
            else:
                print(LANG_CONFIG["en"]["list_header"].format(count=len(skills)))
            for skill in skills:
                updated = (
                    skill["updated_at"][:10]
                    if skill["updated_at"]
                    else LANG_CONFIG["en"]["unknown_date"]
                )
                print(
                    LANG_CONFIG["en"]["list_item"].format(
                        slug=skill["slug"],
                        name=skill["name"],
                        identity=skill["identity"],
                    )
                )
                if skill["reviewer_type"]:
                    print(
                        LANG_CONFIG["en"]["reviewer_list_meta"].format(
                            reviewer_type=skill["reviewer_type"],
                            version=skill["version"],
                            corrections_count=skill["corrections_count"],
                            updated=updated,
                        )
                    )
                else:
                    print(
                        LANG_CONFIG["en"]["list_meta"].format(
                            version=skill["version"],
                            corrections_count=skill["corrections_count"],
                            updated=updated,
                        )
                    )
                print()

    elif args.action == "create":
        if not args.slug and not args.name:
            print(LANG_CONFIG["en"]["create_missing_name"], file=sys.stderr)
            sys.exit(1)

        meta: dict = {}
        if args.meta:
            meta = json.loads(Path(args.meta).read_text(encoding="utf-8"))
        if args.name:
            meta["name"] = args.name

        language = get_language(meta)
        config = LANG_CONFIG[language]
        slug = args.slug or slugify(meta.get("name", "colleague"))

        work_content = Path(args.work).read_text(encoding="utf-8") if args.work else ""
        persona_content = Path(args.persona).read_text(encoding="utf-8") if args.persona else ""

        skill_dir = create_skill(base_dir, slug, meta, work_content, persona_content)
        print(config["created_skill"].format(skill_dir=skill_dir))
        print(config["trigger_phrase"].format(slug=slug))

    elif args.action == "create-reviewer":
        if not args.slug and not args.name:
            print(LANG_CONFIG["en"]["create_missing_name"], file=sys.stderr)
            sys.exit(1)
        if not args.reviewer_type:
            print(LANG_CONFIG["en"]["create_reviewer_missing_type"], file=sys.stderr)
            sys.exit(1)
        if not args.review:
            print(LANG_CONFIG["en"]["create_reviewer_missing_review"], file=sys.stderr)
            sys.exit(1)
        if not args.examples:
            print(LANG_CONFIG["en"]["create_reviewer_missing_examples"], file=sys.stderr)
            sys.exit(1)

        meta: dict = {}
        if args.meta:
            meta = json.loads(Path(args.meta).read_text(encoding="utf-8"))
        if args.name:
            meta["name"] = args.name

        language = get_language(meta)
        config = LANG_CONFIG[language]
        slug = args.slug or slugify(meta.get("name", "reviewer"))
        review_content = Path(args.review).read_text(encoding="utf-8")
        examples_content = Path(args.examples).read_text(encoding="utf-8")

        skill_dir = create_reviewer_skill(
            base_dir=base_dir,
            reviewer_type=args.reviewer_type,
            slug=slug,
            meta=meta,
            review_content=review_content,
            examples_content=examples_content,
        )
        trigger = get_reviewer_skill_name(args.reviewer_type, slug)
        print(
            config["created_reviewer"].format(
                reviewer_label=get_reviewer_label(args.reviewer_type, language),
                skill_dir=skill_dir,
            )
        )
        print(config["reviewer_trigger_phrase"].format(trigger=trigger))

    elif args.action == "update":
        if not args.slug:
            print(LANG_CONFIG["en"]["update_missing_slug"], file=sys.stderr)
            sys.exit(1)

        skill_dir = base_dir / args.slug
        if not skill_dir.exists():
            print(
                LANG_CONFIG["en"]["skill_dir_missing"].format(skill_dir=skill_dir),
                file=sys.stderr,
            )
            sys.exit(1)

        work_patch = (
            Path(args.work_patch).read_text(encoding="utf-8")
            if args.work_patch
            else None
        )
        persona_patch = (
            Path(args.persona_patch).read_text(encoding="utf-8")
            if args.persona_patch
            else None
        )

        meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
        language = get_language(meta)
        config = LANG_CONFIG[language]

        new_version = update_skill(skill_dir, work_patch, persona_patch)
        print(config["updated_skill"].format(version=new_version, skill_dir=skill_dir))


if __name__ == "__main__":
    main()
