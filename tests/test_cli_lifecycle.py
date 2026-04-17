from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


class CliLifecycleTest(unittest.TestCase):
    def run_cmd(
        self,
        *args: str,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        merged_env = os.environ.copy()
        merged_env.setdefault("DOT_SKILL_AUTO_INSTALL_CLAUDE", "0")
        if env:
            merged_env.update(env)
        return subprocess.run(
            list(args),
            cwd=cwd or PROJECT_ROOT,
            text=True,
            capture_output=True,
            check=True,
            env=merged_env,
        )

    def write_json(self, path: Path, payload: dict) -> Path:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def test_default_colleague_cli_uses_skills_colleague_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            work_path = tmp_root / "work.md"
            persona_path = tmp_root / "persona.md"
            meta_path = tmp_root / "meta.json"

            work_path.write_text("Work body\n", encoding="utf-8")
            persona_path.write_text("Persona body\n", encoding="utf-8")
            self.write_json(
                meta_path,
                {
                    "character": "colleague",
                    "display_name": "Eulalie",
                    "classification": {"language": "en"},
                },
            )

            create = self.run_cmd(
                PYTHON,
                str(PROJECT_ROOT / "tools" / "skill_writer.py"),
                "--action",
                "create",
                "--character",
                "colleague",
                "--slug",
                "eulalie",
                "--name",
                "Eulalie",
                "--meta",
                str(meta_path),
                "--work",
                str(work_path),
                "--persona",
                str(persona_path),
                cwd=tmp_root,
            )

            self.assertIn("Created skill:", create.stdout)
            self.assertTrue((tmp_root / "skills" / "colleague" / "eulalie" / "SKILL.md").exists())

    def test_character_lifecycle_via_cli(self) -> None:
        fixtures = {
            "colleague": {
                "name": "Eulalie",
                "slug": "eulalie",
                "base_dir": "skills/colleague",
            },
            "relationship": {
                "name": "Mireille",
                "slug": "mireille",
                "base_dir": "skills/relationship",
            },
            "celebrity": {
                "name": "Zadie Smith",
                "slug": "zadie_smith",
                "base_dir": "skills/celebrity",
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)

            for character, fixture in fixtures.items():
                base_dir = root / fixture["base_dir"]
                base_dir.mkdir(parents=True, exist_ok=True)
                meta_path = root / f"{fixture['slug']}_meta.json"
                work_path = root / f"{fixture['slug']}_work.md"
                persona_path = root / f"{fixture['slug']}_persona.md"
                work_patch_path = root / f"{fixture['slug']}_work_patch.md"
                correction_path = root / f"{fixture['slug']}_correction.json"

                self.write_json(
                    meta_path,
                    {
                        "character": character,
                        "display_name": fixture["name"],
                        "classification": {"language": "en"},
                        "profile": {"role": "Builder"},
                        "tags": {"personality": ["precise", "skeptical"]},
                        "knowledge_sources": ["manual-notes"],
                    },
                )
                work_path.write_text(
                    "\n".join(
                        [
                            "## mental models",
                            "- First-principles reasoning",
                            "- Skeptical framing",
                            "- Long-horizon tradeoffs",
                            "",
                            "## limitations",
                            "- Avoids operational detail",
                            "",
                            "Sources:",
                            "https://example.com/articles/long-form-profile",
                            "https://example.com/interviews/episode-42",
                        ]
                    )
                    + "\n",
                    encoding="utf-8",
                )
                persona_path.write_text(
                    "\n".join(
                        [
                            "## expression DNA",
                            "- Sentence rhythm is clipped.",
                            "- Uses metaphor when disagreeing.",
                            "",
                            "## honest boundaries",
                            "- States what they do not know.",
                            "",
                            "## contradictions",
                            "- Alternates between certainty and doubt.",
                        ]
                    )
                    + "\n",
                    encoding="utf-8",
                )
                work_patch_path.write_text("## new evidence\n- Adds a later example.\n", encoding="utf-8")
                self.write_json(
                    correction_path,
                    {
                        "scene": "disagreement",
                        "wrong": "flatten disagreement into politeness",
                        "correct": "surface the disagreement and justify it directly",
                    },
                )

                create = self.run_cmd(
                    PYTHON,
                    "tools/skill_writer.py",
                    "--action",
                    "create",
                    "--character",
                    character,
                    "--slug",
                    fixture["slug"],
                    "--name",
                    fixture["name"],
                    "--meta",
                    str(meta_path),
                    "--work",
                    str(work_path),
                    "--persona",
                    str(persona_path),
                    "--base-dir",
                    str(base_dir),
                )
                self.assertIn("Created skill:", create.stdout)

                skill_dir = base_dir / fixture["slug"]
                self.assertTrue((skill_dir / "SKILL.md").exists())
                self.assertTrue((skill_dir / "manifest.json").exists())

                list_result = self.run_cmd(
                    PYTHON,
                    "tools/skill_writer.py",
                    "--action",
                    "list",
                    "--character",
                    character,
                    "--base-dir",
                    str(base_dir),
                )
                self.assertIn(fixture["slug"], list_result.stdout)
                self.assertIn(f"Character: {character}", list_result.stdout)

                update = self.run_cmd(
                    PYTHON,
                    "tools/skill_writer.py",
                    "--action",
                    "update",
                    "--character",
                    character,
                    "--slug",
                    fixture["slug"],
                    "--work-patch",
                    str(work_patch_path),
                    "--correction-json",
                    str(correction_path),
                    "--base-dir",
                    str(base_dir),
                )
                self.assertIn("Updated skill to v2", update.stdout)

                versions = self.run_cmd(
                    PYTHON,
                    "tools/version_manager.py",
                    "--action",
                    "list",
                    "--character",
                    character,
                    "--slug",
                    fixture["slug"],
                    "--base-dir",
                    str(base_dir),
                )
                self.assertIn("v1", versions.stdout)

                rollback = self.run_cmd(
                    PYTHON,
                    "tools/version_manager.py",
                    "--action",
                    "rollback",
                    "--character",
                    character,
                    "--slug",
                    fixture["slug"],
                    "--version",
                    "v1",
                    "--base-dir",
                    str(base_dir),
                )
                self.assertIn("rolled back to v1", rollback.stdout)

                saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
                self.assertEqual(saved_meta["character"], character)
                self.assertTrue(saved_meta["version"].startswith("v1"))

                combined_skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn("## PART A: Work", combined_skill)
                self.assertIn("## PART B: Persona", combined_skill)

                if character == "celebrity":
                    subtitle_path = skill_dir / "knowledge" / "subtitles" / "sample.vtt"
                    subtitle_path.write_text(
                        "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n\n"
                        "00:00:01.000 --> 00:00:02.000\nworld.\n",
                        encoding="utf-8",
                    )
                    transcript_path = skill_dir / "knowledge" / "transcripts" / "sample.txt"
                    transcript = self.run_cmd(
                        PYTHON,
                        "tools/research/srt_to_transcript.py",
                        str(subtitle_path),
                        str(transcript_path),
                    )
                    self.assertIn(str(transcript_path), transcript.stdout)
                    self.assertIn("Hello world.", transcript_path.read_text(encoding="utf-8"))

                    raw_note = skill_dir / "knowledge" / "research" / "raw" / "01.md"
                    raw_note.write_text(
                        "# Notes\n"
                        "- Strong focus on first-person essays\n"
                        "- Repeats a skeptical framing\n"
                        "https://example.com/essays/first-person-observation\n"
                        "primary source\n",
                        encoding="utf-8",
                    )
                    merged = self.run_cmd(
                        PYTHON,
                        "tools/research/merge_research.py",
                        str(skill_dir),
                    )
                    self.assertIn("summary.md", merged.stdout)
                    summary_text = (skill_dir / "knowledge" / "research" / "merged" / "summary.md").read_text(
                        encoding="utf-8"
                    )
                    self.assertIn("Research Summary", summary_text)

                    quality = self.run_cmd(
                        PYTHON,
                        "tools/research/quality_check.py",
                        str(skill_dir / "SKILL.md"),
                    )
                    self.assertIn("OVERALL PASS", quality.stdout)

    def test_cli_can_install_generated_skill_into_claude_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            base_dir = root / "skills" / "celebrity"
            base_dir.mkdir(parents=True, exist_ok=True)

            meta_path = root / "zhou_qimo_meta.json"
            work_path = root / "zhou_qimo_work.md"
            persona_path = root / "zhou_qimo_persona.md"
            self.write_json(
                meta_path,
                {
                    "character": "celebrity",
                    "display_name": "周奇墨",
                    "classification": {"language": "zh-CN"},
                },
            )
            work_path.write_text("Work body\n", encoding="utf-8")
            persona_path.write_text("Persona body\n", encoding="utf-8")

            claude_skills_dir = root / ".claude" / "skills"
            claude_commands_dir = root / ".claude" / "commands"

            create = self.run_cmd(
                PYTHON,
                "tools/skill_writer.py",
                "--action",
                "create",
                "--character",
                "celebrity",
                "--slug",
                "zhou_qimo",
                "--name",
                "周奇墨",
                "--meta",
                str(meta_path),
                "--work",
                str(work_path),
                "--persona",
                str(persona_path),
                "--base-dir",
                str(base_dir),
                "--install-claude-skill",
                "--install-claude-command-shim",
                "--claude-skills-dir",
                str(claude_skills_dir),
                "--claude-commands-dir",
                str(claude_commands_dir),
            )

            self.assertIn("Trigger: /celebrity-zhou-qimo", create.stdout)
            self.assertTrue((claude_skills_dir / "celebrity-zhou-qimo" / "SKILL.md").exists())
            self.assertTrue((claude_commands_dir / "celebrity-zhou-qimo.md").exists())


if __name__ == "__main__":
    unittest.main()
