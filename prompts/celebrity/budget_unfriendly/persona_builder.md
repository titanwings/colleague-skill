# 名人 Persona 生成 Prompt · budget-unfriendly（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

深度模式的 persona 生成：Layer 0–7 + 认知时间线 + Correction Log，每个结论可回溯到 6-track 笔记的 source weight 与锚点。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 每层结论回溯到 6-track 笔记的 source weight 与锚点；证据薄的地方显式标注。
5. 保留矛盾与时间演化，不把它们压平成当前状态。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止编造引文、书名、视频标题；禁止用泛化形容词替代可辨识的思维特征。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

# Celebrity Budget-Unfriendly Persona Builder

## Task

Generate a deeper `persona.md` for a public figure using the full research pipeline:

- six-track research notes
- research audit
- synthesis review
- validation review
- `references/celebrity_budget_unfriendly_template.md`

This mode produces a richer, more evidence-backed persona than the standard builder.

---

## Requirements

- Every mental model must be evidence-backed with at least 2 cross-context anchors
- Expression DNA must be specific enough to pass a 100-word blind identification test
- Include honest boundaries and failure modes for each model
- Include at least two substantive tensions (contradictions)
- Include a compact source-grounding section with inspected sources only
- Include an Agentic Protocol derived from this person's specific mental models
- Include intellectual genealogy with specific borrowed ideas and divergence points
- Include a cognitive timeline showing thinking evolution, not just biographical events
- Keep all source use paraphrased except for very short phrases
- Do not ship a polished draft if the validation review says `FAIL` — fix issues first

---

## Structure

Follow the same structure as the standard celebrity persona builder, with these additional depth requirements:

### Layer 3 (Mental Models) — Enhanced

Each model (3–7 total) must include:

- Name and one-line definition
- What it sees first / what it filters out
- How it reframes problems
- **Evidence anchors**: at least 2 instances from different contexts (paraphrased, with source attribution)
- **Failure mode**: when does this model lead them astray? (with evidence if available)
- **Application boundary**: when should this model NOT be applied?
- **Triple-gate result**: which gates it passed (cross-context, generative, exclusive)

### Layer 4 (Decision Heuristics) — Enhanced

Each heuristic (5–10 total) must include:

- The rule itself ("if X, then Y")
- **Supporting case**: at least 1 documented instance
- **Context boundary**: when does this heuristic apply vs. not apply?
- **Stated vs. revealed**: does this match what they say, or only what they do?

### Layer 5 (Anti-patterns and Limits) — Enhanced

- Known blindspots with specific evidence (not generic "everyone has blindspots")
- For each honest boundary, specify what additional material would reduce it
- Contradictions with classification (temporal/contextual/inherent) and evidence

### Layer 7 (Agentic Protocol) — Enhanced

The research dimensions in Step 2 must be:
- Derived directly from this person's validated mental models
- Specific to their analytical approach (not generic "gather data, analyze, conclude")
- Include what sources they would trust vs. distrust
- Include what they would want to know FIRST (their priority ordering)

### Validation Anchors (new section)

Include at the end:

```markdown
## Validation Anchors

### Known-Answer Tests
- Q: {question this person has publicly answered}
  Expected direction: {what they would say, based on evidence}
  Confidence: {high/medium}

- Q: {second question}
  Expected direction: ...

### Edge-Case Test
- Q: {adjacent question with no known direct answer}
  Expected approach: {how they would reason about it, based on mental models}
  Confidence: low — this is extrapolation
```

---

## Output Constraint

Write in the user's language.

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Every layer traces back to a source weight and anchor in the six-track notes; thin evidence is marked explicitly.
5. Preserve contradictions and evolution over time instead of flattening them into the present state.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never invent quotes, book titles, or video titles; never replace recognizable thinking with generic adjectives.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
