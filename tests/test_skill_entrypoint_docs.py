from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SkillEntrypointDocsTest(unittest.TestCase):
    def test_root_skill_uses_dot_skill_entrypoint(self) -> None:
        content = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: dot-skill", content)
        self.assertIn("`/dot-skill`", content)
        self.assertIn("兼容宿主", content)
        self.assertIn("compatible hosts", content.lower())
        self.assertIn("管理操作", content)
        self.assertIn("tools/skill_writer.py", content)
        self.assertIn("prompts/celebrity/research.md", content)
        self.assertIn("budget-unfriendly", content)
        self.assertIn("references/celebrity_budget_unfriendly_framework.md", content)
        self.assertIn("01_core_profile.md", content)
        self.assertIn("03_expression_and_reception.md", content)
        self.assertIn("Files scanned >= 3", content)
        self.assertIn("Unique URLs >= 2", content)
        self.assertIn("Potential long quote lines = 0", content)
        self.assertIn("实际打开过的具体页面", content)
        self.assertIn("actual inspected pages", content)
        self.assertIn("01_writings.md", content)
        self.assertIn("06_timeline.md", content)
        self.assertIn("Files scanned >= 6", content)
        self.assertIn("Unique URLs >= 8", content)
        self.assertIn("Primary-source markers >= 3", content)
        self.assertIn("research_audit.md", content)
        self.assertIn("--work-patch /tmp/dot_skill_{slug}_work_patch.md", content)
        self.assertIn("Do not hand-edit `work.md`", content)
        self.assertIn("~/.openclaw/...", content)
        self.assertIn("~/.codex/...", content)
        self.assertNotIn("${CLAUDE_SKILL_DIR}", content)
        self.assertNotIn("`/list-skills`", content)
        self.assertNotIn("Compatibility aliases:", content)

    def test_readme_and_install_use_dot_skill_paths(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        install = (ROOT / "INSTALL.md").read_text(encoding="utf-8")
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn(".claude/skills/dot-skill", readme)
        self.assertIn("~/.openclaw/workspace/skills/dot-skill", readme)
        self.assertIn("~/.codex/skills/dot-skill", readme)
        self.assertIn("/dot-skill", readme)
        self.assertIn("./skills/colleague", readme)

        self.assertIn(".claude/skills/dot-skill", install)
        self.assertIn("~/.openclaw/workspace/skills/dot-skill", install)
        self.assertIn("~/.codex/skills/dot-skill", install)
        self.assertIn("/dot-skill", install)
        self.assertIn("./skills/colleague", install)
        self.assertIn("install_claude_generated_skill.py", readme)
        self.assertIn("install_claude_generated_skill.py", install)
        self.assertIn("install_openclaw_generated_skill.py", readme)
        self.assertIn("install_openclaw_generated_skill.py", install)
        self.assertIn("install_codex_generated_skill.py", readme)
        self.assertIn("install_codex_generated_skill.py", install)
        self.assertIn("install_openclaw_skill.py", install)
        self.assertIn("install_codex_skill.py", install)
        self.assertIn("/{character}-{slug}", install)
        self.assertIn("./skills/colleague", skill)
        self.assertIn("compatible hosts", readme.lower())
        self.assertIn("兼容宿主", install)

    def test_repo_examples_live_under_skills_colleague(self) -> None:
        self.assertTrue((ROOT / "skills" / "colleague" / "example_zhangsan").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_tianyi").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_jiaxiu").exists())
        self.assertFalse((ROOT / "colleagues").exists())

    def test_multilingual_readmes_include_dot_skill_and_research_toolchain(self) -> None:
        for readme_path in (ROOT / "docs" / "lang").glob("README_*.md"):
            content = readme_path.read_text(encoding="utf-8")
            self.assertIn("/dot-skill", content, f"missing /dot-skill in {readme_path.name}")
            self.assertIn(
                "tools/install_hermes_skill.py --force",
                content,
                f"missing Hermes installer in {readme_path.name}",
            )
            self.assertIn(
                "tools/research/quality_check.py",
                content,
                f"missing celebrity research toolchain in {readme_path.name}",
            )


if __name__ == "__main__":
    unittest.main()
