#!/usr/bin/env python3
"""Run lightweight quality checks against a celebrity-oriented skill draft."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse


GENERIC_URL_PATHS = {
    "",
    "/",
    "/topic",
    "/topic/",
    "/search",
    "/search/",
    "/video",
    "/video/",
    "/article",
    "/article/",
    "/read",
    "/read/",
    "/podcast",
    "/podcast/",
}
TIMESTAMP_PATTERN = re.compile(r"\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?\b")


DEFAULT_RESEARCH_METRICS = {
    "files_scanned": 0,
    "unique_urls": 0,
    "primary_source_markers": 0,
    "source_metadata_blocks": 0,
    "contradiction_bullets": 0,
    "inference_bullets": 0,
    "pattern_bullets": 0,
    "gap_bullets": 0,
    "long_quote_lines": 0,
    "track_coverage_count": 0,
    "high_tier_sources": 0,
    "mid_tier_sources": 0,
    "low_tier_sources": 0,
    "weighted_source_primary_ratio": 0,
    "research_audit_present": False,
    "synthesis_review_present": False,
    "validation_review_present": False,
    "research_audit_pass": False,
    "validation_review_pass": False,
    "known_answer_questions": 0,
    "edge_case_markers": 0,
}


def extract_summary_metric(summary_text: str, label: str) -> int:
    """Extract an integer metric from the merged research summary."""
    match = re.search(rf"{re.escape(label)}:\s*(\d+)", summary_text)
    return int(match.group(1)) if match else 0


def extract_summary_percentage(summary_text: str, label: str) -> int:
    """Extract a percentage metric (like `50%`) from the merged research summary."""
    match = re.search(rf"{re.escape(label)}:\s*(\d+)%", summary_text)
    return int(match.group(1)) if match else 0


def review_status_is_pass(text: str) -> bool:
    """Return True when a review file explicitly passes."""
    return bool(
        re.search(r"Status:\s*PASS\b", text, re.IGNORECASE)
        or re.search(r"Release readiness:\s*ready\b", text, re.IGNORECASE)
        or re.search(r"Verdict:?\s*PASS\b", text, re.IGNORECASE)
    )


def is_source_like_url(url: str) -> bool:
    """Return True when a URL looks like a concrete source rather than a homepage."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False

    path = (parsed.path or "").rstrip("/")
    normalized_path = path or "/"
    if normalized_path in GENERIC_URL_PATHS:
        return False

    segments = [segment for segment in path.split("/") if segment]
    if len(segments) >= 2:
        return True

    slug = segments[0] if segments else ""
    if len(slug) >= 8:
        return True

    query = parsed.query.lower()
    if any(marker in query for marker in ("id=", "vid=", "aid=", "bvid=", "p=", "article")):
        return True

    return False


def load_research_metrics(path: Path) -> dict:
    """Load merged research metrics adjacent to a skill directory when available."""
    skill_root = path if path.is_dir() else path.parent
    summary_path = skill_root / "knowledge" / "research" / "merged" / "summary.md"
    reviews_dir = skill_root / "knowledge" / "research" / "reviews"
    audit_path = reviews_dir / "research_audit.md"
    synthesis_path = reviews_dir / "synthesis.md"
    validation_path = reviews_dir / "validation.md"
    if not summary_path.exists():
        return {
            **DEFAULT_RESEARCH_METRICS,
            "research_audit_present": audit_path.exists(),
            "synthesis_review_present": synthesis_path.exists(),
            "validation_review_present": validation_path.exists(),
            "research_audit_pass": review_status_is_pass(audit_path.read_text(encoding="utf-8")) if audit_path.exists() else False,
            "validation_review_pass": review_status_is_pass(validation_path.read_text(encoding="utf-8")) if validation_path.exists() else False,
        }

    summary_text = summary_path.read_text(encoding="utf-8")
    audit_text = audit_path.read_text(encoding="utf-8") if audit_path.exists() else ""
    validation_text = validation_path.read_text(encoding="utf-8") if validation_path.exists() else ""
    return {
        "files_scanned": extract_summary_metric(summary_text, "Files scanned"),
        "unique_urls": extract_summary_metric(summary_text, "Unique URLs"),
        "primary_source_markers": extract_summary_metric(summary_text, "Primary-source markers"),
        "source_metadata_blocks": extract_summary_metric(summary_text, "Source metadata blocks"),
        "contradiction_bullets": extract_summary_metric(summary_text, "Contradiction bullets"),
        "inference_bullets": extract_summary_metric(summary_text, "Inference bullets"),
        "pattern_bullets": extract_summary_metric(summary_text, "Pattern bullets"),
        "gap_bullets": extract_summary_metric(summary_text, "Gap bullets"),
        "long_quote_lines": extract_summary_metric(summary_text, "Potential long quote lines"),
        "track_coverage_count": extract_summary_metric(summary_text, "Track coverage count"),
        "high_tier_sources": extract_summary_metric(summary_text, "Tier 1-3 (high-quality primary)"),
        "mid_tier_sources": extract_summary_metric(summary_text, "Tier 4-5 (medium / short-form firsthand)"),
        "low_tier_sources": extract_summary_metric(summary_text, "Tier 6-7 (external / secondhand)"),
        "weighted_source_primary_ratio": extract_summary_percentage(summary_text, "Weighted-source primary ratio"),
        "research_audit_present": audit_path.exists(),
        "synthesis_review_present": synthesis_path.exists(),
        "validation_review_present": validation_path.exists(),
        "research_audit_pass": review_status_is_pass(audit_text),
        "validation_review_pass": review_status_is_pass(validation_text),
        "known_answer_questions": len(re.findall(r"Question:\s*", audit_text + "\n" + validation_text)),
        "edge_case_markers": len(re.findall(r"edge-case|edge case", audit_text + "\n" + validation_text, re.IGNORECASE)),
    }


def is_copyright_safe_text(text: str) -> bool:
    """Return whether the rendered skill avoids obvious transcript-like verbatim dumps."""
    if "```" in text:
        return False
    if re.search(r"^\s*>", text, re.MULTILINE):
        return False
    if TIMESTAMP_PATTERN.search(text):
        return False
    return True


def evaluate_skill_text(
    text: str,
    profile: str = "budget-friendly",
    research_metrics: dict | None = None,
) -> dict:
    """Evaluate a skill draft against the configured celebrity distillation checklist."""
    bullet_count = len(re.findall(r"^\s*[-*]\s+", text, re.MULTILINE))
    urls = re.findall(r"https?://[^\s)>\]]+", text)
    grounded_urls = {url.rstrip(".,") for url in urls if is_source_like_url(url.rstrip(".,"))}
    metrics = {
        **DEFAULT_RESEARCH_METRICS,
        **(research_metrics or {}),
    }
    strict = profile == "budget-unfriendly"
    checks = {
        "mental_models": bullet_count >= 3 and bool(re.search(r"mental model|心智模型", text, re.IGNORECASE)),
        "limitations": bool(re.search(r"limitations|boundary|局限|边界", text, re.IGNORECASE)),
        "expression_dna": bool(re.search(r"expression DNA|表达 DNA|sentence rhythm|metaphor", text, re.IGNORECASE)),
        "honest_boundaries": bool(re.search(r"honest boundar|诚实边界|what .* does not know", text, re.IGNORECASE)),
        "internal_tension": bool(re.search(r"contradiction|tension|矛盾|张力", text, re.IGNORECASE)),
        "intellectual_genealogy": (
            bool(re.search(r"intellectual genealogy|influenced by|智识谱系|influenced:", text, re.IGNORECASE))
        ) if strict else True,
        "agentic_protocol": (
            bool(re.search(r"agentic protocol|research dimensions|step 1.*classify|分析协议", text, re.IGNORECASE))
        ) if strict else True,
        "source_grounding": len(grounded_urls) >= (4 if strict else 2),
        "copyright_safety": is_copyright_safe_text(text) and metrics["long_quote_lines"] == 0,
        "source_hierarchy": (
            metrics["weighted_source_primary_ratio"] >= 50
            or metrics["high_tier_sources"] >= 3
        ) if strict else True,
        "review_chain": (
            metrics["research_audit_present"]
            and metrics["synthesis_review_present"]
            and metrics["validation_review_present"]
            and metrics["research_audit_pass"]
            and metrics["validation_review_pass"]
        ) if strict else True,
        "validation_depth": (
            metrics["known_answer_questions"] >= 2
            and metrics["edge_case_markers"] >= 1
        ) if strict else True,
        "research_depth": (
            metrics["files_scanned"] >= 6
            and metrics["unique_urls"] >= 8
            and metrics["primary_source_markers"] >= 3
            and metrics["source_metadata_blocks"] >= 6
            and metrics["contradiction_bullets"] >= 6
            and metrics["inference_bullets"] >= 6
            and metrics["track_coverage_count"] >= 6
        ) if strict else True,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "bullet_count": bullet_count,
        "grounded_url_count": len(grounded_urls),
        "profile": profile,
        "research_metrics": metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run quality checks on a skill draft")
    parser.add_argument("path", help="Path to SKILL.md or another markdown draft")
    parser.add_argument(
        "--profile",
        default="budget-friendly",
        choices=["budget-friendly", "budget-unfriendly"],
        help="Celebrity research profile used to set quality thresholds",
    )
    parser.add_argument("--json", action="store_true", help="Print the report as JSON")
    args = parser.parse_args()

    target = Path(args.path).expanduser()
    report = evaluate_skill_text(
        target.read_text(encoding="utf-8") if target.is_file() else (target / "SKILL.md").read_text(encoding="utf-8"),
        profile=args.profile,
        research_metrics=load_research_metrics(target),
    )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    for name, passed in report["checks"].items():
        status = "PASS" if passed else "FAIL"
        print(f"{status}  {name}")
    print(f"OVERALL {'PASS' if report['passed'] else 'FAIL'}")


if __name__ == "__main__":
    main()
