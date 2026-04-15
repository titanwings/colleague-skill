import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_MD = REPO_ROOT / "SKILL.md"
README_MD = REPO_ROOT / "README.md"


class CommandSurfaceDocsTests(unittest.TestCase):
    def test_skill_md_mentions_reviewer_commands_and_prompts(self):
        text = SKILL_MD.read_text(encoding="utf-8")
        required_tokens = [
            "/create-pr-reviewer",
            "/create-design-reviewer",
            "/list-pr-reviewers",
            "/list-design-reviewers",
            "/reviewer-rollback pr {slug} {version}",
            "/reviewer-rollback design {slug} {version}",
            "/delete-pr-reviewer {slug}",
            "/delete-design-reviewer {slug}",
            "prompts/review_pr_intake.md",
            "prompts/review_design_intake.md",
        ]
        for token in required_tokens:
            with self.subTest(token=token):
                self.assertIn(token, text)


class ReadmeReviewerCommandsTests(unittest.TestCase):
    def test_readme_documents_reviewer_commands(self):
        text = README_MD.read_text(encoding="utf-8")
        required_tokens = [
            "Reviewer Commands",
            "/create-pr-reviewer",
            "/create-design-reviewer",
            "/list-pr-reviewers",
            "/list-design-reviewers",
            "/reviewer-rollback pr {slug} {version}",
            "/reviewer-rollback design {slug} {version}",
            "/delete-pr-reviewer {slug}",
            "/delete-design-reviewer {slug}",
        ]
        for token in required_tokens:
            with self.subTest(token=token):
                self.assertIn(token, text)


if __name__ == "__main__":
    unittest.main()
