#!/usr/bin/env python3
"""
Skill version manager.

This module archives and restores generated skill artifacts while keeping the
legacy colleague storage layout available.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from skill_presets import normalize_character, resolve_existing_storage_root
from skill_schema import PRIMARY_ARTIFACTS, enrich_skill_meta, now_iso, sync_legacy_fields

MAX_VERSIONS = 10


def resolve_base_dir(base_dir_arg: str | None, character: str) -> Path:
    """Resolve the storage root for the selected character family."""
    return resolve_existing_storage_root(character, base_dir_arg=base_dir_arg)


def list_versions(skill_dir: Path) -> list[dict]:
    """List all archived versions for a skill directory."""
    versions_dir = skill_dir / "versions"
    if not versions_dir.exists():
        return []

    versions = []
    for version_dir in sorted(versions_dir.iterdir()):
        if not version_dir.is_dir():
            continue

        archived_at = datetime.fromtimestamp(
            version_dir.stat().st_mtime,
            tz=timezone.utc,
        ).strftime("%Y-%m-%d %H:%M")

        files = [item.name for item in version_dir.iterdir() if item.is_file()]
        versions.append({
            "version": version_dir.name,
            "archived_at": archived_at,
            "files": files,
            "path": str(version_dir),
        })

    return versions


def backup_artifacts(skill_dir: Path, backup_dir: Path) -> None:
    """Copy the current generated artifacts into a backup directory."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    for filename in PRIMARY_ARTIFACTS:
        src = skill_dir / filename
        if src.exists():
            shutil.copy2(src, backup_dir / filename)


def rollback(skill_dir: Path, target_version: str) -> bool:
    """Restore a previously archived version."""
    version_dir = skill_dir / "versions" / target_version
    if not version_dir.exists():
        print(f"error: version does not exist: {target_version}", file=sys.stderr)
        return False

    meta_path = skill_dir / "meta.json"
    if not meta_path.exists():
        print("error: meta.json is required for rollback", file=sys.stderr)
        return False

    meta = enrich_skill_meta(
        json.loads(meta_path.read_text(encoding="utf-8")),
        skill_dir.name,
    )
    current_version = meta.get("version", "v?")
    backup_artifacts(skill_dir, skill_dir / "versions" / f"{current_version}_before_rollback")

    restored_files = []
    for filename in PRIMARY_ARTIFACTS:
        src = version_dir / filename
        if src.exists():
            shutil.copy2(src, skill_dir / filename)
            restored_files.append(filename)

    meta["lifecycle"]["version"] = f"{target_version}_restored"
    meta["lifecycle"]["updated_at"] = now_iso()
    meta["rollback_from"] = current_version
    meta_path.write_text(
        json.dumps(sync_legacy_fields(meta), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"rolled back to {target_version}: {', '.join(restored_files)}")
    return True


def backup_current_version(skill_dir: Path) -> bool:
    """Archive the current generated artifacts under versions/<version>/."""
    meta_path = skill_dir / "meta.json"
    if not meta_path.exists():
        print("error: meta.json is required to determine the current version", file=sys.stderr)
        return False

    meta = enrich_skill_meta(
        json.loads(meta_path.read_text(encoding="utf-8")),
        skill_dir.name,
    )
    current_version = meta.get("version", "v1")
    backup_artifacts(skill_dir, skill_dir / "versions" / current_version)
    print(f"archived version {current_version}")
    return True


def cleanup_old_versions(skill_dir: Path, max_versions: int = MAX_VERSIONS) -> None:
    """Remove archived versions beyond the retention limit."""
    versions_dir = skill_dir / "versions"
    if not versions_dir.exists():
        return

    version_dirs = sorted(
        [entry for entry in versions_dir.iterdir() if entry.is_dir()],
        key=lambda entry: entry.stat().st_mtime,
    )
    to_delete = version_dirs[:-max_versions] if len(version_dirs) > max_versions else []

    for old_dir in to_delete:
        shutil.rmtree(old_dir)
        print(f"deleted old version: {old_dir.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Skill version manager")
    parser.add_argument("--action", required=True, choices=["list", "backup", "rollback", "cleanup"])
    parser.add_argument("--slug", required=True, help="Skill slug")
    parser.add_argument("--version", help="Target version for rollback")
    parser.add_argument("--character", default="colleague", help="Character family preset")
    parser.add_argument("--type", help="Deprecated compatibility alias for --character")
    parser.add_argument("--base-dir", help="Skill storage root")

    args = parser.parse_args()
    character = normalize_character(args.character or args.type)
    base_dir = resolve_existing_storage_root(character, slug=args.slug, base_dir_arg=args.base_dir)
    skill_dir = base_dir / args.slug

    if not skill_dir.exists():
        print(f"error: skill directory not found: {skill_dir}", file=sys.stderr)
        sys.exit(1)

    if args.action == "list":
        versions = list_versions(skill_dir)
        if not versions:
            print(f"no archived versions for {args.slug}")
        else:
            print(f"archived versions for {args.slug}:\n")
            for version in versions:
                print(
                    f"  {version['version']}  archived: {version['archived_at']}  "
                    f"files: {', '.join(version['files'])}"
                )
        return

    if args.action == "backup":
        backup_current_version(skill_dir)
        return

    if args.action == "rollback":
        if not args.version:
            print("error: rollback requires --version", file=sys.stderr)
            sys.exit(1)
        rollback(skill_dir, args.version)
        return

    cleanup_old_versions(skill_dir)
    print("cleanup complete")


if __name__ == "__main__":
    main()
