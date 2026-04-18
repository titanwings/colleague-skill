#!/usr/bin/env python3
"""Install a generated dot-skill artifact into OpenClaw discovery paths."""

from __future__ import annotations

import argparse
from pathlib import Path

from install_generated_skill_common import install_generated_skill as install_generated_skill_common


def default_openclaw_skills_dir() -> Path:
    """Return the default OpenClaw skills directory."""
    return Path.home() / ".openclaw" / "workspace" / "skills"


def install_generated_skill(
    skill_dir: Path,
    skills_dir: Path,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> dict:
    """Install a generated combined skill into OpenClaw skill directories."""
    return install_generated_skill_common(
        skill_dir,
        skills_dir,
        force=force,
        dry_run=dry_run,
        host="openclaw",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Install a generated dot-skill into OpenClaw")
    parser.add_argument("--skill-dir", required=True, help="Generated skill directory")
    parser.add_argument(
        "--openclaw-skills-dir",
        default=str(default_openclaw_skills_dir()),
        help="Target OpenClaw skills directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing installed skill")
    parser.add_argument("--dry-run", action="store_true", help="Resolve install paths without writing files")
    args = parser.parse_args()

    result = install_generated_skill(
        Path(args.skill_dir).expanduser(),
        Path(args.openclaw_skills_dir).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
    )
    print(result["command_name"])
    print(result["skill_dir"])


if __name__ == "__main__":
    main()
