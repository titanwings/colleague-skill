#!/usr/bin/env python3
"""
Version manager for generated skills.

Handles version backups, listing archived versions, rollback, and cleanup.

Usage:
    python version_manager.py --action list --slug zhangsan --base-dir ~/.openclaw/...
    python version_manager.py --action backup --slug zhangsan --base-dir ~/.openclaw/...
    python version_manager.py --action rollback --slug zhangsan --version v2 --base-dir ~/.openclaw/...
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_VERSIONS = 10


def managed_content_files(skill_dir: Path) -> tuple[str, ...]:
    """Detect which content files belong to this generated skill."""
    reviewer_files = ("SKILL.md", "review.md", "examples.md")
    colleague_files = ("SKILL.md", "work.md", "persona.md")

    if any((skill_dir / name).exists() for name in ("review.md", "examples.md")):
        return reviewer_files
    return colleague_files


def list_versions(skill_dir: Path) -> list:
    """List all archived versions for a skill."""
    versions_dir = skill_dir / "versions"
    if not versions_dir.exists():
        return []

    versions = []
    for v_dir in sorted(versions_dir.iterdir()):
        if not v_dir.is_dir():
            continue

        version_name = v_dir.name
        mtime = v_dir.stat().st_mtime
        archived_at = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
        files = [f.name for f in v_dir.iterdir() if f.is_file()]

        versions.append(
            {
                "version": version_name,
                "archived_at": archived_at,
                "files": files,
                "path": str(v_dir),
            }
        )

    return versions


def rollback(skill_dir: Path, target_version: str) -> bool:
    """Roll back the skill to a specific archived version."""
    version_dir = skill_dir / "versions" / target_version

    if not version_dir.exists():
        print(f"error: version {target_version} does not exist", file=sys.stderr)
        return False

    meta_path = skill_dir / "meta.json"
    current_version = "v?"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        current_version = meta.get("version", "v?")
        backup_dir = skill_dir / "versions" / f"{current_version}_before_rollback"
        backup_dir.mkdir(parents=True, exist_ok=True)
        for fname in managed_content_files(skill_dir):
            src = skill_dir / fname
            if src.exists():
                shutil.copy2(src, backup_dir / fname)

    restored_files = []
    for fname in managed_content_files(skill_dir):
        src = version_dir / fname
        if src.exists():
            shutil.copy2(src, skill_dir / fname)
            restored_files.append(fname)

    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["version"] = target_version + "_restored"
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        meta["rollback_from"] = current_version
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"rolled back to {target_version}; restored files: {', '.join(restored_files)}")
    return True


def backup_current_version(skill_dir: Path) -> bool:
    """Archive the current version into the `versions/` directory."""
    meta_path = skill_dir / "meta.json"
    if not meta_path.exists():
        print("error: meta.json not found, cannot determine the current version", file=sys.stderr)
        return False

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    current_version = meta.get("version", "v1")

    version_dir = skill_dir / "versions" / current_version
    version_dir.mkdir(parents=True, exist_ok=True)

    backed_up = []
    for fname in managed_content_files(skill_dir):
        src = skill_dir / fname
        if src.exists():
            shutil.copy2(src, version_dir / fname)
            backed_up.append(fname)

    if backed_up:
        print(f"archived version {current_version}; files: {', '.join(backed_up)}")
    else:
        print(f"warning: no files available to archive for {current_version}")

    return True


def cleanup_old_versions(skill_dir: Path, max_versions: int = MAX_VERSIONS) -> None:
    """Delete old archived versions beyond the retention limit."""
    versions_dir = skill_dir / "versions"
    if not versions_dir.exists():
        return

    version_dirs = sorted(
        [d for d in versions_dir.iterdir() if d.is_dir()],
        key=lambda d: d.stat().st_mtime,
    )

    to_delete = version_dirs[:-max_versions] if len(version_dirs) > max_versions else []

    for old_dir in to_delete:
        shutil.rmtree(old_dir)
        print(f"deleted old version: {old_dir.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Skill version manager")
    parser.add_argument("--action", required=True, choices=["list", "backup", "rollback", "cleanup"])
    parser.add_argument("--slug", required=True, help="skill slug")
    parser.add_argument("--version", help="target version (used with rollback)")
    parser.add_argument(
        "--base-dir",
        default="~/.openclaw/workspace/skills/colleagues",
        help="root directory for generated skills",
    )

    args = parser.parse_args()
    base_dir = Path(args.base_dir).expanduser()
    skill_dir = base_dir / args.slug

    if not skill_dir.exists():
        print(f"error: skill directory not found: {skill_dir}", file=sys.stderr)
        sys.exit(1)

    if args.action == "list":
        versions = list_versions(skill_dir)
        if not versions:
            print(f"{args.slug} has no archived versions yet")
        else:
            print(f"Archived versions for {args.slug}:\n")
            for version in versions:
                print(
                    f"  {version['version']}  archived: {version['archived_at']}  files: {', '.join(version['files'])}"
                )

    elif args.action == "backup":
        backup_current_version(skill_dir)

    elif args.action == "rollback":
        if not args.version:
            print("error: rollback requires --version", file=sys.stderr)
            sys.exit(1)
        rollback(skill_dir, args.version)

    elif args.action == "cleanup":
        cleanup_old_versions(skill_dir)
        print("cleanup complete")


if __name__ == "__main__":
    main()
