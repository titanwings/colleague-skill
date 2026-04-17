from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from install_hermes_skill import install_skill  # noqa: E402


class HermesInstallTest(unittest.TestCase):
    def test_install_skill_copies_repo_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source = Path(tmp_dir) / "source"
            destination = Path(tmp_dir) / "dest" / "dot-skill"
            source.mkdir()
            (source / "SKILL.md").write_text("name: dot-skill\n", encoding="utf-8")
            (source / "README.md").write_text("# dot-skill\n", encoding="utf-8")

            installed = install_skill(source, destination)
            self.assertEqual(installed, destination)
            self.assertTrue((destination / "SKILL.md").exists())
            self.assertTrue((destination / "README.md").exists())

    def test_install_skill_dry_run_does_not_write(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source = Path(tmp_dir) / "source"
            destination = Path(tmp_dir) / "dest" / "dot-skill"
            source.mkdir()
            (source / "SKILL.md").write_text("name: dot-skill\n", encoding="utf-8")

            install_skill(source, destination, dry_run=True)
            self.assertFalse(destination.exists())

    def test_install_skill_dry_run_allows_existing_destination(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source = Path(tmp_dir) / "source"
            destination = Path(tmp_dir) / "dest" / "dot-skill"
            source.mkdir(parents=True)
            destination.mkdir(parents=True)
            (source / "SKILL.md").write_text("name: dot-skill\n", encoding="utf-8")

            result = install_skill(source, destination, dry_run=True)
            self.assertEqual(result, destination)
            self.assertTrue(destination.exists())


if __name__ == "__main__":
    unittest.main()
