# Celebrity Budget-Unfriendly Research Audit Prompt

## Task

Audit the six-track celebrity research set before synthesis.

Read:

- all files under `knowledge/research/raw/`
- `knowledge/research/merged/summary.md`
- `references/celebrity_budget_unfriendly_framework.md`

Write the audit to `knowledge/research/reviews/research_audit.md`.

## Audit Responsibilities

The audit is a hard gate. Do not treat it as a decorative summary.
You must judge whether the research set is ready for synthesis.

A FAIL means the research needs more work. A PASS means synthesis can proceed.

## Required Sections

Use this structure:

```md
# Research Audit

## Verdict
- Status: PASS / FAIL
- Reason: ...

## Coverage Review
- Track coverage: {N}/6 dimensions covered
- Missing or weak tracks: ...
- Cross-track redundancy: {are tracks meaningfully distinct or cloning observations?}

## Source Quality Assessment

### Source Mix
- Primary-source count: ...
- Secondary-source count: ...
- Primary-source ratio: ...% (target: >50%)
- Grounding quality: {are URLs actual inspected pages?}

### Source Hierarchy Compliance
- Sources from weight 1-3 (highest quality): ...
- Sources from weight 4-5 (medium quality): ...
- Sources from weight 6-7 (lowest quality): ...
- Blacklisted sources used: {list any — these are automatic failures}

### Taste Principle Compliance
- Long-form vs. snippet ratio: ...
- Firsthand vs. secondhand ratio: ...
- Controversial/distinctive positions captured: {yes/no, examples}
- Thinking evolution documented: {yes/no}

## Contradictions Inventory
- Total contradictions found: ...
- Classification:
  - Temporal (view evolution): ...
  - Contextual (domain differences): ...
  - Inherent (value tensions): ...
- Quality: {are these substantive tensions or superficial?}

## Mental Model Candidates
- Candidate count: ... (target: ≥3)
- For each candidate:
  - Name: ...
  - Cross-context evidence: {present in which dimensions?}
  - Preliminary gate assessment: ...

## Known-Answer Bank
- Question 1: ...
  Evidence anchors: ...
- Question 2: ...
  Evidence anchors: ...
- Strength: {are these answerable from the research evidence?}

## Edge-Case Candidate
- Question: ...
- Why this is adjacent but under-evidenced: ...
- Expected reasoning approach: ...

## Cold Figure Assessment
- Total grounded sources: ...
- Is this a cold figure (<10 sources)? {yes/no}
- If yes: recommended degradation strategy: ...

## Backfill Tasks
(Specific, actionable items to improve the research before synthesis)
- ...
- ...
```

## Audit Rules — FAIL Conditions

Fail the audit if any of these conditions hold:

- The six-track set is incomplete (any dimension missing)
- Tracks are not meaningfully distinct (cloned observations across files)
- Grounded URLs are thin or low-quality (< 8 actual inspected pages)
- Primary material is too weak relative to commentary (< 50% primary)
- Any blacklisted sources were used as evidence
- Contradictions are missing or flattened away (< 3 substantive tensions)
- There is not enough evidence to support at least 3 mental models
- The known-answer bank is too weak to support later validation (< 2 questions)
- Long-form sources are underrepresented relative to snippets
- Source hierarchy is bottom-heavy (mostly weight 5-7 sources)

## Audit Rules — PASS Conditions

Pass the audit when:

- All 6 dimensions are covered with meaningfully distinct content
- At least 8 grounded URLs from actual inspected pages
- Primary-source ratio > 50%
- No blacklisted sources
- At least 3 substantive contradictions documented
- At least 3 candidate mental models with cross-dimensional evidence
- At least 2 known-answer questions with evidence anchors
- At least 1 edge-case question
- Taste principles are reasonably followed (long-form present, firsthand prioritized)

## Copyright Safety

- Do not paste long source passages into the audit
- Keep all notes paraphrased and source-aware

## Output Constraint

Write in the user's language.
