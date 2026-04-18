#!/usr/bin/env python3
"""
Helpers for the shared dot-skill engine schema and generated artifact metadata.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from skill_presets import (
    get_character_preset,
    get_research_profile_preset,
    normalize_character,
    normalize_research_profile,
)


SCHEMA_VERSION = "3"
PRIMARY_ARTIFACTS = (
    "SKILL.md",
    "work.md",
    "persona.md",
    "work_skill.md",
    "persona_skill.md",
    "manifest.json",
)


def now_iso() -> str:
    """Return the current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def flatten_legacy_tags(meta: dict) -> list[str]:
    """Extract gallery tags from the legacy tags structure."""
    tags = meta.get("classification", {}).get("tags")
    if isinstance(tags, list) and tags:
        return tags

    legacy_tags = meta.get("tags", {})
    if isinstance(legacy_tags, list):
        return [item for item in legacy_tags if isinstance(item, str) and item]

    results: list[str] = []
    for key in ("personality", "culture"):
        value = legacy_tags.get(key, [])
        if isinstance(value, list):
            results.extend(item for item in value if isinstance(item, str) and item)
    return results


def resolve_character(meta: dict, explicit_character: str | None = None) -> str:
    """Resolve the active character family from new or legacy fields."""
    return normalize_character(
        explicit_character
        or meta.get("character")
        or meta.get("type")
        or meta.get("generation", {}).get("character")
    )


def resolve_research_profile(
    meta: dict,
    character: str,
    explicit_research_profile: str | None = None,
) -> str:
    """Resolve the active research profile for the selected character family."""
    return normalize_research_profile(
        character,
        explicit_research_profile
        or meta.get("research_profile")
        or meta.get("generation", {}).get("research_profile")
        or meta.get("engine", {}).get("research_profile"),
    )


def build_identity_string(meta: dict) -> str:
    """Build a human-readable identity string from metadata."""
    preset = get_character_preset(meta.get("character"))
    profile = meta.get("profile", {})

    if isinstance(profile, str):
        return profile.strip() or preset["identity_label"]
    if not isinstance(profile, dict):
        return preset["identity_label"]

    parts = []
    for key in ("company", "level", "role", "occupation", "identity", "specialty", "known_for"):
        value = profile.get(key, "")
        if value:
            parts.append(value)

    identity = " ".join(parts) if parts else preset["identity_label"]

    mbti = profile.get("mbti", "")
    if mbti:
        identity += f", MBTI {mbti}"

    return identity


def build_artifact_names(meta: dict) -> dict:
    """Generate artifact names from the selected character preset."""
    preset = get_character_preset(meta.get("character"))
    slug = meta["slug"]
    prefix = preset["skill_name_prefix"]
    command_slug = slug.replace("_", "-")
    command_base = f"{meta['character']}-{command_slug}"
    return {
        "combined_skill": "SKILL.md",
        "work_skill": "work_skill.md",
        "persona_skill": "persona_skill.md",
        "work_doc": "work.md",
        "persona_doc": "persona.md",
        "manifest": "manifest.json",
        "combined_name": f"{prefix}_{slug}",
        "work_name": f"{prefix}_{slug}_work",
        "persona_name": f"{prefix}_{slug}_persona",
        "combined_command": command_base,
        "work_command": f"{command_base}-work",
        "persona_command": f"{command_base}-persona",
    }


def sync_legacy_fields(meta: dict) -> dict:
    """Mirror new schema fields back to the legacy top-level structure."""
    lifecycle = meta.setdefault("lifecycle", {})
    generation = meta.setdefault("generation", {})

    meta["name"] = meta.get("name") or meta.get("display_name") or meta.get("slug", "")
    meta["display_name"] = meta.get("display_name") or meta["name"]

    meta["created_at"] = lifecycle.get("created_at", meta.get("created_at", now_iso()))
    meta["updated_at"] = lifecycle.get("updated_at", meta.get("updated_at", meta["created_at"]))
    meta["version"] = lifecycle.get("version", meta.get("version", "v1"))
    meta["corrections_count"] = generation.get(
        "corrections_count",
        meta.get("corrections_count", 0),
    )

    meta["type"] = meta.get("type") or meta.get("character") or "colleague"
    generation.setdefault("character", meta["character"])
    generation.setdefault("preset", meta["preset"])

    lifecycle["created_at"] = meta["created_at"]
    lifecycle["updated_at"] = meta["updated_at"]
    lifecycle["version"] = meta["version"]
    generation["corrections_count"] = meta["corrections_count"]
    return meta


def enrich_skill_meta(meta: dict, slug: str, character: str | None = None) -> dict:
    """Upgrade legacy metadata to the dot-skill engine schema."""
    result = deepcopy(meta)
    resolved_character = resolve_character(result, character)
    preset = get_character_preset(resolved_character)
    resolved_research_profile = resolve_research_profile(result, resolved_character)
    research_profile = get_research_profile_preset(resolved_character, resolved_research_profile)

    lifecycle = result.setdefault("lifecycle", {})
    generation = result.setdefault("generation", {})
    classification = result.setdefault("classification", {})
    source_context = result.setdefault("source_context", {})
    engine = result.setdefault("engine", {})

    result["schema_version"] = SCHEMA_VERSION
    result["slug"] = slug
    result["kind"] = result.get("kind") or "meta-skill"
    result["character"] = resolved_character
    result["research_profile"] = resolved_research_profile
    result.setdefault("subtype", None)
    result["preset"] = result.get("preset") or generation.get("preset") or preset["prompt_bundle"]["preset"]

    display_name = result.get("display_name") or result.get("name") or slug
    result["display_name"] = display_name
    result["name"] = result.get("name") or display_name
    result["id"] = result.get("id") or f"{result['kind']}.{resolved_character}.{slug}"

    created_at = result.get("created_at") or lifecycle.get("created_at") or now_iso()
    updated_at = result.get("updated_at") or lifecycle.get("updated_at") or created_at
    version = result.get("version") or lifecycle.get("version") or "v1"
    corrections_count = result.get("corrections_count", generation.get("corrections_count", 0))

    source_context.setdefault("domain", preset["source_domain"])
    source_context.setdefault("relationship_to_user", preset["relationship_to_user"])
    source_context.setdefault("is_real_person", preset["is_real_person"])
    source_context.setdefault("is_public_figure", preset["is_public_figure"])
    source_context.setdefault("is_fictional", preset["is_fictional"])

    classification.setdefault("gallery_category", preset["gallery_category"])
    classification.setdefault("tags", flatten_legacy_tags(result))
    classification.setdefault("language", "en")

    result["artifacts"] = {
        **build_artifact_names(result),
        **result.get("artifacts", {}),
    }

    engine.setdefault("name", "dot-skill")
    engine.setdefault("kind", "meta-skill")
    engine.setdefault("character", resolved_character)
    engine.setdefault("research_profile", resolved_research_profile)
    engine.setdefault("preset", result["preset"])
    engine.setdefault("prompt_bundle", preset["prompt_bundle"])
    engine.setdefault("research_profile_bundle", research_profile.get("prompt_bundle", {}))
    engine.setdefault("research_profile_references", research_profile.get("references", []))
    engine.setdefault("merge_strategy", research_profile.get("merge_strategy", "compact"))
    engine.setdefault("quality_profile", research_profile.get("quality_profile", "budget-friendly"))
    engine.setdefault("knowledge_dirs", preset.get("knowledge_dirs", []))
    engine.setdefault("storage_root", preset.get("storage_root", preset["legacy_storage_root"]))
    if preset.get("research_tools"):
        engine.setdefault("research_tools", preset["research_tools"])

    generation.setdefault("engine", "dot-skill")
    generation.setdefault("character", resolved_character)
    generation.setdefault("research_profile", resolved_research_profile)
    generation.setdefault("preset", result["preset"])
    generation.setdefault("prompt_bundle", preset["prompt_bundle"])
    generation.setdefault("research_profile_bundle", research_profile.get("prompt_bundle", {}))
    generation.setdefault("research_profile_references", research_profile.get("references", []))
    generation.setdefault("merge_strategy", research_profile.get("merge_strategy", "compact"))
    generation.setdefault("quality_profile", research_profile.get("quality_profile", "budget-friendly"))
    generation.setdefault("knowledge_dirs", preset.get("knowledge_dirs", []))
    generation.setdefault("storage_root", preset.get("storage_root", preset["legacy_storage_root"]))
    if preset.get("research_tools"):
        generation.setdefault("research_tools", preset["research_tools"])
    generation.setdefault("created_from", result.get("knowledge_sources", []))
    generation["corrections_count"] = corrections_count

    lifecycle.setdefault("status", "active")
    lifecycle["created_at"] = created_at
    lifecycle["updated_at"] = updated_at
    lifecycle["version"] = version

    result["compat"] = {
        "legacy_command": preset["command_aliases"][0],
        "legacy_storage_root": preset["legacy_storage_root"],
        "legacy_type": preset["legacy_type"],
        **result.get("compat", {}),
    }
    result["type"] = result.get("type") or preset["legacy_type"]

    if not result.get("summary"):
        identity = build_identity_string(result)
        result["summary"] = f"{display_name}, {identity}" if identity else display_name

    return sync_legacy_fields(result)


def build_manifest(meta: dict) -> dict:
    """Build a manifest consumable by install and gallery flows."""
    artifacts = meta["artifacts"]
    return {
        "manifest_version": "1",
        "id": meta["id"],
        "kind": meta["kind"],
        "character": meta["character"],
        "research_profile": meta.get("research_profile", "standard"),
        "preset": meta["preset"],
        "display_name": meta["display_name"],
        "entrypoints": {
            "default": artifacts["combined_skill"],
            "work": artifacts["work_skill"],
            "persona": artifacts["persona_skill"],
        },
        "artifacts": [
            artifacts["combined_skill"],
            artifacts["work_doc"],
            artifacts["persona_doc"],
            "meta.json",
            artifacts["manifest"],
        ],
        "capabilities": ["persona", "work"],
        "engine": meta["engine"],
        "toolchain": {
            "prompt_bundle": meta["engine"].get("prompt_bundle", {}),
            "research_profile": meta["engine"].get("research_profile", "standard"),
            "research_profile_bundle": meta["engine"].get("research_profile_bundle", {}),
            "research_profile_references": meta["engine"].get("research_profile_references", []),
            "merge_strategy": meta["engine"].get("merge_strategy", "compact"),
            "quality_profile": meta["engine"].get("quality_profile", "budget-friendly"),
            "research_tools": meta["engine"].get("research_tools", {}),
            "knowledge_dirs": meta["engine"].get("knowledge_dirs", []),
        },
        "install": {
            "compatible_runtimes": ["claude-code", "openclaw", "hermes", "codex"],
            "min_schema_version": SCHEMA_VERSION,
            "installers": {
                "claude-code": "tools/install_claude_generated_skill.py",
                "openclaw": "tools/install_openclaw_generated_skill.py",
                "codex": "tools/install_codex_generated_skill.py",
            },
            "slash_commands": {
                "default": artifacts["combined_command"],
                "work": artifacts["work_command"],
                "persona": artifacts["persona_command"],
            },
        },
    }
