# Celebrity Budget-Unfriendly Persona Analyzer

## Task

Use the full research pipeline outputs to extract a public figure's durable cognitive system.

Read and synthesize:

- the six-track research notes
- `knowledge/research/reviews/research_audit.md`
- the synthesis review
- the validation review

This mode must be stricter than the standard celebrity analyzer. Every claim needs evidence anchors.

---

## Extraction Priorities (in order)

### 1. Mental Models with Evidence Anchors

Extract 3–7 distinctive mental models. Each must:

- Pass the triple gate (cross-context recurrence, generative power, exclusivity)
- Have at least 2 evidence anchors from different tracks/contexts
- Include a documented failure mode
- Include what it systematically filters out or ignores

Any model that failed the audit or validation review must be demoted or excluded.
Models that passed synthesis but with caveats: keep but annotate the caveat.

### 2. Decision Heuristics with Case Evidence

Extract 5–10 decision heuristics that survive beyond single anecdotes:

- Each heuristic should have at least 1 supporting case from research
- Include context boundaries (when does this heuristic apply? when doesn't it?)
- Distinguish between stated heuristics and revealed heuristics (what they say vs. what they do)

### 3. Expression DNA with Quantified Markers

Extract recognizable linguistic patterns with enough specificity to pass a blind test:

- Sentence rhythm quantified (short/medium/long average, variation pattern)
- Metaphor inventory with domain sources (where do their analogies come from?)
- Certainty language markers (how they express high vs. low confidence)
- Disagreement style (confrontational, reframing, Socratic, dismissive, etc.)
- Humor style and frequency
- Forbidden vocabulary — words or framings they actively avoid

Validation standard: 100 words should be identifiable as this person with the name removed.

### 4. Anti-patterns, Boundaries, and Contradictions

- What they explicitly reject and why
- Stated limitations and acknowledged blindspots
- Internal contradictions classified as temporal / contextual / inherent
- At least 2 substantive tensions preserved (not explained away)

### 5. Intellectual Genealogy

- Influenced by: whose ideas shaped them (with specifics, not just names)
- Diverged from: where they broke with their influences
- Influenced: who follows or builds on their approach
- Tradition: what school or movement they represent or reject

### 6. Agentic Protocol Derivation

From the validated mental models, derive:

- What dimensions this person would investigate before answering a novel question
- What they would want to know first (their "Step 2 research questions")
- What sources they would trust and distrust
- How they would structure their analysis

This drives the Agentic Protocol in the generated Skill, making it research before answering
rather than relying on training corpus alone.

---

## Rules

- Evidence outranks stylistic mimicry
- Distinctive patterns outrank generic wisdom
- Preserve uncertainty when the evidence is incomplete
- Any model that failed the audit or validation should be demoted or excluded
- Write in the user's language
- Do not rely on long direct quotes
- Separate evidence from inference in every section
- If a dimension has thin evidence, mark it explicitly rather than fabricating depth
