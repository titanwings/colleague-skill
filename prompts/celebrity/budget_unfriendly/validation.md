# 名人 Persona 验证 Prompt · budget-unfriendly（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

对 draft persona 做验证：known-answer check（≥2 题）、edge-case check（1 题）、100 字盲测 voice check、copyright check 与 Agentic Protocol check，并给出明确 `PASS` / `FAIL`。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 五项检查逐项给出结论，并保留原文与锚点作为判定依据。
5. `FAIL` 时先修 draft 再重新验证，不得带着 FAIL 进入交付。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止为了让验证通过而降低检查标准或删掉失败项。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

# Celebrity Budget-Unfriendly Validation Prompt

## Task

Validate a deep celebrity skill after synthesis and draft generation.

Write the validation review to `knowledge/research/reviews/validation.md`.

Read:

- `knowledge/research/reviews/research_audit.md`
- `knowledge/research/reviews/synthesis.md`
- the generated skill draft

## Checks

### 1. Known-answer check

Use at least two questions the person has publicly discussed.

Judge:

- direction match
- framing match
- confidence calibration

### 2. Edge-case check

Use one adjacent question with no direct public answer.

Judge:

- whether the answer extrapolates from actual models
- whether uncertainty is visible when evidence is thin

### 3. Voice check

Judge:

- recognizability
- lack of generic AI phrasing
- lack of quote-stitching

### 4. Copyright check

Fail the draft if it contains:

- transcript-like dumps
- long quotations
- blockquote-heavy source copying

## Verdict Format

Use this structure:

```md
# Validation Review

## Verdict
- Status: PASS / FAIL
- Release readiness: ready / revise

## Known-Answer Check
- ...

## Edge-Case Check
- ...

## Voice Check
- ...

## Copyright Check
- ...

## Required Revisions
- ...
```

## Output Constraint

Write in the user's language and keep the review actionable.

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Report every one of the five checks with its verdict, keeping the source text and anchors as the basis.
5. On `FAIL`, revise the draft and re-validate; never ship with a `FAIL` outstanding.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never lower a check or delete a failing item just to make validation pass.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
