# Incremental Merge Prompt

## Task

You will receive:

1. Existing `work.md`
2. Existing `persona.md`
3. New source material (files or messages)

Decide which part should be updated and output incremental updates only.

**Principle:** append deltas, do not overwrite existing conclusions. If there is a conflict, surface it and ask the user to decide.

---

## Step 1: Classify the new information

Classify each new piece of information:

| Information Type | Destination |
|------------------|-------------|
| Technical standards, code style, API design, workflows | `work.md` |
| Business knowledge, system ownership, technical conclusions | `work.md` |
| Communication style, catchphrases, wording habits | `persona.md` |
| Decision behavior, interpersonal patterns, emotional reactions | `persona.md` |
| Applies to both | split into both files |

---

## Step 2: Check for conflicts

Compare the new content with the existing content:

- If it **adds new detail** to an existing conclusion -> append it
- If it **confirms** an existing conclusion -> ignore it
- If it **contradicts** an existing conclusion -> surface a conflict:

```text
Warning: conflict detected
- Existing: {existing description}
- New finding: {new description}
- Source: {file / timestamp}

Recommendation: keep existing / replace with new / keep both and label by time
Ask the user to decide.
```

---

## Step 3: Generate the update patch

For `work.md`, output:

```text
=== work.md update ===

[Append to "Technical Standards / Naming" section]
- {new content}

[Append to "Experience Knowledge Base" section]
- {new conclusion}

[No changes] or [The sections above should be updated]
```

For `persona.md`, output:

```text
=== persona.md update ===

[Append to "Layer 2 / Wording Habits"]
- New catchphrase: "{xxx}"

[Append to "Layer 4 / Peer Behavior"]
- {new behavior description}

[No changes] or [The sections above should be updated]
```

---

## Step 4: Generate the update summary

Show the user:

```text
Update summary:
- work.md: appended {N} new items ({brief description})
- persona.md: appended {N} new items ({brief description})
- Found {N} conflicts that need your confirmation (see above)

Version will change from {vN} to {vN+1}.
Apply this update?
```
