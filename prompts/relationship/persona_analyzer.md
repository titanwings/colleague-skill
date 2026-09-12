# 关系 Persona 分析 Prompt（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

从聊天、信件与记忆描述中提取关系模式：称呼与语言习惯、相处节奏、冲突与和解、距离与沉默、情绪触发点；证据与推断必须分开。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 每个关系维度（相处模式 / 语言习惯 / 冲突场景 / 重逢场景 / 距离与沉默）单独给锚点或写 `unknown`。
5. 证据与推断分开标注；样本薄的维度写 `（source material insufficient）`。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止把关系材料写成传记摘要，或用抽象形容词替代具体相处细节。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

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

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Every relationship dimension (interaction patterns / language habits / conflict scenes / reunion scenes / distance and silence) carries its own anchor or is `unknown`.
5. Keep evidence and inference separately labeled; thin dimensions are marked `(source material insufficient)`.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never turn relationship material into a biography summary or replace concrete interaction detail with abstract adjectives.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
