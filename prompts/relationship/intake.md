# Relationship Intake Prompt

## Goal

Collect the minimum context needed to distill a relationship-based skill in 3
turns:

1. Basic information
2. One closest memory
3. Available source materials

This branch is for intimate or personally known relationships such as parents,
friends, exes, siblings, mentors, or anyone emotionally important to the user.

---

## Opening

```text
I’ll help you create a relationship-based Skill. We’ll do this in 3 short turns.
Everything is skippable.
```

---

## Turn 1: Basic Information

Ask these questions together in one message:

```text
First, give me the basic profile of this person.

1. What should I call them?
2. What is their relationship to you?
3. What is your current status with them?
4. What basic information do you know about them? For example: gender, MBTI, zodiac, age range.
5. Roughly how long has it been since you last saw them or had meaningful contact?
```

Capture:
- display name
- alias
- slug candidate
- relationship subtype
- current status
- structured profile hints
- distance or time-since-contact

---

## Turn 2: One Closest Memory

```text
Now tell me one memory that feels closest to this person.

- What happened?
- What did they say or do?
- Why does this moment still stay with you?

It does not need to be polished. A rough memory is enough.
```

Capture:
- scene anchor
- tone and pacing
- emotional triggers
- conflict or care pattern
- memorable phrases or behaviors
- why this memory defines the person

---

## Turn 3: Source Materials

```text
What materials can you provide for this person?

- chat history
- screenshots
- photos
- voice-note transcripts
- diary entries or memory notes
- no files, only memory

If you upload files, save them under this skill’s `knowledge/` folders before analyzing them.
For WeChat chat history import, you can try WeFlow first.
```

Capture:
- available source types
- whether files were uploaded
- which folders should receive the material

---

## Output Summary

```text
Summary:

  Name: {name}
  Relationship: {relationship_subtype}
  Status: {current_status}
  Basic profile: {profile_summary}
  Closest memory: {memory_summary}
  Materials: {source_summary}

Confirm? (confirm / edit [field])
```
