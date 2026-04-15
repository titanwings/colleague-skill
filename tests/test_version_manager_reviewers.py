import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VERSION_MANAGER = REPO_ROOT / "tools" / "version_manager.py"


class VersionManagerReviewerTests(unittest.TestCase):
    def test_backup_and_rollback_restore_reviewer_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            reviewer_dir = tmp_path / "reviewers" / "pr" / "alex"
            (reviewer_dir / "versions").mkdir(parents=True)
            (reviewer_dir / "SKILL.md").write_text("v1 skill", encoding="utf-8")
            (reviewer_dir / "review.md").write_text("v1 review", encoding="utf-8")
            (reviewer_dir / "examples.md").write_text("v1 examples", encoding="utf-8")
            (reviewer_dir / "meta.json").write_text(
                json.dumps({"version": "v1", "updated_at": "2026-04-13T00:00:00+00:00"}),
                encoding="utf-8",
            )

            backup = subprocess.run(
                [
                    sys.executable,
                    str(VERSION_MANAGER),
                    "--action",
                    "backup",
                    "--slug",
                    "alex",
                    "--base-dir",
                    str(tmp_path / "reviewers" / "pr"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(backup.returncode, 0, backup.stderr)
            self.assertTrue((reviewer_dir / "versions" / "v1" / "review.md").exists())
            self.assertTrue((reviewer_dir / "versions" / "v1" / "examples.md").exists())

            (reviewer_dir / "SKILL.md").write_text("v2 skill", encoding="utf-8")
            (reviewer_dir / "review.md").write_text("v2 review", encoding="utf-8")
            (reviewer_dir / "examples.md").write_text("v2 examples", encoding="utf-8")
            (reviewer_dir / "meta.json").write_text(
                json.dumps({"version": "v2", "updated_at": "2026-04-13T01:00:00+00:00"}),
                encoding="utf-8",
            )

            rollback = subprocess.run(
                [
                    sys.executable,
                    str(VERSION_MANAGER),
                    "--action",
                    "rollback",
                    "--slug",
                    "alex",
                    "--version",
                    "v1",
                    "--base-dir",
                    str(tmp_path / "reviewers" / "pr"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(rollback.returncode, 0, rollback.stderr)
            self.assertEqual((reviewer_dir / "review.md").read_text(encoding="utf-8"), "v1 review")
            self.assertEqual((reviewer_dir / "examples.md").read_text(encoding="utf-8"), "v1 examples")


if __name__ == "__main__":
    unittest.main()
