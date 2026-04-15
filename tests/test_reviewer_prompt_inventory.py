import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

EXPECTED_PROMPTS = [
    "prompts/review_pr_intake.md",
    "prompts/review_pr_analyzer.md",
    "prompts/review_pr_builder.md",
    "prompts/review_pr_examples_builder.md",
    "prompts/review_design_intake.md",
    "prompts/review_design_analyzer.md",
    "prompts/review_design_builder.md",
    "prompts/review_design_examples_builder.md",
]


class ReviewerPromptInventoryTests(unittest.TestCase):
    def test_all_reviewer_prompt_files_exist(self):
        for relative_path in EXPECTED_PROMPTS:
            with self.subTest(path=relative_path):
                self.assertTrue((REPO_ROOT / relative_path).exists(), relative_path)


if __name__ == "__main__":
    unittest.main()
