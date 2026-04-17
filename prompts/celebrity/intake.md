# Celebrity Intake Prompt

## Goal

Collect enough information to launch a research-first celebrity distillation workflow,
while actively helping users who are unsure about who to distill or what they need.

---

## Entry Routing

Detect the user's intent and route accordingly:

### Direct Path

User names a specific person (e.g., "distill Paul Graham", "做一个张一鸣的 Skill").

→ Go straight to Q1–Q5 below.

### Diagnostic Path

User describes a vague need without naming a person (e.g., "I want someone who's
good at product thinking", "我想找一个能帮我做投资决策的人").

→ Run the diagnostic sub-flow before Q1.

---

## Diagnostic Sub-Flow (only when no specific person is named)

### Round 1: Identify the dimension

```text
You haven't named a specific person. Let me help you find the right one.

What kind of thinking do you need help with?

Examples:
- Product decisions and taste
- Investment and risk judgment
- Engineering and systems design
- Communication and persuasion
- Creative writing and storytelling
- Management and team building
- Scientific thinking and explanation
```

Capture:
- domain / thinking dimension
- whether the user prefers a specific era, culture, or language

### Round 2: Narrow and recommend

Based on the user's dimension, recommend 2–3 candidates. Prioritize:
1. People already distilled as existing Skills in the system
2. People with abundant public material (books, long interviews, documented decisions)
3. People whose thinking is distinctive enough to produce a high-quality Skill

```text
Based on what you described, here are some candidates:

1. {Name A} — {one-line reason}
2. {Name B} — {one-line reason}
3. {Name C} — {one-line reason}

Who sounds right? Or name someone else.
```

Once the user picks, proceed to Q1.

---

## Opening (Direct Path)

```text
I'll help you distill a public figure into a Skill. Answer 5 questions. Every question except Q1 is skippable.
```

---

## Questions

### Q1: Who is it

```text
Who do you want to distill?

Examples:
- Steve Jobs
- Naval Ravikant
- 张一鸣
- Charlie Munger
- Richard Feynman
```

Capture:
- canonical name
- aliases
- likely language / region
- whether this person is well-known (abundant material) or relatively obscure

### Q2: Why this person

```text
What do you want from this person's Skill?

Examples:
- how they make decisions
- how they think about products
- how they explain complex ideas
- how they judge people and tradeoffs
- how they approach risk and uncertainty
```

Capture:
- use case
- desired lens / focus area
- output bias: strategy / expression / explanation / judgment / creativity

### Q3: Any known materials

```text
Do you already have source material? Books, interviews, talks, posts, podcasts, articles, screenshots — anything is fine.

If you have local files (PDF, transcripts, subtitle files, screenshots), mention them now.
```

Capture:
- local materials (files the user can provide directly)
- URLs of specific known sources
- known books / talks / interviews by title
- whether this should run in local-first mode

### Q4: Collection strategy

Based on Q3, determine and confirm the collection strategy:

```text
Based on what you've told me, I'll use this collection approach:

  [A] Local-first: You have substantial local material. I'll analyze that first,
      then only search the web for missing dimensions.

  [B] Web + local: You have some material. I'll combine it with web research.

  [C] Web-only: No local material. I'll do a full web research pass.

Sound right? (confirm / change)
```

The three strategies affect how Phase 1 research allocates effort:
- **Local-first**: Analyze provided materials first, map which of the 6 dimensions are covered, only search web for gaps
- **Web + local**: Run full 6-dimension web research, then merge with local materials, use local as ground truth where they overlap
- **Web-only**: Standard 6-dimension web research pass

### Q5: Research depth

```text
Which research profile?

- budget-friendly: faster, lighter, 3-track minimum
- budget-unfriendly: slower, deeper, 6-track with audit + synthesis + validation gates

Default: budget-friendly
```

Capture:
- requested research profile
- whether the user prefers speed or confidence

---

## Cold Figure Detection

After Q1, estimate whether this person has sufficient public material.

Signals of a cold figure:
- no Wikipedia page or very short one
- no published books or long-form interviews
- limited to social media presence only
- user cannot name specific works or talks

If cold figure is detected:

```text
⚠️ Note: {name} appears to have limited public material.

This means:
- Mental models will be limited to 2–3 (instead of 3–7)
- Some dimensions may be marked as "based on limited information"
- The honest boundaries section will be larger than usual

This is fine — an honest 60-point Skill beats a fabricated 90-point one.

Continue? (yes / switch to someone else)
```

---

## Output Summary

```text
Summary:

  Person: {name}
  Region/Language: {region}
  Main goal: {goal}
  Known sources: {source_summary}
  Collection strategy: {local-first / web+local / web-only}
  Research profile: {research_profile}
  Cold figure: {yes/no}

Confirm? (confirm / edit [field])
```
