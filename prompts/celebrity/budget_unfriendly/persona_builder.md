# Celebrity Budget-Unfriendly Persona Builder

## Task

Generate a deeper `persona.md` for a public figure using the full research pipeline:

- six-track research notes
- research audit
- synthesis review
- validation review
- `references/celebrity_budget_unfriendly_template.md`

This mode produces a richer, more evidence-backed persona than the standard builder.

---

## Requirements

- Every mental model must be evidence-backed with at least 2 cross-context anchors
- Expression DNA must be specific enough to pass a 100-word blind identification test
- Include honest boundaries and failure modes for each model
- Include at least two substantive tensions (contradictions)
- Include a compact source-grounding section with inspected sources only
- Include an Agentic Protocol derived from this person's specific mental models
- Include intellectual genealogy with specific borrowed ideas and divergence points
- Include a cognitive timeline showing thinking evolution, not just biographical events
- Keep all source use paraphrased except for very short phrases
- Do not ship a polished draft if the validation review says `FAIL` — fix issues first

---

## Structure

Follow the same structure as the standard celebrity persona builder, with these additional depth requirements:

### Layer 3 (Mental Models) — Enhanced

Each model (3–7 total) must include:

- Name and one-line definition
- What it sees first / what it filters out
- How it reframes problems
- **Evidence anchors**: at least 2 instances from different contexts (paraphrased, with source attribution)
- **Failure mode**: when does this model lead them astray? (with evidence if available)
- **Application boundary**: when should this model NOT be applied?
- **Triple-gate result**: which gates it passed (cross-context, generative, exclusive)

### Layer 4 (Decision Heuristics) — Enhanced

Each heuristic (5–10 total) must include:

- The rule itself ("if X, then Y")
- **Supporting case**: at least 1 documented instance
- **Context boundary**: when does this heuristic apply vs. not apply?
- **Stated vs. revealed**: does this match what they say, or only what they do?

### Layer 5 (Anti-patterns and Limits) — Enhanced

- Known blindspots with specific evidence (not generic "everyone has blindspots")
- For each honest boundary, specify what additional material would reduce it
- Contradictions with classification (temporal/contextual/inherent) and evidence

### Layer 7 (Agentic Protocol) — Enhanced

The research dimensions in Step 2 must be:
- Derived directly from this person's validated mental models
- Specific to their analytical approach (not generic "gather data, analyze, conclude")
- Include what sources they would trust vs. distrust
- Include what they would want to know FIRST (their priority ordering)

### Validation Anchors (new section)

Include at the end:

```markdown
## Validation Anchors

### Known-Answer Tests
- Q: {question this person has publicly answered}
  Expected direction: {what they would say, based on evidence}
  Confidence: {high/medium}

- Q: {second question}
  Expected direction: ...

### Edge-Case Test
- Q: {adjacent question with no known direct answer}
  Expected approach: {how they would reason about it, based on mental models}
  Confidence: low — this is extrapolation
```

---

## Output Constraint

Write in the user's language.
