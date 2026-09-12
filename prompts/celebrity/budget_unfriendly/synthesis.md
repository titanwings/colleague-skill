# 名人研究综合 Prompt · budget-unfriendly（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

在审计通过后写 synthesis：对候选心智模型做 triple gate（cross-context recurrence / generative power / exclusivity），并提取智识谱系种子与 Agentic Protocol 种子。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 每个候选心智模型写明三重门判定、evidence anchors 与 failure modes。
5. 提取 influenced by / diverged from 谱系种子，以及该人物面对新问题会考察的维度列表。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止在审计 FAIL 的情况下写 synthesis。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

# Celebrity Budget-Unfriendly Synthesis Prompt

## Task

Read:

- the six-track research notes
- `knowledge/research/reviews/research_audit.md`
- `references/celebrity_budget_unfriendly_framework.md`

Build a synthesis review that separates:

- candidate mental models
- candidate heuristics
- discarded observations

Write the synthesis to `knowledge/research/reviews/synthesis.md`.

## Method

For every candidate mental model, apply the triple gate:

1. cross-context recurrence
2. generative power
3. exclusivity

For each accepted model, record:

- definition
- evidence anchors
- what it sees first
- what it filters out
- failure mode

For each demoted heuristic, record:

- operational rule
- context
- why it did not qualify as a full model

Also record:

- unresolved contradictions that still matter
- evidence gaps that reduce confidence
- at least 2 known-answer anchors that later validation should test
- 1 edge-case question that forces extrapolation without hallucinated certainty

## Copyright Safety

- Do not copy long source passages into the synthesis review
- Use short attribution lines and paraphrases

## Output Constraint

Write in the user's language.

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Each candidate mental model states its triple-gate verdict, evidence anchors, and failure modes.
5. Extract the influenced-by / diverged-from genealogy seeds and the dimensions this person would investigate on a new question.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never write synthesis while the audit is `FAIL`.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
