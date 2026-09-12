# 证据阅读 Prompt（怎么读 knowledge/text 与 evidence/derived）

## 任务

规定 LLM 在读 `knowledge/text/*` 与 `evidence/derived/*` 时的读取顺序、事实/候选的区分、锚点引用格式，以及样本不足时的表达方式。目标是让每条结论都能被第三方按锚点复核。

---

## 1. 读取顺序

1. `knowledge/index.json`（账本）：先看有哪些来源、各自 `sha256`、`bytes`、`method`、`credentialed`、`warnings[]`。账本里没有的东西不算来源。
2. `knowledge/text/<source>.md`（归一化正文）：逐段读，记下段落锚点。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*.json`（派生结论、每条带 evidence 锚点）。顺序不能反：先读派生文件再补跑命令，会让结论失去锚点。
4. 需要体检时用 `distilly doctor`（证据覆盖率 / 不可用渠道 / 锚点回指率 / computer-use 占比）。
5. 用户后来补的文字/截图，先 `distilly note --from <file|->` 登记（`method:"model-read"`）或 `distilly harvest` 入库，再引用。

---

## 2. 事实与候选

- **事实（fact）**：`knowledge/text/**` 里能指到具体锚点、且不改写原文的陈述。写法：`结论（knowledge/text/feishu.md [k0042]）`。
- **候选（candidate）**：派生文件里的模式、倾向、统计、跨语境推断；只有一两个锚点支撑的观察；用户没确认的标签。写法：`候选：……（锚点 [k0042]、[k0051]，样本 2 条）`。
- 候选永远不能升级为结论：可以写进分析草稿，但必须保留"候选"字样，并写清缺什么证据才能升级。
- 派生 JSON 里不存在的字段一律不得臆造（例如不要发明 `confidence`、`score` 之类的键）。只读文件里真实出现的字段；字段含义不明就写 `unknown` 并说明。
- 事实之间冲突时保留两条并标注冲突，不要私自选一个。

---

## 3. 锚点引用格式

- 段落锚点：`[k00NN]`（4 位补零，如 `[k0012]`）。
- 带轮次的锚点：`[k00NN:tM]`（如 `[k0012:t3]`，用于对话/多轮消息）。
- 引用时写 `文件 + 锚点`，例如：`knowledge/text/feishu.md [k0042]`、`knowledge/text/email.md [k0017:t3]`。
- 一条结论由多处支撑时列多个锚点，不要只挑一个：
  `……（knowledge/text/docs.md [k0008]；knowledge/text/messages.md [k0031:t2]）`。
- 引用的锚点必须能在 `knowledge/index.json` 回指；回指不上的锚点视为无效，必须删掉或改用有效锚点。
- 不允许自造锚点、不允许改锚点编号、不允许把平台首页/搜索页当成来源。

---

## 4. 样本不足时怎么写

- 没有证据：写 `unknown`，后面跟一句"缺什么材料可以补上"。
- 样本很少（1–2 条锚点）：写 `候选：……（样本 N 条，锚点 …）`，并说明它只在哪个语境出现。
- 某个维度整体薄：写 `（原材料不足）`，列出建议追加的材料类型（聊天记录 / 邮件 / 文档 / 长访谈）。
- celebrity 场景：总来源 < 10 条时按冷门人物协议处理——心智模型限制为 2–3 个，薄弱模型标"基于有限信息"，扩大诚实边界章节。
- 不要把"样本不足"写成"倾向于"：模糊表述比 `unknown` 更糟。

---

## 5. 汇报复述模板

开始写结论前，先给用户一段复述：

```
读了什么：
- knowledge/index.json：N 条来源（kind 分布：…），不可用渠道：…
- knowledge/text/*.md：F 个文件，共 R 段，A 个锚点
- evidence/derived/*.json：D 个文件（每条结论带锚点）

接下来写结论时：每条结论带 文件 + 锚点；无证据写 unknown；候选标注 candidate。
```

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 区分事实与候选，候选保留"候选"字样并写明升级所需证据。
5. 没有证据的结论写 `unknown`，并说明补什么材料。
6. 引用的锚点必须能在 `knowledge/index.json` 回指；发现坏锚点先停下报告。

## 禁止

1. 禁止无证据推断：常识、印象、模型记忆都不能当结论。
2. 禁止改写引文；引用原话必须逐字保留并附锚点。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；需要补来源时走 `distilly note --from <file|->` 或 `distilly harvest`。
5. 禁止把候选（candidate）当结论，也禁止臆造派生 JSON 字段。
6. 禁止用"倾向于""可能"这类模糊表述掩盖样本不足。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些维度样本不足、哪些步骤没跑、为什么。

---

## English

### Task

Define how the model reads `knowledge/text/*` and `evidence/derived/*`: read order, the fact/candidate split, anchor citation format, and how to phrase thin samples. The goal is that any third party can re-check every conclusion through its anchors.

### 1. Read order

1. `knowledge/index.json` (the ledger): first see which sources exist, with their `sha256`, `bytes`, `method`, `credentialed`, `warnings[]`. Anything without a ledger entry is not a source.
2. `knowledge/text/<source>.md` (normalized text): read paragraph by paragraph and note the paragraph anchors.
3. Run `distilly retrospect` first, then read `evidence/derived/*.json` (derived conclusions, each with evidence anchors). Never invert the order: reading derived files before re-running the command leaves conclusions without anchors.
4. For a health check use `distilly doctor` (evidence coverage / unavailable channels / anchor back-reference rate / computer-use share).
5. Text or screenshots the user adds later are registered with `distilly note --from <file|->` (`method:"model-read"`) or `distilly harvest` before being cited.

### 2. Facts and candidates

- **Fact**: a statement that points at a specific anchor in `knowledge/text/**` without rewriting the source. Form: `conclusion (knowledge/text/feishu.md [k0042])`.
- **Candidate**: patterns, tendencies, statistics, and cross-context inferences from derived files; observations backed by only one or two anchors; tags the user never confirmed. Form: `candidate: … (anchors [k0042], [k0051], sample 2)`.
- A candidate never becomes a conclusion: it may appear in a draft, but the word "candidate" stays, together with what evidence would promote it.
- Never invent fields that do not exist in the derived JSON (no made-up `confidence` or `score` keys). Read only fields that are really there; when a field is unclear, write `unknown` and say so.
- When two facts conflict, keep both and mark the conflict instead of silently picking one.

### 3. Anchor citation format

- Paragraph anchor: `[k00NN]` (4-digit zero-padded, e.g. `[k0012]`).
- Turn-aware anchor: `[k00NN:tM]` (e.g. `[k0012:t3]`, for conversations and multi-turn messages).
- Cite `file + anchor`, e.g. `knowledge/text/feishu.md [k0042]`, `knowledge/text/email.md [k0017:t3]`.
- When several places support one conclusion, list several anchors instead of cherry-picking one:
  `… (knowledge/text/docs.md [k0008]; knowledge/text/messages.md [k0031:t2])`.
- Every cited anchor must back-reference into `knowledge/index.json`; an anchor that does not resolve is invalid and must be dropped or replaced.
- Never invent anchors, renumber anchors, or treat platform roots and search pages as sources.

### 4. How to phrase thin samples

- No evidence: write `unknown`, followed by what material would supply it.
- Very few samples (1–2 anchors): write `candidate: … (sample N, anchors …)` and say which context it appears in.
- A whole dimension is thin: write `(insufficient source material)` and list the material types worth adding (chat logs / email / documents / long interviews).
- Celebrity case: below 10 total sources apply the cold-figure protocol — limit mental models to 2–3, mark thin models "based on limited information", and expand the honest boundaries section.
- Never turn "thin sample" into "tends to": vague wording is worse than `unknown`.

### 5. Restatement template

Before writing conclusions, restate to the user:

```
What was read:
- knowledge/index.json: N sources (kind breakdown: …); unavailable channels: …
- knowledge/text/*.md: F files, R rows, A anchors
- evidence/derived/*.json: D files (every conclusion carries anchors)

When writing conclusions: every conclusion carries file + anchor; no evidence means unknown; candidates stay labeled candidate.
```

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Keep facts and candidates apart; a candidate keeps the word "candidate" and states the evidence that would promote it.
5. Conclusions without evidence are written as `unknown`, together with the material that would fill them.
6. Every cited anchor must back-reference into `knowledge/index.json`; on a broken anchor, stop and report it.

### MUST NOT

1. No evidence-free inference: common sense, impressions, and model memory are not conclusions.
2. Never rewrite quotations; verbatim quotes keep their exact wording and carry an anchor.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; to add a source use `distilly note --from <file|->` or `distilly harvest`.
5. Never present a candidate as a conclusion, and never invent derived JSON fields.
6. Never hide a thin sample behind vague wording such as "tends to" or "may".

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which dimensions are thin, which steps were skipped, and why.
