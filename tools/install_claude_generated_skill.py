#!/usr/bin/env python3
"""Install a generated dot-skill artifact into Claude Code discovery paths."""

from __future__ import annotations

import argparse
import platform
from pathlib import Path

from install_generated_skill_common import (
    render_installed_markdown,
    install_generated_skill as install_generated_skill_common,
    load_generated_meta,
)


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
    result = install_generated_skill_common(
        skill_dir,
        skills_dir,
        force=force,
        dry_run=dry_run,
        host="claude-code",
    )
    command_path = None if commands_dir is None else commands_dir / f"{result['command_name']}.md"

    if not dry_run and install_command_shim and command_path is not None:
        meta = load_generated_meta(skill_dir)
        artifacts = meta["artifacts"]
        installed_markdown = render_installed_markdown(
            skill_dir,
            artifacts["combined_skill"],
            result["command_name"],
        )
        command_path.parent.mkdir(parents=True, exist_ok=True)
        command_path.write_text(installed_markdown, encoding="utf-8")

    return {
        **result,
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
