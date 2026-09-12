# dot-skill v2 · 提示词层契约（PROMPTS）

本文件规定 `prompts/**` 与 `SKILL.md` 的**提示词层**约定，以及 `scripts/prompt-lint.mjs` 实际检查的规则。命令名以 `docs/v2/CONTRACT.md` §1 的命令块为**唯一事实来源**（lint 直接解析该代码块，不另建命令清单，避免两处漂移）。

---

## 1. 文件清单与角色

| 文件 | 角色 |
|------|------|
| `SKILL.md` | 主线入口：五步 Collect → Derive → Read → Distill → Render，每步带完成判据 |
| `prompts/collectors.md` | 采集路由：什么时候用哪条命令、同意、失败行为、采集后读什么 |
| `prompts/retrospection.md` | 证据阅读：读取顺序、事实/候选、锚点格式、样本不足的表达 |
| `prompts/computer-use.md` | 浏览器采集的同意协议、白名单、上限、每屏落盘、中断 |
| `prompts/intake.md` | colleague / relationship 的 3 问录入 |
| `prompts/{persona,work}_{analyzer,builder}.md` | 分析与生成（colleague 主线共用） |
| `prompts/merger.md`、`prompts/correction_handler.md` | 进化模式：追加 / 纠正 |
| `prompts/celebrity/**` | 名人 family 的 intake / research / audit / synthesis / validation / analyzer / builder / merger |
| `prompts/relationship/**` | 关系 family 的 intake / analyzer / builder / merger |

---

## 2. 每个 prompt 必须有的三段（中英各一份）

每个 `prompts/**/*.md` 同时包含：

- 中文段：`## 必须`、`## 禁止`、`## 回执`
- 英文段（`## English` 之后）：`## MUST`、`## MUST NOT`、`## RECEIPT`

三段的内容基线：

- **必须**：先列"读了哪些文件、各多少条、多少锚点"，再写结论；每条结论带 `文件 + 锚点`；无证据写 `unknown`；先跑 `distilly retrospect` 再读 `evidence/derived/*`。
- **禁止**：无证据推断；改写引文；把 key 写进对话/文件；自己拼 API 请求；把候选当结论。
- **回执**：读过哪些文件；生成哪些文件与各自 sha256；哪些渠道不可用（`unavailable[]`）；哪些步骤没跑。

`SKILL.md` 同样带三段（中文 `## 必须 / ## 禁止 / ## 回执`，英文 `## MUST / ## MUST NOT / ## RECEIPT`），作为整个流程的收尾纪律。

---

## 3. 双语约定

- 单文件双语：中文段 → `---` → `## English`。
- 两段引用的 `distilly <cmd>` 命令名集合必须**完全一致**——只在中文段提到的新命令视为漏译，lint 报错。
- 现有英文 family prompt（`prompts/celebrity/**`、`prompts/relationship/**`）以英文正文为准，中文段提供任务摘要 + 三段；现有中文 core prompt 以中文正文为准，英文段提供任务摘要 + 三段。**整篇互译仍是已知缺口**（见 `docs/evidence/pr-04-prompts.md`）。

---

## 4. 锚点与来源

- 段落锚点：`[k00NN]`（4 位补零），轮次锚点：`[k00NN:tM]`。
- 文档里可以用 `[k00NN]` / `[k00NN:tM]` 作为格式模板。
- 任何"看起来像锚点但格式不对"的方括号写法（如 `[k12]`、`[K0012]`、`[k0012:t]`）都会被 lint 抓出来。
- 引用一律 `文件 + 锚点`；被引用的锚点必须能在 `knowledge/index.json` 回指（回指检查属于 `scripts/acceptance.mjs` 的门禁）。

---

## 5. lint 规则（`node scripts/prompt-lint.mjs`）

零依赖，扫描 `SKILL.md` 与 `prompts/**/*.md`，逐条输出 `文件:行号 规则 说明`，有发现即非零退出。

| 规则 | 检查 |
|------|------|
| `command` | 出现的 `distilly <cmd>` 必须在 `docs/v2/CONTRACT.md` §1 命令块里存在（命令块是唯一事实来源） |
| `sections` | 每个 prompt 与 `SKILL.md` 必须同时有中英三段（`必须/禁止/回执` 与 `MUST/MUST NOT/RECEIPT`） |
| `bilingual` | 必须有 `## English` 分隔段，且中英两段的命令名集合一致 |
| `anchor` | 锚点格式统一为 `[k00NN]` / `[k00NN:tM]`（含模板写法） |
| `forbidden` | 禁止命令行 HTTP 工具、Python HTTP 库用法、明文密钥赋值、`sk-` 形式的密钥前缀 |
| `deprecated` | 引用 `tools/**/*.py`（或 `.sh`）时，同一段内必须标 `deprecated` |

用法：

```bash
node scripts/prompt-lint.mjs                  # 默认扫描仓库根
node scripts/prompt-lint.mjs --root <dir>     # 扫描另一棵树（before/after 对比、测试夹具）
node scripts/prompt-lint.mjs --json           # 机器可读结果
```

关于 `forbidden` 的两点精度说明（避免误报）：

- `sk-` 只在"密钥形状"时报错（已知前缀如 `sk-proj-`，或 `sk-` 后跟 20 位以上字母数字），所以 `task-oriented` 这类普通英文词不会误报。
- Python HTTP 库只在**代码用法**时报错（`import requests` / `requests.get(` 等）；普通英文散文里的 "requests" 不算违规。

---

## 6. 迁移期与废弃写法

- 新写法：一切走 `distilly`。旧写法 `python3 tools/*.py` 迁移期内允许保留，但必须带 `deprecated` 标注，lint 会检查。
- 契约未覆盖的旧工具（`tools/research/merge_research.py`、`tools/research/download_subtitles.sh`）在 prompt 中显式标注为 deprecated + 已知缺口，Prompt 层不发明替代命令。

---

## 7. 给下游的接口

- **ds/05-agents（宿主适配）**：prompt 里出现的宿主命令只有 `distilly`；宿主只需要执行 `bin/distilly.mjs` 并把 `--json` 回执原样带给模型。prompt 引用的命令集合 = `collect / consent / doctor / harvest / install / note / parse-archive / parse-chat / parse-doc / parse-email / parse-subtitle / retrospect / skill / transcribe / uninstall / view`。
- **ds/06-retrospect（派生层）**：`prompts/retrospection.md` 规定读取顺序（`knowledge/index.json` → `knowledge/text/*.md` → `distilly retrospect` → `evidence/derived/*.json`）、锚点格式与"事实/候选"边界；`retrospect` 需要保证每条派生结论带 evidence 锚点、两次运行字节相同。
- **ds/01-node-core**：`bin/distilly.mjs` 需要实现 §1 全部子命令；prompt 层已按契约写好命令名，命令未落地时 lint 仍以 `CONTRACT.md` 为准（契约是冻结接口）。
