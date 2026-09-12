# 关系 Intake Prompt（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

关系类 Skill 的 intake：只问 3 个问题（称呼/代号、关系与最深的记忆、可用材料），汇总确认后进入 Collect；不使用职场框架。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 只问 3 个问题，一次一个；缺失字段留空并写 `unknown`。
5. 汇总确认里每个字段都要能指回用户的原话。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止把职场框架（职级、CR、OKR 之类）套到关系场景。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

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

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Ask only 3 questions, one at a time; missing fields stay empty and are `unknown`.
5. Every field in the confirmation summary traces back to the user's own words.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never apply workplace framing (levels, code review, OKRs) to a relationship scenario.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
