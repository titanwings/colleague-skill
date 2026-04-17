# Celebrity Merger

## Task

Evolve an existing celebrity-based skill when new material arrives or the user
issues a correction. Preserve the person's complexity — do not flatten them into
a cleaner but less-true version.

The persona already has structure. Your job is to thread new evidence into the
right layer without damaging what is already calibrated.

---

## Two Evolution Modes

### Mode A — Material-driven update

Triggered when the user supplies fresh research (new interviews, talks,
writings, subtitles, transcripts via `tools/research/transcribe_audio.py`).

Sequence:

1. Run the intake / research pipeline for the **new** material only (keep it
   in a dated subfolder under `knowledge/research/raw/` so provenance is clear).
2. Re-run `tools/research/merge_research.py <skill_dir>` to refresh the merged
   summary with the added files.
3. Diff the new extraction against the existing `persona.md` before rewriting
   anything. Most material will confirm what is there; only a minority will
   change the shape.

### Mode B — Correction-driven update

Triggered when the user says "this is wrong", "你刚才理解错了", provides a direct
quote that contradicts current output, or demands a tone/boundary fix.

Sequence:

1. Write the correction verbatim into the Correction Log with a timestamp and
   the triggering user phrase.
2. Trace the correction to the specific layer it touches (mental model,
   heuristic, expression DNA, genealogy, etc.).
3. Adjust that layer minimally. Do not cascade edits into layers the user did
   not correct.

---

## Merge Priorities (by Persona Layer)

### Layer 1 — Identity

Only change when the new material reveals a stable self-description the current
identity blurb misses, or when the user corrects the activation disclaimer.

### Layer 2 — Expression DNA

Update when new material supplies:

- Additional voice samples that pass the 100-word blind test
- A recurring metaphor or framing device with clear domain source
- A certainty-language marker or forbidden-vocabulary item confirmed across
  three or more contexts

Do not replace existing samples with newer ones unless the older ones fail the
triple-gate (cross-context, generative, exclusive). Diversity of anchor material
matters more than recency.

### Layer 3 — Mental Models

A new mental model qualifies for inclusion only if it passes the triple-gate:

1. **Cross-context recurrence** — appears in at least three independent sources
   across different topics or time periods.
2. **Generative** — can produce new reasoning, not just re-describe one past
   take.
3. **Exclusive** — someone with a different worldview would not land on it by
   default.

When a new model is added, annotate:

- Evidence anchors (2+ instances from different contexts)
- Failure mode
- Application boundary
- Whether it complements, refines, or tensions with an existing model

Do not delete existing models. If contradicted, mark the tension explicitly in
Layer 6 (Internal Tensions).

### Layer 4 — Decision Heuristics

Update when new material shows the person applying a consistent rule the
current persona does not capture, or when a correction reveals the current
phrasing over-generalizes.

Maintain the "if X, then Y" structure with reasoning and context boundary.

### Layer 5 — Anti-patterns and Boundaries

Strengthen with new repeated rejections or newly acknowledged blindspots.
If the new material shows the person changing their mind on a prior rejection,
record both — the prior rejection and the revised position — with dates.

### Layer 6 — Internal Tensions

If the new material introduces a contradiction, add it to the tensions list.
Classify as Temporal / Contextual / Inherent. Never silently reconcile a tension
just because new material favors one side — note the tilt and the evidence for
it, but keep the tension visible if it remains live.

### Layer 7 — Intellectual Genealogy

Update `Influenced by` / `Diverged from` / `Influenced` / `Tradition` when:

- The person explicitly names an influence the current persona does not record
- Published criticism maps their work onto a tradition the persona misses
- A successor figure publicly acknowledges drawing on this person's work

Keep the "diverged from" axis crisp — it is often the most compressed signal
of what the person uniquely stands for.

### Layer 8 — Agentic Protocol

Update the Step 1 question categories when new material reveals a question
type the current classifier does not handle. Update Step 2 research dimensions
when the person has publicly described a research habit not yet reflected
(e.g., "I always look at the bear case first", "I read the footnotes before
the abstract").

Do not rewrite the protocol to match a single new interview. The protocol
should stay stable across many sources; one-off quirks go into anti-patterns
instead.

### Cognitive Timeline

Add a new phase entry only when the new material reveals a genuine turning
point, not a restatement. If the person publicly named the shift, quote the
phrase that named it.

### Validation Anchors

When new material gives a clean known-answer case, consider swapping it in if
the existing anchors have grown stale or if the new case exercises a mental
model that was under-tested.

### Correction Log

Mode B entries land here. Format:

```text
- [YYYY-MM-DD] User correction: "{user phrase}"
  Affected layer: {layer name}
  Change made: {one-line summary}
  Evidence for change: {what backs the correction — user authority, cited
  source, contradiction with existing anchor, etc.}
```

Never delete correction-log entries, even when superseded. They are the audit
trail.

---

## Rules

- Prefer first-person material over commentary.
- Carry source weights (1–7) forward; when weights conflict, weight the higher
  tier.
- Mark recency-sensitive updates clearly (e.g., "as of 2026-04" for positions
  that may drift).
- Preserve evolution across time — do not collapse it into the current state.
- If the new material contradicts an existing anchor, keep both and mark the
  contradiction, unless a Mode-B correction explicitly overrides.
- Re-run `tools/research/quality_check.py <skill_dir> --profile <profile>`
  after merging. All previously-passing checks should still pass.

---

## Output Format

```text
=== mode ===
{material-driven | correction-driven}

=== persona.md update ===
{patch — layer by layer, only touching changed layers}

=== correction_log.md update (if Mode B) ===
{appended entry}

=== summary ===
- layers touched: {list}
- mental models added: {n}
- mental models refined: {n}
- heuristics added / refined: {n}
- tensions added: {n}
- genealogy updates: {n}
- timeline phases added: {n}
- validation anchors updated: {n}
- corrections logged: {n}
- contradictions preserved (not flattened): {n}

=== quality gate ===
- research_metrics after merge: {paste relevant fields}
- quality_check.py result: {pass/fail with which checks flipped}
```
