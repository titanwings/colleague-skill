#!/usr/bin/env python3
"""Merge raw research notes into a compact markdown summary.

Updated to support the enhanced celebrity research schema:
- Budget-friendly sections: Key Findings / Patterns and Repeated Themes /
  Contradictions / Inferences / Gaps and Missing Information
- Budget-unfriendly sections: Evidence / Patterns and Repeated Themes /
  Contradictions / Inferences / Gaps and Missing Information
- Source Metadata blocks with `Source weight: [1-7]` annotations
- Collection Metadata / Dimension Coverage blocks
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path


URL_PATTERN = re.compile(r"https?://[^\s)]+")
TIMESTAMP_PATTERN = re.compile(r"\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?\b")
TRACK_PATTERN = re.compile(r"^(\d{2})[-_]")
SECTION_PATTERN = re.compile(r"^##\s+(.+)$")
SOURCE_WEIGHT_PATTERN = re.compile(r"source weight:\s*(\d)", re.IGNORECASE)

# Sections that hold narrative bullets (not metadata)
FINDING_SECTIONS = {
    "evidence",
    "key findings",
    "paraphrased findings",
    "patterns and repeated themes",
}
CONTRADICTION_SECTIONS = {"contradictions"}
INFERENCE_SECTIONS = {"inferences", "inferences (clearly marked as inference, not fact)", "inferences (clearly marked)"}
GAP_SECTIONS = {"gaps and missing information", "gaps", "missing information"}
METADATA_SECTIONS = {"source metadata", "collection metadata", "dimension coverage"}


def collect_structured_section_metrics(text: str) -> dict:
    """Count structured markers from budget-unfriendly research notes."""
    source_metadata_blocks = 0
    contradiction_bullets = 0
    inference_bullets = 0
    pattern_bullets = 0
    gap_bullets = 0
    current_section = ""

    for line in text.splitlines():
        stripped = line.strip()
        section_match = SECTION_PATTERN.match(stripped)
        if section_match:
            current_section = section_match.group(1).strip().lower()
            if current_section == "source metadata":
                source_metadata_blocks += 1
            continue
        if not stripped.startswith("- "):
            continue
        if current_section in CONTRADICTION_SECTIONS:
            contradiction_bullets += 1
        elif any(current_section.startswith(s) for s in INFERENCE_SECTIONS):
            inference_bullets += 1
        elif current_section == "patterns and repeated themes":
            pattern_bullets += 1
        elif any(current_section.startswith(s) for s in GAP_SECTIONS):
            gap_bullets += 1

    return {
        "source_metadata_blocks": source_metadata_blocks,
        "contradiction_bullets": contradiction_bullets,
        "inference_bullets": inference_bullets,
        "pattern_bullets": pattern_bullets,
        "gap_bullets": gap_bullets,
    }


def collect_source_weight_distribution(text: str) -> Counter:
    """Count source weight annotations (1-7) across the note."""
    counter: Counter = Counter()
    for match in SOURCE_WEIGHT_PATTERN.finditer(text):
        weight = match.group(1)
        if weight in {"1", "2", "3", "4", "5", "6", "7"}:
            counter[weight] += 1
    return counter


def extract_key_findings(text: str) -> list[str]:
    """Return concise research findings, preferring Evidence / Key Findings / Patterns."""
    findings: list[str] = []
    current_section = ""
    for line in text.splitlines():
        stripped = line.strip()
        section_match = SECTION_PATTERN.match(stripped)
        if section_match:
            current_section = section_match.group(1).strip().lower()
            continue
        if not stripped.startswith("- "):
            continue
        if current_section in METADATA_SECTIONS:
            continue
        if current_section in FINDING_SECTIONS:
            findings.append(stripped[2:].strip())
    return findings


def count_potential_long_quote_lines(text: str) -> int:
    """Return a small heuristic count for likely verbatim-heavy note lines."""
    count = 0
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(">"):
            count += 1
            continue
        if TIMESTAMP_PATTERN.search(stripped):
            count += 1
            continue
        if any(mark in stripped for mark in ('"', "“", "”", "'")):
            words = re.findall(r"\S+", stripped)
            if len(words) > 25:
                count += 1
    return count


def resolve_research_root(path: Path) -> Path:
    """Accept a skill directory or a direct research directory."""
    if (path / "knowledge" / "research" / "raw").exists():
        return path / "knowledge" / "research"
    if (path / "raw").exists():
        return path
    raise FileNotFoundError(f"unable to locate research directory under: {path}")


def collect_markdown_files(research_root: Path) -> list[Path]:
    """Return raw research markdown files in a stable order."""
    return sorted((research_root / "raw").glob("*.md"))


def summarize_research_files(files: list[Path]) -> str:
    """Build a markdown summary from raw research notes."""
    source_count = 0
    primary_count = 0
    total_chars = 0
    total_findings = 0
    long_quote_lines = 0
    source_metadata_blocks = 0
    contradiction_bullets = 0
    inference_bullets = 0
    pattern_bullets = 0
    gap_bullets = 0
    urls: set[str] = set()
    key_findings: list[str] = []
    file_rows: list[str] = []
    track_ids: list[str] = []
    source_weights: Counter = Counter()
    expected_tracks = {"01", "02", "03", "04", "05", "06"}

    for file_path in files:
        text = file_path.read_text(encoding="utf-8")
        total_chars += len(text)
        source_count += len(URL_PATTERN.findall(text))
        for url in URL_PATTERN.findall(text):
            urls.add(url)
        primary_count += len(re.findall(r"\b(first-person|primary source|一手|原始)\b", text, re.IGNORECASE))
        long_quote_lines += count_potential_long_quote_lines(text)
        section_metrics = collect_structured_section_metrics(text)
        source_metadata_blocks += section_metrics["source_metadata_blocks"]
        contradiction_bullets += section_metrics["contradiction_bullets"]
        inference_bullets += section_metrics["inference_bullets"]
        pattern_bullets += section_metrics["pattern_bullets"]
        gap_bullets += section_metrics["gap_bullets"]

        file_weights = collect_source_weight_distribution(text)
        source_weights.update(file_weights)

        track_match = TRACK_PATTERN.match(file_path.name)
        if track_match:
            track_ids.append(track_match.group(1))

        findings = extract_key_findings(text)
        total_findings += len(findings)
        key_findings.extend(findings[:2])
        primary_marker = bool(re.search(r'(first-person|primary source|一手|原始)', text, re.IGNORECASE))
        file_rows.append(
            f"| {file_path.name} | {len(URL_PATTERN.findall(text))} | "
            f"{'yes' if primary_marker else 'no'} |"
        )
    missing_tracks = sorted(expected_tracks.difference(track_ids))

    high_tier_sources = source_weights["1"] + source_weights["2"] + source_weights["3"]
    mid_tier_sources = source_weights["4"] + source_weights["5"]
    low_tier_sources = source_weights["6"] + source_weights["7"]
    total_weighted = sum(source_weights.values())

    lines = [
        "# Research Summary",
        "",
        f"- Files scanned: {len(files)}",
        f"- Unique URLs: {len(urls)}",
        f"- Total source mentions: {source_count}",
        f"- Primary-source markers: {primary_count}",
        f"- Source metadata blocks: {source_metadata_blocks}",
        f"- Contradiction bullets: {contradiction_bullets}",
        f"- Inference bullets: {inference_bullets}",
        f"- Pattern bullets: {pattern_bullets}",
        f"- Gap bullets: {gap_bullets}",
        f"- Total note chars: {total_chars}",
        f"- Total bullet findings: {total_findings}",
        f"- Potential long quote lines: {long_quote_lines}",
        f"- Track coverage count: {len(set(track_ids))}",
        (
            f"- Track coverage: {', '.join(track_ids)}"
            if track_ids
            else "- Track coverage: none"
        ),
        (
            f"- Missing tracks: {', '.join(missing_tracks)}"
            if missing_tracks
            else "- Missing tracks: none"
        ),
        "",
        "## Source Weight Distribution",
        "",
        f"- Tier 1-3 (high-quality primary): {high_tier_sources}",
        f"- Tier 4-5 (medium / short-form firsthand): {mid_tier_sources}",
        f"- Tier 6-7 (external / secondhand): {low_tier_sources}",
        f"- Total weighted sources: {total_weighted}",
        (
            f"- Weighted-source primary ratio: "
            f"{(high_tier_sources / total_weighted * 100):.0f}%"
            if total_weighted
            else "- Weighted-source primary ratio: n/a (no weights annotated)"
        ),
        "",
        "## File Inventory",
        "",
        "| File | Source Mentions | Primary Marker |",
        "|------|-----------------|----------------|",
        *file_rows,
        "",
        "## Key Findings",
        "",
    ]

    if key_findings:
        lines.extend(f"- {item}" for item in key_findings[:10])
    else:
        lines.append("- No bullet findings found in raw notes yet.")

    return "\n".join(lines) + "\n"


def merge_research(path: Path) -> Path:
    """Write a merged research summary and return the output path."""
    research_root = resolve_research_root(path)
    output_dir = research_root / "merged"
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "summary.md"
    summary_path.write_text(
        summarize_research_files(collect_markdown_files(research_root)),
        encoding="utf-8",
    )
    return summary_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge raw research notes into a summary")
    parser.add_argument("path", help="Skill directory or research directory")
    args = parser.parse_args()

    summary_path = merge_research(Path(args.path).expanduser())
    print(summary_path)


if __name__ == "__main__":
    main()
