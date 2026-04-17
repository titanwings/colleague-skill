from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from install_claude_generated_skill import (  # noqa: E402
    install_generated_skill,
    should_install_command_shim,
)
import skill_writer  # noqa: E402


class ClaudeGeneratedSkillInstallTest(unittest.TestCase):
    def test_install_generated_skill_writes_claude_skill_folder(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            generated_root = tmp_root / "skills" / "celebrity"
            claude_skills = tmp_root / ".claude" / "skills"

            skill_dir = skill_writer.create_skill(
                generated_root,
                "zhou_qimo",
                {
                    "character": "celebrity",
                    "name": "周奇墨",
                    "classification": {"language": "zh-CN"},
                },
                "Work body",
                "Persona body",
            )

            result = install_generated_skill(
                skill_dir,
                claude_skills,
                force=True,
            )

            installed_file = claude_skills / "celebrity-zhou-qimo" / "SKILL.md"
            metadata_file = claude_skills / "celebrity-zhou-qimo" / ".dot-skill-install.json"

            self.assertEqual(result["command_name"], "celebrity-zhou-qimo")
            self.assertTrue(installed_file.exists())
            self.assertTrue(metadata_file.exists())
            self.assertIn(
                "name: celebrity-zhou-qimo",
                installed_file.read_text(encoding="utf-8"),
            )
            self.assertFalse(result["command_shim_installed"])

    def test_install_generated_skill_can_write_windows_command_shim(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            generated_root = tmp_root / "skills" / "relationship"
            claude_skills = tmp_root / ".claude" / "skills"
            claude_commands = tmp_root / ".claude" / "commands"

            skill_dir = skill_writer.create_skill(
                generated_root,
                "mireille",
                {
                    "character": "relationship",
                    "name": "Mireille",
                },
                "Work body",
                "Persona body",
            )

            result = install_generated_skill(
                skill_dir,
                claude_skills,
                commands_dir=claude_commands,
                force=True,
                install_command_shim=True,
            )

            command_file = claude_commands / "relationship-mireille.md"
            self.assertTrue(result["command_shim_installed"])
            self.assertEqual(result["command_path"], command_file)
            self.assertTrue(command_file.exists())
            self.assertIn(
                "name: relationship-mireille",
                command_file.read_text(encoding="utf-8"),
            )

    def test_windows_detection_only_enables_command_shim_on_windows(self) -> None:
        self.assertTrue(should_install_command_shim("Windows"))
        self.assertFalse(should_install_command_shim("Darwin"))


if __name__ == "__main__":
    unittest.main()
