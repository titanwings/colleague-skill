from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from research.merge_research import merge_research  # noqa: E402
from research.quality_check import evaluate_skill_text  # noqa: E402
from research.srt_to_transcript import clean_subtitle_text, convert_file  # noqa: E402


class SubtitleTranscriptTest(unittest.TestCase):
    def test_clean_subtitle_text_removes_timestamps_and_duplicates(self) -> None:
        subtitle = """WEBVTT

00:00:01.000 --> 00:00:03.000
<i>Hello</i>

00:00:03.000 --> 00:00:05.000
Hello

00:00:05.000 --> 00:00:07.000 align:start position:0%
World.
"""
        transcript = clean_subtitle_text(subtitle)
        self.assertNotIn("-->", transcript)
        self.assertNotIn("<i>", transcript)
        self.assertIn("Hello World.", transcript)

    def test_convert_file_writes_transcript(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "sample.srt"
            output_path = Path(tmp_dir) / "sample_transcript.txt"
            input_path.write_text(
                "1\n00:00:00,000 --> 00:00:01,000\nLine one.\n",
                encoding="utf-8",
            )
            convert_file(input_path, output_path)
            self.assertIn("Line one.", output_path.read_text(encoding="utf-8"))


class ResearchMergeTest(unittest.TestCase):
    def test_merge_research_writes_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            skill_dir = Path(tmp_dir) / "celebrity"
            raw_dir = skill_dir / "knowledge" / "research" / "raw"
            raw_dir.mkdir(parents=True)
            (raw_dir / "01.md").write_text(
                "# Note\n"
                "## Source Metadata\n"
                "- URL: https://example.com/a\n"
                "- Grounding level: primary\n"
                "## Evidence\n"
                "- Strong focus on first-person essays\n"
                "## Contradictions\n"
                "- Repeats a skeptical framing\n"
                "## Inferences\n"
                "- Likely values first-person observation.\n"
                "primary source\n",
                encoding="utf-8",
            )
            (raw_dir / "02.md").write_text(
                "# Note\n"
                "## Source Metadata\n"
                "- URL: https://example.com/b\n"
                "- Grounding level: secondary\n"
                "## Evidence\n"
                "- Uses metaphor under pressure\n"
                "## Contradictions\n"
                "- Tension between compression and warmth\n"
                "## Inferences\n"
                "- Metaphor acts as a softening device.\n",
                encoding="utf-8",
            )

            summary_path = merge_research(skill_dir)
            summary = summary_path.read_text(encoding="utf-8")

            self.assertIn("# Research Summary", summary)
            self.assertIn("Unique URLs: 2", summary)
            self.assertIn("Total note chars:", summary)
            self.assertIn("Potential long quote lines: 0", summary)
            self.assertIn("Source metadata blocks: 2", summary)
            self.assertIn("Contradiction bullets: 2", summary)
            self.assertIn("Inference bullets: 2", summary)
            self.assertIn("01.md", summary)
            self.assertIn("Strong focus on first-person essays", summary)


class QualityCheckTest(unittest.TestCase):
    def test_evaluate_skill_text_detects_expected_signals(self) -> None:
        text = """
## mental models
- First-principles reasoning
- Skeptical framing
- Long-horizon tradeoffs

## intellectual genealogy
- Influenced by long-form systems thinking and adversarial debate.

## agentic protocol
- Step 1: classify the question.
- Step 2: inspect known-answer anchors.
- Step 3: state uncertainty before extrapolation.

## expression DNA
- Sentence rhythm is clipped.
- Uses metaphor when disagreeing.

## honest boundaries
- States what they do not know.

## contradictions
- Alternates between certainty and doubt.

Sources:
https://example.com/articles/long-form-profile
https://example.com/interviews/episode-42

limitations:
- avoids operational detail
"""
        report = evaluate_skill_text(text)
        self.assertTrue(report["passed"])
        self.assertTrue(all(report["checks"].values()))
        self.assertTrue(report["checks"]["copyright_safety"])

    def test_source_grounding_rejects_generic_homepages(self) -> None:
        text = """
## mental models
- First-principles reasoning
- Skeptical framing
- Long-horizon tradeoffs

## expression DNA
- Sentence rhythm is clipped.
- Uses metaphor when disagreeing.

## honest boundaries
- States what they do not know.

## contradictions
- Alternates between certainty and doubt.

## limitations
- Needs more verified external material.

Sources:
https://www.iqiyi.com/
https://space.bilibili.com/
https://www.zhihu.com/topic/
"""
        report = evaluate_skill_text(text)
        self.assertFalse(report["checks"]["source_grounding"])
        self.assertEqual(report["grounded_url_count"], 0)

    def test_budget_unfriendly_profile_requires_deeper_research_metrics(self) -> None:
        text = """
## mental models
- First-principles reasoning
- Skeptical framing
- Long-horizon tradeoffs

## expression DNA
- Sentence rhythm is clipped.
- Uses metaphor when disagreeing.

## honest boundaries
- States what they do not know.

## contradictions
- Alternates between certainty and doubt.

## limitations
- Needs more verified external material.

Sources:
https://example.com/articles/long-form-profile
https://example.com/interviews/episode-42
https://example.com/interviews/episode-43
https://example.com/talks/keynote-2019
"""
        report = evaluate_skill_text(
            text,
            profile="budget-unfriendly",
            research_metrics={
                "files_scanned": 4,
                "unique_urls": 4,
                "primary_source_markers": 1,
                "source_metadata_blocks": 4,
                "contradiction_bullets": 2,
                "inference_bullets": 2,
                "long_quote_lines": 0,
                "track_coverage_count": 4,
                "research_audit_present": False,
                "synthesis_review_present": False,
                "validation_review_present": False,
                "research_audit_pass": False,
                "validation_review_pass": False,
                "known_answer_questions": 1,
                "edge_case_markers": 0,
            },
        )
        self.assertFalse(report["passed"])
        self.assertFalse(report["checks"]["research_depth"])
        self.assertFalse(report["checks"]["review_chain"])
        self.assertFalse(report["checks"]["validation_depth"])

    def test_budget_unfriendly_profile_passes_with_full_review_chain(self) -> None:
        text = """
## mental models
- First-principles reasoning
- Skeptical framing
- Long-horizon tradeoffs

## intellectual genealogy
- Influenced by long-form systems thinking and adversarial debate.

## agentic protocol
- Step 1: classify the question.
- Step 2: inspect known-answer anchors.
- Step 3: state uncertainty before extrapolation.

## expression DNA
- Sentence rhythm is clipped.
- Uses metaphor when disagreeing.

## honest boundaries
- States what they do not know.

## contradictions
- Alternates between certainty and doubt.

## limitations
- Needs more verified external material.

Sources:
https://example.com/articles/long-form-profile
https://example.com/interviews/episode-42
https://example.com/interviews/episode-43
https://example.com/talks/keynote-2019
"""
        report = evaluate_skill_text(
            text,
            profile="budget-unfriendly",
            research_metrics={
                "files_scanned": 6,
                "unique_urls": 8,
                "primary_source_markers": 3,
                "source_metadata_blocks": 6,
                "contradiction_bullets": 6,
                "inference_bullets": 6,
                "long_quote_lines": 0,
                "track_coverage_count": 6,
                "high_tier_sources": 4,
                "mid_tier_sources": 2,
                "low_tier_sources": 1,
                "weighted_source_primary_ratio": 67,
                "research_audit_present": True,
                "synthesis_review_present": True,
                "validation_review_present": True,
                "research_audit_pass": True,
                "validation_review_pass": True,
                "known_answer_questions": 2,
                "edge_case_markers": 1,
            },
        )
        self.assertTrue(report["passed"])


if __name__ == "__main__":
    unittest.main()
