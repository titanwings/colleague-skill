# Reviewer Clone Generators Design

- Date: 2026-04-13
- Status: Approved design, pending implementation
- Repo: `colleague-skill`

## Summary

Add two new review-only generator flows to the existing skill system without changing the behavior of `/create-colleague`:

- `/create-pr-reviewer`
- `/create-design-reviewer`

These generators create specialized reviewer clones that emulate how a specific colleague reviews code or design material, but do not emulate the colleague broadly as a full persona or worker.

The implementation must keep the existing colleague skill intact, route the new commands through the main `SKILL.md`, reuse existing ingestion tooling where possible, and document the new command surface in `README.md` with short descriptions.

## Goals

- Add a PR/code-review generator for cloning a colleague's review behavior on diffs and implementation details.
- Add a design/architecture-review generator for cloning a colleague's review behavior on RFCs, APIs, design docs, and architecture decisions.
- Keep reviewer outputs review-only and separate from the general colleague skill.
- Reuse the current ingestion, parsing, versioning, and file-writing patterns when practical.
- Provide explicit command surface for creation, listing, rollback, and deletion.
- Document the new reviewer commands in `README.md`.

## Non-Goals

- Do not overwrite or merge into the existing general colleague persona.
- Do not make reviewer clones execute work as the colleague.
- Do not make reviewer clones depend on an existing colleague skill as context.
- Do not restructure the repository into multiple top-level products.
- Do not solve Git remote permissions or publishing strategy in this design beyond identifying it as a release step.

## User-Facing Model

The repository will support three distinct product types:

1. `colleague skill`
   - Full colleague emulation.
   - Existing `/create-colleague` behavior remains unchanged.
2. `pr reviewer`
   - Review-only emulation of how a colleague reviews code diffs and implementation.
3. `design reviewer`
   - Review-only emulation of how a colleague reviews design docs, APIs, and architecture.

The critical boundary is:

- `colleague skill` = emulate the person broadly
- `reviewer skill` = emulate only their reviewing behavior

## Command Surface

### New creation commands

- `/create-pr-reviewer`
- `/create-design-reviewer`

### New list commands

- `/list-pr-reviewers`
- `/list-design-reviewers`

### New management commands

- `/reviewer-rollback pr {slug} {version}`
- `/reviewer-rollback design {slug} {version}`
- `/delete-pr-reviewer {slug}`
- `/delete-design-reviewer {slug}`

### Existing command behavior

- `/create-colleague` stays unchanged
- `/list-colleagues` stays unchanged
- `/colleague-rollback {slug} {version}` stays unchanged
- `/delete-colleague {slug}` stays unchanged

## Routing in `SKILL.md`

The main `SKILL.md` remains the single entry point, but it gains three clearly separated branches:

- `/create-colleague`
- `/create-pr-reviewer`
- `/create-design-reviewer`

It also gains management branches for:

- `/list-pr-reviewers`
- `/list-design-reviewers`
- `/reviewer-rollback ...`
- `/delete-pr-reviewer ...`
- `/delete-design-reviewer ...`

The new branches must be written so that:

- the existing colleague flow is not behaviorally changed
- reviewer-only logic is not mixed into the colleague persona flow
- each review mode references its own prompt files and output directories

## Output Directories

Reviewer outputs must not be written into `./colleagues/{slug}/`.

Use:

- `./reviewers/pr/{slug}/`
- `./reviewers/design/{slug}/`

This ensures:

- no overwrite risk against the general colleague skill
- identical slug values can exist independently for PR and design reviewers
- versioning and deletion can be scoped by reviewer type

## Generated Artifact Structure

### PR reviewer

Directory:

- `reviewers/pr/{slug}/`

Files:

- `SKILL.md`
- `review.md`
- `examples.md`
- `meta.json`
- `versions/`
- `knowledge/`

### Design reviewer

Directory:

- `reviewers/design/{slug}/`

Files:

- `SKILL.md`
- `review.md`
- `examples.md`
- `meta.json`
- `versions/`
- `knowledge/`

## Artifact Semantics

### `review.md`

For PR reviewers, `review.md` captures:

- order of analysis across a diff
- what counts as blocker / major / minor / nit
- recurring heuristics
- code-quality and regression concerns
- stack-specific review expectations when evidence exists
- tone and framing of feedback
- approve vs request-changes vs ask-for-context rules

For design reviewers, `review.md` captures:

- how the reviewer evaluates problem framing
- which tradeoffs they prioritize
- red flags in requirements, contracts, and architecture
- repeated questions they ask
- expectations around rollout, observability, ownership, reversibility, and risk
- approve vs request-changes vs ask-for-context rules

### `examples.md`

For both reviewer types, `examples.md` contains:

- representative comments in the reviewer’s style
- “would block” examples
- “would allow” examples
- example questions they ask before approving
- examples of high-signal and low-signal feedback

The goal is not roleplay for its own sake. The examples exist to anchor severity, framing, and consistency.

### `SKILL.md`

Each generated reviewer gets its own invocable skill wrapper.

Suggested naming:

- `pr-reviewer-{slug}`
- `design-reviewer-{slug}`

Its instructions should enforce review-only behavior, with rules such as:

- do not switch into implementation mode
- review the submitted material using the reviewer’s heuristics
- keep the reviewer’s feedback style
- stay within the review domain for that reviewer type

### `meta.json`

Reviewer metadata should include:

- `name`
- `slug`
- `reviewer_type` (`pr` or `design`)
- `created_at`
- `updated_at`
- `version`
- `profile`
- `knowledge_sources`
- `corrections_count`

If useful, include reviewer-specific metadata such as:

- `primary_stacks`
- `source_kinds`
- `review_focus_tags`

## Prompt Additions

Add the following prompt files:

- `prompts/review_pr_intake.md`
- `prompts/review_pr_analyzer.md`
- `prompts/review_pr_builder.md`
- `prompts/review_pr_examples_builder.md`
- `prompts/review_design_intake.md`
- `prompts/review_design_analyzer.md`
- `prompts/review_design_builder.md`
- `prompts/review_design_examples_builder.md`

These prompts must be separate from the existing colleague persona prompts.

## Generation Flows

### `/create-pr-reviewer`

1. Short intake
   - identify the target colleague
   - gather minimal background on role/stack if available
2. Ingest reviewer-relevant material
   - PR comments
   - review threads
   - code review summaries
   - technical discussions
   - incident/postmortem commentary when it exposes review heuristics
3. Analyze
   - severity patterns
   - categories of issues they raise
   - what they block immediately
   - what they treat as follow-up or nit
   - tone and phrasing patterns
4. Generate
   - `review.md`
   - `examples.md`
   - reviewer `SKILL.md`
   - `meta.json`
5. Support evolution
   - append new material
   - apply conversation-based corrections

### `/create-design-reviewer`

1. Short intake
2. Ingest design-review material
   - RFCs
   - design docs
   - architecture comments
   - API review threads
   - planning and tradeoff discussions
3. Analyze
   - evaluation criteria
   - preferred tradeoff patterns
   - repeated questions
   - red flags
   - rollout / observability / ownership expectations
4. Generate
   - `review.md`
   - `examples.md`
   - reviewer `SKILL.md`
   - `meta.json`
5. Support evolution
   - append new material
   - apply conversation-based corrections

## Shared vs Specialized Components

### Reuse as-is where possible

- Existing collectors and parsers
- Version archiving patterns
- Basic file writing patterns
- Existing JSON metadata conventions

### Add reviewer-specific logic

- Reviewer-specific intake prompts
- Reviewer-specific analyzers
- Reviewer-specific builders
- Reviewer-specific command routing
- Reviewer-specific output directories

## Tooling Changes

### `tools/skill_writer.py`

Either extend the existing writer or add a small dedicated reviewer writer.

Recommendation:

- keep `skill_writer.py` as the shared writer utility
- add reviewer-aware actions or helper functions
- avoid duplicating path creation and metadata serialization logic

Reviewer output support needed:

- create PR reviewer
- create design reviewer
- list PR reviewers
- list design reviewers
- write reviewer-specific wrappers and metadata

### `tools/version_manager.py`

Extend the CLI so it can operate cleanly against reviewer directories by base dir and type, without changing existing colleague flows.

Recommendation:

- continue using base-dir driven operations
- keep colleague and reviewer rollback logic structurally identical
- let command routing in `SKILL.md` decide whether the base dir is colleague, PR reviewer, or design reviewer

## README Changes

After implementation, update `README.md` to document the new command surface with short descriptions.

Add a section similar to:

- Reviewer Commands
  - `/create-pr-reviewer` — create a review-only clone for PR/code review
  - `/create-design-reviewer` — create a review-only clone for RFC/design/architecture review
  - `/list-pr-reviewers` — list generated PR reviewers
  - `/list-design-reviewers` — list generated design reviewers
  - `/reviewer-rollback pr {slug} {version}` — roll back a PR reviewer
  - `/reviewer-rollback design {slug} {version}` — roll back a design reviewer
  - `/delete-pr-reviewer {slug}` — delete a PR reviewer
  - `/delete-design-reviewer {slug}` — delete a design reviewer

The README should also clarify the distinction between:

- full colleague skills
- PR reviewers
- design reviewers

## Error Handling

### Creation-time failures

- Missing source material:
  - still allow creation from limited input, but mark outputs as under-evidenced
- Unsupported or weak material:
  - summarize what was missing and what kind of material would improve the reviewer clone
- Slug conflicts:
  - only conflicts within the same reviewer type should matter

### Evolution-time failures

- If new evidence contradicts prior reviewer behavior:
  - surface conflict
  - ask whether to replace, keep both, or scope by scenario

## Testing Strategy

Implementation verification should cover:

- command routing in main `SKILL.md`
- creation of PR reviewer output into `reviewers/pr/{slug}/`
- creation of design reviewer output into `reviewers/design/{slug}/`
- list commands against each reviewer type
- rollback against each reviewer type
- delete commands against each reviewer type
- no regression to the existing `/create-colleague` flow
- README command documentation added and accurate

Tests or verification should also confirm that generated reviewer wrappers remain review-only and do not drift into general worker behavior.

## Migration / Compatibility

- Existing colleague skills remain untouched.
- Existing commands remain untouched.
- Existing collectors remain reusable.
- Reviewer data is additive only.

## Release Notes

After implementation and verification:

- update `README.md`
- prepare the repository for push
- push target must be confirmed at release time, since the current `origin` may not be writable by the current user

## Self-Review Checklist

- No placeholder sections remain.
- The two reviewer types are cleanly separated.
- The colleague skill remains unchanged.
- Output directories are explicit and non-overlapping.
- README command-surface requirement is captured.
- Publishing is noted as a release step, not silently assumed.
