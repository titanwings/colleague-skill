#!/usr/bin/env python3
"""Install a generated dot-skill artifact into Claude Code discovery paths."""

from __future__ import annotations

import argparse
import json
import platform
import re
import shutil
from pathlib import Path

from skill_schema import enrich_skill_meta, now_iso


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)


def default_claude_skills_dir() -> Path:
    """Return the default Claude Code skills directory."""
    return Path.home() / ".claude" / "skills"


def default_claude_commands_dir() -> Path:
    """Return the default Claude Code commands directory."""
    return Path.home() / ".claude" / "commands"


def should_install_command_shim(system_name: str | None = None) -> bool:
    """Return whether a slash-command shim should be installed."""
    current = (system_name or platform.system()).lower()
    return current.startswith("win")


def load_generated_meta(skill_dir: Path) -> dict:
    """Load and normalize generated skill metadata from a skill directory."""
    meta_path = skill_dir / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"generated skill is missing meta.json: {skill_dir}")
    return enrich_skill_meta(
        json.loads(meta_path.read_text(encoding="utf-8")),
        skill_dir.name,
    )


def rewrite_frontmatter_name(markdown: str, new_name: str) -> str:
    """Rewrite the frontmatter name field to the installed command name."""
    match = FRONTMATTER_RE.match(markdown)
    if not match:
        return markdown

    body = markdown[match.end():]
    lines = match.group(1).splitlines()
    rewritten: list[str] = []
    replaced = False

    for line in lines:
        if line.startswith("name:"):
            rewritten.append(f"name: {new_name}")
            replaced = True
        else:
            rewritten.append(line)

    if not replaced:
        rewritten.insert(0, f"name: {new_name}")

    return f"---\n" + "\n".join(rewritten) + "\n---\n\n" + body.lstrip("\n")


def render_installed_markdown(skill_dir: Path, artifact_name: str, command_name: str) -> str:
    """Load a generated artifact and rewrite it for Claude Code installation."""
    artifact_path = skill_dir / artifact_name
    if not artifact_path.exists():
        raise FileNotFoundError(f"generated artifact not found: {artifact_path}")
    return rewrite_frontmatter_name(
        artifact_path.read_text(encoding="utf-8"),
        command_name,
    )


def write_install_metadata(install_dir: Path, payload: dict) -> None:
    """Persist installation metadata for later debugging and upgrades."""
    (install_dir / ".dot-skill-install.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def install_generated_skill(
    skill_dir: Path,
    skills_dir: Path,
    commands_dir: Path | None = None,
    *,
    force: bool = False,
    dry_run: bool = False,
    install_command_shim: bool = False,
) -> dict:
    """Install a generated combined skill into Claude Code skill directories."""
    meta = load_generated_meta(skill_dir)
    artifacts = meta["artifacts"]
    command_name = artifacts["combined_command"]
    installed_markdown = render_installed_markdown(
        skill_dir,
        artifacts["combined_skill"],
        command_name,
    )

    install_dir = skills_dir / command_name
    install_file = install_dir / "SKILL.md"
    command_path = None if commands_dir is None else commands_dir / f"{command_name}.md"

    install_record = {
        "command_name": command_name,
        "character": meta["character"],
        "slug": meta["slug"],
        "version": meta["version"],
        "source_skill_dir": str(skill_dir),
        "source_artifact": artifacts["combined_skill"],
        "installed_at": now_iso(),
    }

    if not dry_run:
        if install_dir.exists():
            if not force:
                raise FileExistsError(f"Claude skill already exists: {install_dir}")
            shutil.rmtree(install_dir)

        install_dir.mkdir(parents=True, exist_ok=True)
        install_file.write_text(installed_markdown, encoding="utf-8")
        write_install_metadata(install_dir, install_record)

        if install_command_shim and command_path is not None:
            command_path.parent.mkdir(parents=True, exist_ok=True)
            command_path.write_text(installed_markdown, encoding="utf-8")

    return {
        "command_name": command_name,
        "skill_dir": install_dir,
        "skill_file": install_file,
        "command_path": command_path,
        "command_shim_installed": bool(install_command_shim and command_path is not None),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Install a generated dot-skill into Claude Code")
    parser.add_argument("--skill-dir", required=True, help="Generated skill directory")
    parser.add_argument(
        "--claude-skills-dir",
        default=str(default_claude_skills_dir()),
        help="Target Claude Code skills directory",
    )
    parser.add_argument(
        "--claude-commands-dir",
        default=str(default_claude_commands_dir()),
        help="Target Claude Code commands directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing installed skill")
    parser.add_argument("--dry-run", action="store_true", help="Resolve install paths without writing files")
    parser.add_argument(
        "--install-command-shim",
        action="store_true",
        help="Also install a slash-command markdown file under ~/.claude/commands",
    )
    args = parser.parse_args()

    command_shim = args.install_command_shim or should_install_command_shim()
    result = install_generated_skill(
        Path(args.skill_dir).expanduser(),
        Path(args.claude_skills_dir).expanduser(),
        commands_dir=Path(args.claude_commands_dir).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
        install_command_shim=command_shim,
    )
    print(result["command_name"])
    print(result["skill_dir"])
    if result["command_shim_installed"] and result["command_path"] is not None:
        print(result["command_path"])


if __name__ == "__main__":
    main()
