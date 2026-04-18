#!/usr/bin/env python3
"""Shared helpers for installing generated dot-skill artifacts into host skill roots."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from skill_schema import enrich_skill_meta, now_iso


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)


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
    """Load a generated artifact and rewrite it for host installation."""
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
    *,
    force: bool = False,
    dry_run: bool = False,
    host: str,
) -> dict:
    """Install a generated combined skill into a host skill directory."""
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

    install_record = {
        "host": host,
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
                raise FileExistsError(f"{host} skill already exists: {install_dir}")
            shutil.rmtree(install_dir)

        install_dir.mkdir(parents=True, exist_ok=True)
        install_file.write_text(installed_markdown, encoding="utf-8")
        write_install_metadata(install_dir, install_record)

    return {
        "host": host,
        "command_name": command_name,
        "skill_dir": install_dir,
        "skill_file": install_file,
    }
