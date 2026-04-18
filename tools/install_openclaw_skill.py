#!/usr/bin/env python3
"""Install the current dot-skill repo into the local OpenClaw skill directory."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


IGNORE_NAMES = shutil.ignore_patterns(".git", "__pycache__", ".DS_Store", "*.pyc")


def install_skill(source: Path, destination: Path, force: bool = False, dry_run: bool = False) -> Path:
    """Copy the repo into the OpenClaw local skill directory."""
    if not (source / "SKILL.md").exists():
        raise FileNotFoundError(f"source does not look like a skill repo: {source}")

    if dry_run:
        return destination

    if destination.exists():
        if not force:
            raise FileExistsError(f"destination already exists: {destination}")
        shutil.rmtree(destination)

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=IGNORE_NAMES)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Install dot-skill into OpenClaw")
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[1]),
        help="Source skill repo root",
    )
    parser.add_argument(
        "--dest",
        default=str(Path.home() / ".openclaw" / "workspace" / "skills" / "dot-skill"),
        help="Destination OpenClaw skill directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite the destination if needed")
    parser.add_argument("--dry-run", action="store_true", help="Print the install target without copying")
    args = parser.parse_args()

    destination = install_skill(
        Path(args.source).expanduser(),
        Path(args.dest).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
    )
    print(destination)


if __name__ == "__main__":
    main()
