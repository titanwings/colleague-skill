# Reviewer Clone Generators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/create-pr-reviewer` and `/create-design-reviewer` as review-only generator flows, keep `/create-colleague` unchanged, and document the new command surface in `README.md`.

**Architecture:** Extend the existing shared writer and versioning utilities to support reviewer artifacts in separate directories, add dedicated reviewer prompt files, and route the new commands through the main `SKILL.md`. Verify behavior with a small `unittest` suite that covers writer behavior, version rollback, prompt inventory, and command-surface docs.

**Tech Stack:** Python 3.9+, stdlib `unittest`, existing markdown prompt system, existing `skill_writer.py` and `version_manager.py`

---

## Planned File Map

### Create

- `tests/test_skill_writer_reviewers.py`
- `tests/test_version_manager_reviewers.py`
- `tests/test_reviewer_prompt_inventory.py`
- `tests/test_command_surface_docs.py`
- `prompts/review_pr_intake.md`
- `prompts/review_pr_analyzer.md`
- `prompts/review_pr_builder.md`
- `prompts/review_pr_examples_builder.md`
- `prompts/review_design_intake.md`
- `prompts/review_design_analyzer.md`
- `prompts/review_design_builder.md`
- `prompts/review_design_examples_builder.md`

### Modify

- `tools/skill_writer.py`
- `tools/version_manager.py`
- `SKILL.md`
- `README.md`

### Verify

- `python3 -m unittest discover -s tests -p 'test_*.py' -v`
- `python3 -m py_compile tools/skill_writer.py tools/version_manager.py`
- `git diff --check`

---

### Task 1: Add Failing Tests For Reviewer Writer Support

**Files:**
- Create: `tests/test_skill_writer_reviewers.py`
- Test: `tools/skill_writer.py`

- [ ] **Step 1: Write the failing test file for reviewer creation and listing**

```python
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
python3 -m unittest tests.test_skill_writer_reviewers -v
```

Expected:

```text
FAIL: test_create_pr_reviewer_writes_expected_files
error output mentions invalid choice 'create-reviewer' or missing reviewer arguments
```

- [ ] **Step 3: Implement reviewer creation and listing support in `tools/skill_writer.py`**

Add reviewer-specific helpers near the existing writer helpers:

```python
REVIEWER_CONFIG = {
    "pr": {
        "title": "PR Reviewer",
        "skill_name_prefix": "pr-reviewer",
        "description_suffix": "PR/code review clone",
    },
    "design": {
        "title": "Design Reviewer",
        "skill_name_prefix": "design-reviewer",
        "description_suffix": "design/architecture review clone",
    },
}


def render_reviewer_skill_md(
    reviewer_type: str,
    slug: str,
    name: str,
    identity: str,
    review_content: str,
    examples_content: str,
) -> str:
    config = REVIEWER_CONFIG[reviewer_type]
    return f\"\"\"\
---
name: {config['skill_name_prefix']}_{slug}
description: {name}, {config['description_suffix']}
user-invocable: true
---

# {name} - {config['title']}

{identity}

---

## Review Rules

{review_content}

---

## Review Examples

{examples_content}

---

## Execution Rules

1. Stay in review mode only.
2. Review submitted material using the heuristics above.
3. Preserve the reviewer's severity and phrasing style.
4. Do not switch into implementation mode unless the user explicitly asks for implementation outside this skill.
\"\"\"


def create_reviewer_skill(
    base_dir: Path,
    reviewer_type: str,
    slug: str,
    meta: dict,
    review_content: str,
    examples_content: str,
) -> Path:
    skill_dir = base_dir / slug
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "versions").mkdir(exist_ok=True)
    (skill_dir / "knowledge").mkdir(exist_ok=True)
    (skill_dir / "review.md").write_text(review_content, encoding="utf-8")
    (skill_dir / "examples.md").write_text(examples_content, encoding="utf-8")

    language = get_language(meta)
    name = meta.get("name", slug)
    identity = build_identity_string(meta, language)
    skill_md = render_reviewer_skill_md(
        reviewer_type=reviewer_type,
        slug=slug,
        name=name,
        identity=identity,
        review_content=review_content,
        examples_content=examples_content,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    now = datetime.now(timezone.utc).isoformat()
    meta["slug"] = slug
    meta["reviewer_type"] = reviewer_type
    meta.setdefault("created_at", now)
    meta["updated_at"] = now
    meta["version"] = "v1"
    meta.setdefault("corrections_count", 0)
    meta.setdefault("language", language)
    (skill_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return skill_dir
```

Extend CLI parsing so these reviewer arguments are accepted:

```python
parser.add_argument(
    "--action",
    required=True,
    choices=["create", "update", "list", "create-reviewer", "update-reviewer"],
)
parser.add_argument("--reviewer-type", choices=["pr", "design"])
parser.add_argument("--review", help="path to the review.md content file")
parser.add_argument("--examples", help="path to the examples.md content file")
parser.add_argument("--review-patch", help="path to the incremental review.md patch file")
parser.add_argument("--examples-patch", help="path to the incremental examples.md patch file")
```

Handle `create-reviewer` in `main()`:

```python
elif args.action == "create-reviewer":
    if not args.reviewer_type:
        print("error: create-reviewer requires --reviewer-type", file=sys.stderr)
        sys.exit(1)
    if not args.slug and not args.name:
        print("error: create-reviewer requires --slug or --name", file=sys.stderr)
        sys.exit(1)

    meta = json.loads(Path(args.meta).read_text(encoding="utf-8")) if args.meta else {}
    if args.name:
        meta["name"] = args.name
    slug = args.slug or slugify(meta.get("name", "reviewer"))
    review_content = Path(args.review).read_text(encoding="utf-8") if args.review else ""
    examples_content = Path(args.examples).read_text(encoding="utf-8") if args.examples else ""

    skill_dir = create_reviewer_skill(
        base_dir=base_dir,
        reviewer_type=args.reviewer_type,
        slug=slug,
        meta=meta,
        review_content=review_content,
        examples_content=examples_content,
    )
    print(f"Created {args.reviewer_type} reviewer: {skill_dir}")
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python3 -m unittest tests.test_skill_writer_reviewers -v
```

Expected:

```text
OK
```

- [ ] **Step 5: Commit**

```bash
git add tests/test_skill_writer_reviewers.py tools/skill_writer.py
git commit -m "feat: add reviewer writer support"
```

---

### Task 2: Add Failing Tests For Reviewer Version Backup And Rollback

**Files:**
- Create: `tests/test_version_manager_reviewers.py`
- Modify: `tools/version_manager.py`
- Test: `tools/version_manager.py`

- [ ] **Step 1: Write the failing reviewer version-manager tests**

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_version_manager_reviewers -v
```

Expected:

```text
FAIL: review.md or examples.md were not archived/restored
```

- [ ] **Step 3: Generalize `tools/version_manager.py` to detect reviewer files**

Add a helper above `rollback()`:

```python
def managed_content_files(skill_dir: Path) -> tuple[str, ...]:
    reviewer_files = ("SKILL.md", "review.md", "examples.md")
    colleague_files = ("SKILL.md", "work.md", "persona.md")

    if any((skill_dir / name).exists() for name in ("review.md", "examples.md")):
        return reviewer_files
    return colleague_files
```

Use it in `rollback()` and `backup_current_version()`:

```python
for fname in managed_content_files(skill_dir):
    src = skill_dir / fname
    if src.exists():
        shutil.copy2(src, backup_dir / fname)
```

and:

```python
for fname in managed_content_files(skill_dir):
    src = version_dir / fname
    if src.exists():
        shutil.copy2(src, skill_dir / fname)
        restored_files.append(fname)
```

Update the module docstring and parser help to use generic wording like `generated skills` instead of `colleague skills`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
python3 -m unittest tests.test_version_manager_reviewers -v
```

Expected:

```text
OK
```

- [ ] **Step 5: Commit**

```bash
git add tests/test_version_manager_reviewers.py tools/version_manager.py
git commit -m "feat: support reviewer version rollback"
```

---

### Task 3: Add Reviewer Prompt Files With Inventory Tests

**Files:**
- Create: `tests/test_reviewer_prompt_inventory.py`
- Create: `prompts/review_pr_intake.md`
- Create: `prompts/review_pr_analyzer.md`
- Create: `prompts/review_pr_builder.md`
- Create: `prompts/review_pr_examples_builder.md`
- Create: `prompts/review_design_intake.md`
- Create: `prompts/review_design_analyzer.md`
- Create: `prompts/review_design_builder.md`
- Create: `prompts/review_design_examples_builder.md`

- [ ] **Step 1: Write the failing prompt inventory test**

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_reviewer_prompt_inventory -v
```

Expected:

```text
FAIL: one or more prompt files do not exist
```

- [ ] **Step 3: Create the PR reviewer prompt files**

`prompts/review_pr_intake.md`

```md
# PR Reviewer Intake

## Goal

Collect only the information needed to build a PR/code-review clone.

## Questions

1. Reviewer alias / slug
2. Reviewer context in one sentence: company, level, role, stack
3. What materials are available: PR comments, review threads, technical chats, incident discussions

## Summary

Show the collected summary and confirm before analysis.
```

`prompts/review_pr_analyzer.md`

```md
# PR Reviewer Analyzer

## Goal

Extract how the reviewer judges diffs.

## Extract

- Severity model: blocker / major / minor / nit
- Recurring issue categories
- Approval thresholds
- Questions asked before approval
- Stack-specific patterns when supported by evidence
- Tone and framing of comments

## Output

Write concrete review rules only. Mark under-evidenced areas explicitly.
```

`prompts/review_pr_builder.md`

```md
# PR Reviewer Builder

## Goal

Generate `review.md` for a PR reviewer clone.

## Required Sections

- Scope
- Review order
- Severity rules
- Common blockers
- Common non-blockers
- Approval / request-changes / ask-for-context behavior
- Review-only execution rules
```

`prompts/review_pr_examples_builder.md`

```md
# PR Reviewer Examples Builder

## Goal

Generate `examples.md` for a PR reviewer clone.

## Required Examples

- blocker comment
- major issue comment
- nit comment
- asks-for-context comment
- approval comment
```

- [ ] **Step 4: Create the design reviewer prompt files**

`prompts/review_design_intake.md`

```md
# Design Reviewer Intake

## Goal

Collect only the information needed to build a design-review clone.

## Questions

1. Reviewer alias / slug
2. Reviewer context in one sentence: company, level, role, architecture scope
3. What materials are available: RFC comments, design docs, API reviews, planning threads

## Summary

Show the collected summary and confirm before analysis.
```

`prompts/review_design_analyzer.md`

```md
# Design Reviewer Analyzer

## Goal

Extract how the reviewer evaluates design docs and architecture.

## Extract

- Questions they always ask
- Tradeoffs they privilege
- Risks they look for first
- Contract / API concerns
- Rollout, ownership, observability, reversibility expectations
- Tone and framing of comments

## Output

Write concrete design-review rules only. Mark under-evidenced areas explicitly.
```

`prompts/review_design_builder.md`

```md
# Design Reviewer Builder

## Goal

Generate `review.md` for a design reviewer clone.

## Required Sections

- Scope
- Review order
- Core evaluation criteria
- Red flags
- Questions before approval
- Approval / request-changes / ask-for-context behavior
- Review-only execution rules
```

`prompts/review_design_examples_builder.md`

```md
# Design Reviewer Examples Builder

## Goal

Generate `examples.md` for a design reviewer clone.

## Required Examples

- asks-for-missing-context comment
- contract-risk comment
- rollout-risk comment
- ownership/observability comment
- approval comment
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
python3 -m unittest tests.test_reviewer_prompt_inventory -v
```

Expected:

```text
OK
```

- [ ] **Step 6: Commit**

```bash
git add tests/test_reviewer_prompt_inventory.py prompts/review_*.md
git commit -m "feat: add reviewer prompt set"
```

---

### Task 4: Route Reviewer Commands Through `SKILL.md`

**Files:**
- Create: `tests/test_command_surface_docs.py`
- Modify: `SKILL.md`

- [ ] **Step 1: Write the failing command-surface test for `SKILL.md`**

```python
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_MD = REPO_ROOT / "SKILL.md"


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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_command_surface_docs.CommandSurfaceDocsTests.test_skill_md_mentions_reviewer_commands_and_prompts -v
```

Expected:

```text
FAIL: missing /create-pr-reviewer and reviewer prompt references
```

- [ ] **Step 3: Update the English command routing in `SKILL.md`**

Add trigger conditions near the English command list:

```md
Activate PR reviewer generation when the user says:
- `/create-pr-reviewer`
- "Help me create a PR reviewer"
- "Clone this colleague's code review style"

Activate design reviewer generation when the user says:
- `/create-design-reviewer`
- "Help me create a design reviewer"
- "Clone this colleague's architecture review style"

List PR reviewers when the user says `/list-pr-reviewers`.
List design reviewers when the user says `/list-design-reviewers`.
```

Add reviewer-only generation sections that reference:

```md
`${CLAUDE_SKILL_DIR}/prompts/review_pr_intake.md`
`${CLAUDE_SKILL_DIR}/prompts/review_pr_analyzer.md`
`${CLAUDE_SKILL_DIR}/prompts/review_pr_builder.md`
`${CLAUDE_SKILL_DIR}/prompts/review_pr_examples_builder.md`
`${CLAUDE_SKILL_DIR}/prompts/review_design_intake.md`
`${CLAUDE_SKILL_DIR}/prompts/review_design_analyzer.md`
`${CLAUDE_SKILL_DIR}/prompts/review_design_builder.md`
`${CLAUDE_SKILL_DIR}/prompts/review_design_examples_builder.md`
```

Route writer commands to the separate directories:

```bash
python3 ${CLAUDE_SKILL_DIR}/tools/skill_writer.py \
  --action create-reviewer \
  --reviewer-type pr \
  --slug {slug} \
  --meta /tmp/{slug}_meta.json \
  --review /tmp/{slug}_review.md \
  --examples /tmp/{slug}_examples.md \
  --base-dir ./reviewers/pr
```

and:

```bash
python3 ${CLAUDE_SKILL_DIR}/tools/skill_writer.py \
  --action create-reviewer \
  --reviewer-type design \
  --slug {slug} \
  --meta /tmp/{slug}_meta.json \
  --review /tmp/{slug}_review.md \
  --examples /tmp/{slug}_examples.md \
  --base-dir ./reviewers/design
```

Add management command snippets:

```bash
python3 ${CLAUDE_SKILL_DIR}/tools/version_manager.py --action rollback --slug {slug} --version {version} --base-dir ./reviewers/pr
python3 ${CLAUDE_SKILL_DIR}/tools/version_manager.py --action rollback --slug {slug} --version {version} --base-dir ./reviewers/design
rm -rf reviewers/pr/{slug}
rm -rf reviewers/design/{slug}
```

- [ ] **Step 4: Update the Chinese command routing section in `SKILL.md` with the same command surface**

Add the same reviewer commands to the Chinese branch so both language paths stay structurally aligned.

- [ ] **Step 5: Run the `SKILL.md` command-surface test to verify it passes**

Run:

```bash
python3 -m unittest tests.test_command_surface_docs.CommandSurfaceDocsTests.test_skill_md_mentions_reviewer_commands_and_prompts -v
```

Expected:

```text
OK
```

- [ ] **Step 6: Commit**

```bash
git add tests/test_command_surface_docs.py SKILL.md
git commit -m "feat: route reviewer generators through main skill"
```

---

### Task 5: Document Reviewer Commands In `README.md`

**Files:**
- Modify: `README.md`
- Test: `tests/test_command_surface_docs.py`

- [ ] **Step 1: Extend the docs test to check `README.md`**

Add to `tests/test_command_surface_docs.py`:

```python
README_MD = REPO_ROOT / "README.md"


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
```

- [ ] **Step 2: Run the README test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_command_surface_docs.ReadmeReviewerCommandsTests.test_readme_documents_reviewer_commands -v
```

Expected:

```text
FAIL: Reviewer Commands section not found
```

- [ ] **Step 3: Add the reviewer command surface to `README.md`**

Insert a new subsection under `### Commands`:

```md
| Command | Description |
|---------|-------------|
| `/list-colleagues` | List all colleague Skills |
| `/{slug}` | Invoke full Skill (Persona + Work) |
| `/{slug}-work` | Work capabilities only |
| `/{slug}-persona` | Persona only |
| `/colleague-rollback {slug} {version}` | Rollback to a previous version |
| `/delete-colleague {slug}` | Delete |

### Reviewer Commands

| Command | Description |
|---------|-------------|
| `/create-pr-reviewer` | Create a review-only clone for PR/code review |
| `/create-design-reviewer` | Create a review-only clone for RFC/design/architecture review |
| `/list-pr-reviewers` | List generated PR reviewers |
| `/list-design-reviewers` | List generated design reviewers |
| `/reviewer-rollback pr {slug} {version}` | Roll back a PR reviewer |
| `/reviewer-rollback design {slug} {version}` | Roll back a design reviewer |
| `/delete-pr-reviewer {slug}` | Delete a PR reviewer |
| `/delete-design-reviewer {slug}` | Delete a design reviewer |
```

Also add one short explanatory paragraph immediately below:

```md
Reviewer clones are review-only. They emulate how a colleague evaluates code or design material, but they do not replace the full colleague Skill or act as a general worker/persona clone.
```

- [ ] **Step 4: Run the docs tests to verify they pass**

Run:

```bash
python3 -m unittest tests.test_command_surface_docs -v
```

Expected:

```text
OK
```

- [ ] **Step 5: Commit**

```bash
git add README.md tests/test_command_surface_docs.py
git commit -m "docs: add reviewer command surface"
```

---

### Task 6: Run Full Verification And Smoke Tests

**Files:**
- Verify only

- [ ] **Step 1: Run the full unit test suite**

Run:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected:

```text
OK
```

- [ ] **Step 2: Compile the modified Python tools**

Run:

```bash
python3 -m py_compile tools/skill_writer.py tools/version_manager.py
```

Expected:

```text
no output
```

- [ ] **Step 3: Run a PR reviewer smoke test in a temp directory**

Run:

```bash
tmpdir="$(mktemp -d)"
cat > "$tmpdir/meta.json" <<'EOF'
{"name":"alex","language":"en","profile":{"company":"Acme","role":"backend engineer"}}
EOF
cat > "$tmpdir/review.md" <<'EOF'
# alex - PR Review Rules

## Severity

- Block on correctness regressions.
EOF
cat > "$tmpdir/examples.md" <<'EOF'
# alex - PR Review Examples

- blocker: missing rollback path
EOF
python3 tools/skill_writer.py \
  --action create-reviewer \
  --reviewer-type pr \
  --slug alex \
  --meta "$tmpdir/meta.json" \
  --review "$tmpdir/review.md" \
  --examples "$tmpdir/examples.md" \
  --base-dir "$tmpdir/reviewers/pr"
test -f "$tmpdir/reviewers/pr/alex/SKILL.md"
```

Expected:

```text
Created pr reviewer: ...
```

- [ ] **Step 4: Run a design reviewer smoke test in a temp directory**

Run:

```bash
tmpdir="$(mktemp -d)"
cat > "$tmpdir/meta.json" <<'EOF'
{"name":"morgan","language":"en","profile":{"company":"Acme","role":"staff engineer"}}
EOF
cat > "$tmpdir/review.md" <<'EOF'
# morgan - Design Review Rules

## Core Criteria

- Ask for rollout and observability before approval.
EOF
cat > "$tmpdir/examples.md" <<'EOF'
# morgan - Design Review Examples

- ask-for-context: what is the rollback path?
EOF
python3 tools/skill_writer.py \
  --action create-reviewer \
  --reviewer-type design \
  --slug morgan \
  --meta "$tmpdir/meta.json" \
  --review "$tmpdir/review.md" \
  --examples "$tmpdir/examples.md" \
  --base-dir "$tmpdir/reviewers/design"
test -f "$tmpdir/reviewers/design/morgan/SKILL.md"
```

Expected:

```text
Created design reviewer: ...
```

- [ ] **Step 5: Run diff hygiene checks**

Run:

```bash
git diff --check
```

Expected:

```text
no output
```

- [ ] **Step 6: Commit the final integration**

```bash
git add tests/ prompts/ SKILL.md README.md tools/skill_writer.py tools/version_manager.py
git commit -m "feat: add reviewer clone generators"
```

---

## Self-Review

- Spec coverage: the plan covers separate PR/design reviewer generators, separate directories, prompt files, shared writer updates, version rollback, main-skill routing, and README command documentation.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain.
- Type consistency: the plan uses one reviewer writer interface (`create-reviewer`, `update-reviewer`, `--reviewer-type`) and one directory scheme (`reviewers/pr`, `reviewers/design`) throughout.
