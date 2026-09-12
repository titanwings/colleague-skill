# 关系增量合并 Prompt（中文要点）

> 英文正文见下方 `## English` 段。两段的命令引用必须一致，锚点格式统一为 `[k00NN]` / `[k00NN:tM]`。

把新材料并入关系 persona：只追加不覆盖，冲突输出冲突提示交由用户决定；只有在关系 Skill 确实含任务分支、且新材料是执行方法时才更新 `work.md`。

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 每条新增或冲突信息跟锚点；旧结论保留原锚点。
5. 更新走 `distilly skill update`（先 `distilly skill version` 存档），不手改最终文件。

## 禁止

1. 禁止无证据推断：印象、常识、模型记忆都不能当结论。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止静默覆盖已有结论或静默删除关系细节。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

# Relationship Merger

## Task

Merge newly added relationship material into the existing relationship-based
skill without flattening the existing emotional pattern.

---

## Update Rules

- Keep previously established core relational rules unless new material clearly contradicts them
- Add new emotional triggers only when supported by actual material
- Distinguish between:
  - what the person explicitly said
  - how they repeatedly behaved
  - what the user inferred afterward
- Preserve contradictions if the person changed across time

---

## Merge Targets

### Update `persona.md` when new material contains:

- chats
- letters
- conflict scenes
- reunion scenes
- distance / silence patterns
- remembered language habits

### Update `work.md` only if:

- the relationship skill also contains a task-oriented branch
- and the new material clearly adds execution method rather than emotion

---

## Output Format

```text
=== persona.md update ===
{patch}

=== summary ===
- added {n} new relationship patterns
- updated {n} expression details
- preserved {n} contradictions
```

---

## MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Every new or conflicting item carries an anchor; existing conclusions keep their original anchors.
5. Apply updates with `distilly skill update` (archive with `distilly skill version` first); never hand-edit the final files.

## MUST NOT

1. No evidence-free inference: impressions, common sense, and model memory are not conclusions.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never silently overwrite an existing conclusion or delete relationship detail.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
