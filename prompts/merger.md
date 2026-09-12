# 增量 Merge Prompt

## 任务

你将收到：
1. 现有的 `work.md` 内容
2. 现有的 `persona.md` 内容
3. 新的原材料内容（文件或消息）

你的任务是判断新内容应该更新哪个部分，并输出增量更新内容。

**原则：只追加增量，不覆盖已有结论。如有冲突，输出冲突提示让用户决定。**

---

## Step 1：分类判断

将新内容中的每条信息归类：

| 信息类型 | 归入 |
|---------|------|
| 技术规范、代码风格、接口设计、工作流程 | → work.md |
| 业务知识、系统职责、技术结论 | → work.md |
| 沟通风格、口头禅、表达习惯 | → persona.md |
| 决策行为、人际关系、情绪模式 | → persona.md |
| 两者都有 | → 分别归入 |

---

## Step 2：检查冲突

对比新内容与现有内容：

- 如果新内容**补充**了现有信息（增加了新细节）→ 直接追加
- 如果新内容**确认**了现有信息 → 忽略（不重复写）
- 如果新内容**与现有信息矛盾** → 输出冲突提示：

```
⚠️ 发现冲突：
- 现有：{现有描述}
- 新发现：{新内容描述}
- 来源：{文件名/时间}

建议：[保留现有 / 更新为新内容 / 两者都保留并标注时间]
请用户决定。
```

---

## Step 3：生成更新 Patch

对 `work.md` 的更新，输出格式：
```
=== work.md 更新 ===

[追加到"技术规范/命名规范"节]
- {新内容}

[追加到"经验知识库"节]
- {新知识结论}

[无更新] 或 [以上章节有更新]
```

对 `persona.md` 的更新，输出格式：
```
=== persona.md 更新 ===

[追加到"Layer 2/用词习惯"节]
- 新口头禅："{xxx}"

[追加到"Layer 4/对平级"节]
- {新行为描述}

[无更新] 或 [以上章节有更新]
```

---

## Step 4：生成更新摘要

向用户展示：
```
本次更新摘要：
- work.md：追加了 {N} 条新信息（{简要描述}）
- persona.md：追加了 {N} 条新信息（{简要描述}）
- 发现 {N} 处冲突，需要你确认（见上方）

版本将从 {vN} 升级到 {vN+1}。
确认应用更新？
```

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再判断增量归属。
2. 每条新增/冲突信息跟 `文件 + 锚点`，例如 `knowledge/text/messages.md [k0017:t3]`；旧结论保留原锚点。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 只追加增量、不覆盖已有结论；冲突必须输出冲突提示，等用户决定。
5. 更新走 `distilly skill update`（写入前先用 `distilly skill version` 存档），不手改最终文件。
6. 版本号只在用户确认后升级，并在摘要里写明从哪个版本到哪个版本。

## 禁止

1. 禁止无证据推断：新文件里没写的行为不能"顺便"补进 persona。
2. 禁止改写引文；新增的口头禅/原话必须逐字保留并附锚点。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当作已确认的增量。
6. 禁止静默覆盖或静默删除旧结论。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些冲突未决、哪些步骤没跑、为什么。

---

## English

### Task

Given the existing `work.md` and `persona.md` plus new material, decide which part each new item belongs to and emit an incremental patch. Principle: append only, never overwrite an existing conclusion; on conflict, surface the conflict and let the user decide.

### Output contract (abstract)

- Step 1 classify each item (work vs persona), Step 2 check for conflicts, Step 3 emit the `work.md` / `persona.md` patches, Step 4 show an update summary with the version bump.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then classify the delta.
2. Every new or conflicting item carries `file + anchor`, e.g. `knowledge/text/messages.md [k0017:t3]`; existing conclusions keep their original anchors.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Append delta only and never overwrite an existing conclusion; conflicts produce a conflict notice and wait for the user.
5. Apply updates with `distilly skill update` (archive with `distilly skill version` first); never hand-edit the final files.
6. Bump the version only after the user confirms, and state the from-version and to-version in the summary.

### MUST NOT

1. No evidence-free inference: behavior absent from the new material is never slipped into the persona.
2. Never rewrite quotations; new catchphrases and verbatim lines keep their exact wording and carry an anchor.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never treat a candidate as a confirmed delta.
6. Never silently overwrite or silently delete an existing conclusion.

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which conflicts are unresolved, which steps were skipped, and why.
