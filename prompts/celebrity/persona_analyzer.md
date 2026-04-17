# Celebrity Persona Analyzer

## Task

Use the research outputs to extract a public figure's durable cognitive architecture.

Do not optimize for cosplay or theatrical imitation.
Optimize for a usable thinking framework that captures HOW they think, not WHAT they said.

The output should be distinctive enough that — with the name removed — a knowledgeable reader
could identify whose thinking this represents.

---

## Extraction Targets

### 1. Expression DNA

Extract the linguistic fingerprint — patterns that make this person's communication recognizable.

- **Tone**: formal/casual, warm/detached, provocative/measured
- **Cadence**: sentence rhythm, use of short punchy fragments vs. long flowing explanations
- **Metaphor inventory**: what domains do they draw analogies from? (war, sports, cooking, physics, etc.)
- **Compression level**: do they explain fully or assume the audience keeps up?
- **Emphasis techniques**: how do they drive a point home? (repetition, contrast, escalation, understatement)
- **Certainty markers**: how do they signal confidence vs. uncertainty?
- **Humor style**: self-deprecating, absurdist, dry, combative, or absent
- **Signature phrases**: recurring framings, verbal tics, characteristic word choices

Validation: could someone recognize this person from a 100-word sample with the name removed?

### 2. Mental Models

Extract the conceptual frameworks they use repeatedly to make sense of the world.

For each model:
- **Name**: a concise label
- **One-line definition**: what it captures
- **What it sees first**: what this lens draws attention to
- **What it filters out**: what this lens systematically ignores
- **How it reframes problems**: how applying this model changes the way you think about a situation
- **Evidence anchors**: at least 2 instances where they applied this model across different contexts
- **Failure mode**: when does this model lead them astray?

Quality gate — every candidate mental model must pass at least 2 of 3:
1. **Cross-context recurrence**: appears in at least 2 different domains/contexts
2. **Generative power**: helps predict their stance on novel, unstudied problems
3. **Exclusivity**: meaningfully distinctive — not generic wisdom any smart person would share

Models passing all 3 → keep as mental models.
Models passing 1–2 → demote to decision heuristics.
Models passing 0 → discard.

### 3. Decision Heuristics

Extract the quick judgment rules they use — the "if X, then Y" patterns.

- what they optimize for in most decisions
- what they are willing to sacrifice
- when they move fast (low deliberation)
- when they wait (high deliberation)
- what kind of evidence changes their mind
- what triggers a reversal vs. what they'll stubbornly hold

### 4. Anti-patterns and Boundaries

Extract what they reject and where they draw limits.

- what they repeatedly warn against
- what they consider naive, lazy, or weak thinking
- patterns they refuse to engage with
- where they are honest about their own limitations
- stated blindspots and acknowledged weaknesses

### 5. Tension and Contradiction

Extract the internal tensions that define this person's complexity.

Classify contradictions:
- **Temporal**: views that evolved over time (record the trajectory)
- **Contextual**: different principles in different domains (record the domain boundaries)
- **Inherent**: core value tensions that remain unresolved (record as depth sources, not bugs)

Do not resolve contradictions. Preserve them.

### 6. Intellectual Genealogy

Extract the influence network.

- **Influenced by**: whose ideas shaped their thinking? (specific thinkers, schools, traditions)
- **Diverged from**: where do they explicitly disagree with their influences?
- **Influenced**: who cites them, follows their approach, or builds on their work?
- **Intellectual tradition**: what broader school or movement do they belong to (or reject)?

### 7. Agentic Protocol Derivation

From the mental models, derive what this person would research before answering a novel question.

- Given their mental models, what dimensions would they investigate?
- What questions would they ask before forming an opinion?
- What sources would they trust vs. distrust?
- What would they want to know first?

This will be used to generate the Agentic Protocol in the persona builder.

---

## Output Format

```text
Expression DNA:
  Tone: ...
  Cadence: ...
  Metaphors: ...
  Compression: ...
  Signature moves: ...
  Humor: ...
  Blind test confidence: [high/medium/low]

Mental Models: [3-7]
  - {model name}: {definition}
    Evidence: ...
    Sees first: ...
    Filters out: ...
    Failure mode: ...
    Gates passed: [cross-context, generative, exclusive]

Decision Heuristics: [5-10]
  - {rule}: {when/how applied}

Anti-patterns: [...]
Honest Boundaries: [...]

Contradictions: [2+ tensions]
  - Type: [temporal/contextual/inherent]
  - Description: ...

Intellectual Genealogy:
  Influenced by: ...
  Diverged from: ...
  Influenced: ...

Agentic Protocol Seeds:
  When facing a new problem, this person would first: ...
  They would research: ...
  They would distrust: ...
```

---

## Rules

- Write in the user's language
- Separate evidence from inference — always mark which is which
- Quote only very short key phrases when useful for expression DNA
- Keep the person intellectually recognizable, not theatrically imitated
- Do not turn source notes into stitched quotations
- Preserve contradictions — they are features, not bugs
- If evidence is thin for a dimension, say so explicitly rather than fabricating depth
