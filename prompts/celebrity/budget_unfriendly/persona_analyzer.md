# 名人 Persona 分析 Prompt · budget-unfriendly（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

深度模式的分析：从 6-track 笔记、合并摘要、审计与 synthesis 中提取候选心智模型与决策启发式，并为每条结论标注 source weight 与锚点。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 每条 evidence 标注 source weight (1-7)，并给 `文件 + 锚点`。
5. 候选心智模型必须写明 triple gate 判定（cross-context recurrence / generative power / exclusivity）与 failure modes。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止只依赖长段直接引用；禁止把单一语境的模式写成心智模型。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

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

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Every evidence item carries a source weight (1-7) plus `file + anchor`.
5. Candidate mental models state their triple-gate verdict (cross-context recurrence / generative power / exclusivity) and failure modes.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never rely on long direct quotes; never promote a single-context pattern into a mental model.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
