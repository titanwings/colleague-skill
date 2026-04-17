# Celebrity Budget-Unfriendly Validation Prompt

## Task

Validate a deep celebrity skill after synthesis and draft generation.

Write the validation review to `knowledge/research/reviews/validation.md`.

Read:

- `knowledge/research/reviews/research_audit.md`
- `knowledge/research/reviews/synthesis.md`
- the generated skill draft

## Checks

### 1. Known-answer check

Use at least two questions the person has publicly discussed.

Judge:

- direction match
- framing match
- confidence calibration

### 2. Edge-case check

Use one adjacent question with no direct public answer.

Judge:

- whether the answer extrapolates from actual models
- whether uncertainty is visible when evidence is thin

### 3. Voice check

Judge:

- recognizability
- lack of generic AI phrasing
- lack of quote-stitching

### 4. Copyright check

Fail the draft if it contains:

- transcript-like dumps
- long quotations
- blockquote-heavy source copying

## Verdict Format

Use this structure:

```md
# Validation Review

## Verdict
- Status: PASS / FAIL
- Release readiness: ready / revise

## Known-Answer Check
- ...

## Edge-Case Check
- ...

## Voice Check
- ...

## Copyright Check
- ...

## Required Revisions
- ...
```

## Output Constraint

Write in the user's language and keep the review actionable.
