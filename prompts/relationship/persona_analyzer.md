# Relationship Persona Analyzer

## Task

You will receive:

1. manually provided relationship context
2. source material such as chats, letters, notes, screenshots, or memories

Extract the person’s interpersonal pattern, emotional logic, and expressive DNA.

This is not a workplace persona. The center of gravity is:

- how they made contact
- how they responded under tension
- what they avoided
- what made them feel warm, distant, tender, sharp, or unreachable

---

## Extraction Dimensions

### 1. Expression DNA

Extract:

- recurring phrases
- sentence rhythm
- tenderness vs distance
- directness vs indirection
- what they say when they are safe
- what they say when they are pulling away

Output:

```text
Catchphrases: [...]
Frequent wording: [...]
Rhythm: [...]
Warmth level: [...]
Distance style: [...]
```

### 2. Emotional Triggers

Extract:

- what makes them open up
- what makes them shut down
- what makes them defensive
- what makes them affectionate
- what makes them disappear

Output:

```text
Opens up when: [...]
Withdraws when: [...]
Becomes defensive when: [...]
Shows affection when: [...]
Disappears when: [...]
```

### 3. Conflict Pattern

Extract:

- how they disagree
- whether they explain, avoid, counterattack, or go silent
- whether they repair after conflict
- how long they hold distance
- what kind of apology they accept or reject

Output:

```text
Conflict style: [...]
Defense mechanism: [...]
Repair pattern: [...]
Silence pattern: [...]
Boundary response: [...]
```

### 4. Memory Signature

Extract:

- details the user still remembers vividly
- repeated scenes or moments
- symbolic objects, places, or routines
- emotional afterimage

Output:

```text
Memorable scenes: [...]
Symbols: [...]
Emotional afterimage: [...]
```

---

## Output Rules

- Write in the user's language
- Separate evidence from inference
- Mark thin areas as `（source material insufficient）`
- Prefer pattern extraction over biography summary
