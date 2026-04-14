import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_WRITER = REPO_ROOT / "tools" / "skill_writer.py"


class SkillWriterReviewerTests(unittest.TestCase):
    def test_create_pr_reviewer_writes_expected_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            meta_path = tmp_path / "meta.json"
            review_path = tmp_path / "review.md"
            examples_path = tmp_path / "examples.md"
            base_dir = tmp_path / "reviewers" / "pr"

            meta_path.write_text(
                json.dumps(
                    {
                        "name": "alex",
                        "language": "en",
                        "profile": {"company": "Acme", "role": "backend engineer"},
                    }
                ),
                encoding="utf-8",
            )
            review_path.write_text(
                "# alex - PR Review Rules\n\n## Severity\n\n- Block on correctness regressions.\n",
                encoding="utf-8",
            )
            examples_path.write_text(
                "# alex - PR Review Examples\n\n- blocker: missing rollback path\n",
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(SKILL_WRITER),
                    "--action",
                    "create-reviewer",
                    "--reviewer-type",
                    "pr",
                    "--slug",
                    "alex",
                    "--meta",
                    str(meta_path),
                    "--review",
                    str(review_path),
                    "--examples",
                    str(examples_path),
                    "--base-dir",
                    str(base_dir),
                ],
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            reviewer_dir = base_dir / "alex"
            self.assertTrue((reviewer_dir / "SKILL.md").exists())
            self.assertTrue((reviewer_dir / "review.md").exists())
            self.assertTrue((reviewer_dir / "examples.md").exists())
            self.assertTrue((reviewer_dir / "meta.json").exists())

            meta = json.loads((reviewer_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["reviewer_type"], "pr")
            self.assertEqual(meta["slug"], "alex")
            self.assertIn("pr-reviewer-alex", (reviewer_dir / "SKILL.md").read_text(encoding="utf-8"))

    def test_list_action_reads_reviewer_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            reviewer_dir = tmp_path / "reviewers" / "design" / "morgan"
            reviewer_dir.mkdir(parents=True)
            (reviewer_dir / "meta.json").write_text(
                json.dumps(
                    {
                        "name": "morgan",
                        "slug": "morgan",
                        "language": "en",
                        "reviewer_type": "design",
                        "version": "v1",
                        "updated_at": "2026-04-13T00:00:00+00:00",
                        "corrections_count": 0,
                        "profile": {"company": "Acme", "role": "staff engineer"},
                    }
                ),
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(SKILL_WRITER),
                    "--action",
                    "list",
                    "--base-dir",
                    str(tmp_path / "reviewers" / "design"),
                ],
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("morgan", result.stdout)
            self.assertIn("design", result.stdout)


if __name__ == "__main__":
    unittest.main()
