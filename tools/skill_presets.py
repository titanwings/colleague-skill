#!/usr/bin/env python3
"""
Character preset registry for the dot-skill engine.

The engine itself is a meta-skill. Character presets define which prompt family
and rendering defaults should be used for a given distillation target.
"""

from __future__ import annotations

from pathlib import Path


COMMON_KNOWLEDGE_DIRS = [
    "docs",
    "messages",
    "emails",
]

DEFAULT_RESEARCH_PROFILE = "budget-friendly"


CHARACTER_PRESETS = {
    "colleague": {
        "character": "colleague",
        "display_name": "Colleague",
        "identity_label": "Colleague",
        "gallery_category": "Colleague",
        "source_domain": "work",
        "relationship_to_user": "coworker",
        "is_real_person": True,
        "is_public_figure": False,
        "is_fictional": False,
        "command_aliases": ["/create-colleague", "/create-skill"],
        "knowledge_dirs": COMMON_KNOWLEDGE_DIRS,
        "storage_root": "skills/colleague",
        "prompt_bundle": {
            "preset": "dot.colleague.v1",
            "intake": "prompts/intake.md",
            "work_analyzer": "prompts/work_analyzer.md",
            "persona_analyzer": "prompts/persona_analyzer.md",
            "work_builder": "prompts/work_builder.md",
            "persona_builder": "prompts/persona_builder.md",
            "merger": "prompts/merger.md",
            "correction_handler": "prompts/correction_handler.md",
        },
        "legacy_storage_root": "colleagues",
        "skill_name_prefix": "colleague",
        "legacy_type": "colleague",
    },
    "relationship": {
        "character": "relationship",
        "display_name": "Relationship",
        "identity_label": "Relationship",
        "gallery_category": "Relationship",
        "source_domain": "personal",
        "relationship_to_user": "relationship",
        "is_real_person": True,
        "is_public_figure": False,
        "is_fictional": False,
        "command_aliases": ["/create-ex", "/create-skill"],
        "knowledge_dirs": COMMON_KNOWLEDGE_DIRS,
        "storage_root": "skills/relationship",
        "prompt_bundle": {
            "preset": "dot.relationship.v1",
            "intake": "prompts/relationship/intake.md",
            "work_analyzer": "prompts/work_analyzer.md",
            "persona_analyzer": "prompts/relationship/persona_analyzer.md",
            "work_builder": "prompts/work_builder.md",
            "persona_builder": "prompts/relationship/persona_builder.md",
            "merger": "prompts/relationship/merger.md",
            "correction_handler": "prompts/correction_handler.md",
        },
        "legacy_storage_root": "skills/relationship",
        "skill_name_prefix": "relationship",
        "legacy_type": "relationship",
    },
    "celebrity": {
        "character": "celebrity",
        "display_name": "Celebrity",
        "identity_label": "Celebrity",
        "gallery_category": "Celebrity",
        "source_domain": "public",
        "relationship_to_user": "public_figure",
        "is_real_person": True,
        "is_public_figure": True,
        "is_fictional": False,
        "command_aliases": ["/create-icon", "/create-skill"],
        "knowledge_dirs": COMMON_KNOWLEDGE_DIRS + [
            "research/raw",
            "research/merged",
            "research/reviews",
            "transcripts",
            "subtitles",
        ],
        "storage_root": "skills/celebrity",
        "prompt_bundle": {
            "preset": "dot.celebrity.v1",
            "intake": "prompts/celebrity/intake.md",
            "research": "prompts/celebrity/research.md",
            "work_analyzer": "prompts/work_analyzer.md",
            "persona_analyzer": "prompts/celebrity/persona_analyzer.md",
            "work_builder": "prompts/work_builder.md",
            "persona_builder": "prompts/celebrity/persona_builder.md",
            "merger": "prompts/celebrity/merger.md",
            "correction_handler": "prompts/correction_handler.md",
        },
        "default_research_profile": DEFAULT_RESEARCH_PROFILE,
        "research_profiles": {
            "budget-friendly": {
                "name": "budget-friendly",
                "display_name": "Budget Friendly",
                "description": "Lean public-source distillation with compact review and lightweight validation.",
                "prompt_bundle": {
                    "research": "prompts/celebrity/research.md",
                    "persona_analyzer": "prompts/celebrity/persona_analyzer.md",
                    "persona_builder": "prompts/celebrity/persona_builder.md",
                },
                "references": [],
                "merge_strategy": "compact",
                "quality_profile": "budget-friendly",
                "min_raw_notes": 3,
                "min_grounded_urls": 2,
                "min_primary_markers": 0,
            },
            "budget-unfriendly": {
                "name": "budget-unfriendly",
                "display_name": "Budget Unfriendly",
                "description": "Deep six-track research with evidence grading, synthesis review, and stricter validation.",
                "prompt_bundle": {
                    "research": "prompts/celebrity/budget_unfriendly/research.md",
                    "audit": "prompts/celebrity/budget_unfriendly/audit.md",
                    "synthesis": "prompts/celebrity/budget_unfriendly/synthesis.md",
                    "validation": "prompts/celebrity/budget_unfriendly/validation.md",
                    "persona_analyzer": "prompts/celebrity/budget_unfriendly/persona_analyzer.md",
                    "persona_builder": "prompts/celebrity/budget_unfriendly/persona_builder.md",
                },
                "references": [
                    "references/celebrity_budget_unfriendly_framework.md",
                    "references/celebrity_budget_unfriendly_template.md",
                ],
                "merge_strategy": "deep",
                "quality_profile": "budget-unfriendly",
                "min_raw_notes": 6,
                "min_grounded_urls": 8,
                "min_primary_markers": 3,
                "min_source_metadata_blocks": 6,
                "min_contradiction_bullets": 6,
                "min_inference_bullets": 6,
                "required_review_files": [
                    "research_audit.md",
                    "synthesis.md",
                    "validation.md",
                ],
            },
        },
        "research_tools": {
            "subtitle_downloader": "tools/research/download_subtitles.sh",
            "subtitle_cleaner": "tools/research/srt_to_transcript.py",
            "research_merger": "tools/research/merge_research.py",
            "quality_check": "tools/research/quality_check.py",
        },
        "legacy_storage_root": "skills/celebrity",
        "skill_name_prefix": "celebrity",
        "legacy_type": "celebrity",
    },
}


CHARACTER_ALIASES = {
    "ex": "relationship",
    "self": "relationship",
    "yourself": "relationship",
    "icon": "celebrity",
    "character": "celebrity",
    "fictional-character": "celebrity",
    "nuwa": "celebrity",
}


def normalize_character(character: str | None) -> str:
    """Normalize a character family and fall back to colleague."""
    if not character:
        return "colleague"
    normalized = character.strip().lower()
    normalized = CHARACTER_ALIASES.get(normalized, normalized)
    return normalized if normalized in CHARACTER_PRESETS else "colleague"


def get_character_preset(character: str | None) -> dict:
    """Return the preset for the given character family."""
    return CHARACTER_PRESETS[normalize_character(character)]


def normalize_research_profile(character: str | None, research_profile: str | None) -> str:
    """Normalize a research profile for the selected character family."""
    preset = get_character_preset(character)
    profiles = preset.get("research_profiles", {})
    if not profiles:
        return "standard"
    if not research_profile:
        return preset.get("default_research_profile", DEFAULT_RESEARCH_PROFILE)

    normalized = research_profile.strip().lower().replace("_", "-")
    return (
        normalized
        if normalized in profiles
        else preset.get("default_research_profile", DEFAULT_RESEARCH_PROFILE)
    )


def get_research_profile_preset(character: str | None, research_profile: str | None = None) -> dict:
    """Return the research-profile preset for the given character family."""
    preset = get_character_preset(character)
    profiles = preset.get("research_profiles", {})
    if not profiles:
        return {
            "name": "standard",
            "display_name": "Standard",
            "description": "Default profile for non-celebrity families.",
            "prompt_bundle": {},
            "references": [],
            "merge_strategy": "compact",
            "quality_profile": "budget-friendly",
            "min_raw_notes": 0,
            "min_grounded_urls": 0,
            "min_primary_markers": 0,
        }
    return profiles[normalize_research_profile(character, research_profile)]


def normalize_skill_type(skill_type: str | None) -> str:
    """Compatibility shim for older callers that still pass a skill type."""
    return normalize_character(skill_type)


def get_skill_preset(skill_type: str | None) -> dict:
    """Compatibility shim for older callers that still request skill presets."""
    return get_character_preset(skill_type)


def canonical_storage_root(character: str | None) -> Path:
    """Return the canonical storage root for a character family."""
    preset = get_character_preset(character)
    return Path(preset.get("storage_root") or preset["legacy_storage_root"])


def legacy_storage_root(character: str | None) -> Path | None:
    """Return the legacy storage root when it differs from the canonical one."""
    preset = get_character_preset(character)
    legacy = preset.get("legacy_storage_root")
    canonical = str(canonical_storage_root(character))
    if legacy and legacy != canonical:
        return Path(legacy)
    return None


def resolve_storage_root(character: str | None, base_dir_arg: str | None = None) -> Path:
    """Resolve the canonical write target for a character family."""
    if base_dir_arg:
        return Path(base_dir_arg).expanduser()
    return canonical_storage_root(character)


def resolve_existing_storage_root(
    character: str | None,
    slug: str | None = None,
    base_dir_arg: str | None = None,
) -> Path:
    """Resolve an existing storage root while keeping legacy paths readable."""
    if base_dir_arg:
        return Path(base_dir_arg).expanduser()

    canonical = canonical_storage_root(character)
    legacy = legacy_storage_root(character)

    if slug:
        if (canonical / slug).exists():
            return canonical
        if legacy and (legacy / slug).exists():
            return legacy

    if canonical.exists():
        return canonical
    if legacy and legacy.exists():
        return legacy
    return canonical
