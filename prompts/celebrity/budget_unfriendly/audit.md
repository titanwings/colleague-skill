# 名人研究审计 Prompt · budget-unfriendly（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

对 6-track 研究笔记做审计：给出明确的 `PASS` / `FAIL`，检查信源层级合规（无黑名单）、primary 比例 > 50%、品味原则遵守情况与冷门人物评估；FAIL 时输出 Backfill Tasks。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 审计结论必须是明确的 `PASS` 或 `FAIL`，并逐项列出检查依据与锚点。
5. FAIL 时先按 Backfill Tasks 补齐对应 track，不得跳到 synthesis。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止为了让审计通过而修改或美化研究笔记。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

# Celebrity Budget-Unfriendly Research Audit Prompt

## Task

Audit the six-track celebrity research set before synthesis.

Read:

- all files under `knowledge/research/raw/`
- `knowledge/research/merged/summary.md`
- `references/celebrity_budget_unfriendly_framework.md`

Write the audit to `knowledge/research/reviews/research_audit.md`.

## Audit Responsibilities

The audit is a hard gate. Do not treat it as a decorative summary.
You must judge whether the research set is ready for synthesis.

A FAIL means the research needs more work. A PASS means synthesis can proceed.

## Required Sections

Use this structure:

```md
# Research Audit

## Verdict
- Status: PASS / FAIL
- Reason: ...

## Coverage Review
- Track coverage: {N}/6 dimensions covered
- Missing or weak tracks: ...
- Cross-track redundancy: {are tracks meaningfully distinct or cloning observations?}

## Source Quality Assessment

### Source Mix
- Primary-source count: ...
- Secondary-source count: ...
- Primary-source ratio: ...% (target: >50%)
- Grounding quality: {are URLs actual inspected pages?}

### Source Hierarchy Compliance
- Sources from weight 1-3 (highest quality): ...
- Sources from weight 4-5 (medium quality): ...
- Sources from weight 6-7 (lowest quality): ...
- Blacklisted sources used: {list any — these are automatic failures}

### Taste Principle Compliance
- Long-form vs. snippet ratio: ...
- Firsthand vs. secondhand ratio: ...
- Controversial/distinctive positions captured: {yes/no, examples}
- Thinking evolution documented: {yes/no}

## Contradictions Inventory
- Total contradictions found: ...
- Classification:
  - Temporal (view evolution): ...
  - Contextual (domain differences): ...
  - Inherent (value tensions): ...
- Quality: {are these substantive tensions or superficial?}

## Mental Model Candidates
- Candidate count: ... (target: ≥3)
- For each candidate:
  - Name: ...
  - Cross-context evidence: {present in which dimensions?}
  - Preliminary gate assessment: ...

## Known-Answer Bank
- Question 1: ...
  Evidence anchors: ...
- Question 2: ...
  Evidence anchors: ...
- Strength: {are these answerable from the research evidence?}

## Edge-Case Candidate
- Question: ...
- Why this is adjacent but under-evidenced: ...
- Expected reasoning approach: ...

## Cold Figure Assessment
- Total grounded sources: ...
- Is this a cold figure (<10 sources)? {yes/no}
- If yes: recommended degradation strategy: ...

## Backfill Tasks
(Specific, actionable items to improve the research before synthesis)
- ...
- ...
```

## Audit Rules — FAIL Conditions

Fail the audit if any of these conditions hold:

- The six-track set is incomplete (any dimension missing)
- Tracks are not meaningfully distinct (cloned observations across files)
- Grounded URLs are thin or low-quality (< 8 actual inspected pages)
- Primary material is too weak relative to commentary (< 50% primary)
- Any blacklisted sources were used as evidence
- Contradictions are missing or flattened away (< 3 substantive tensions)
- There is not enough evidence to support at least 3 mental models
- The known-answer bank is too weak to support later validation (< 2 questions)
- Long-form sources are underrepresented relative to snippets
- Source hierarchy is bottom-heavy (mostly weight 5-7 sources)

## Audit Rules — PASS Conditions

Pass the audit when:

- All 6 dimensions are covered with meaningfully distinct content
- At least 8 grounded URLs from actual inspected pages
- Primary-source ratio > 50%
- No blacklisted sources
- At least 3 substantive contradictions documented
- At least 3 candidate mental models with cross-dimensional evidence
- At least 2 known-answer questions with evidence anchors
- At least 1 edge-case question
- Taste principles are reasonably followed (long-form present, firsthand prioritized)

## Copyright Safety

- Do not paste long source passages into the audit
- Keep all notes paraphrased and source-aware

## Output Constraint

Write in the user's language.

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. The audit verdict must be an explicit `PASS` or `FAIL`, with each check listed together with its evidence and anchors.
5. On `FAIL`, backfill the named tracks from the Backfill Tasks before any synthesis.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never edit or prettify the research notes just to make the audit pass.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
