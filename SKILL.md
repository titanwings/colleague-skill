---
name: distilly
description: "Distill colleague, relationship, or celebrity source material into reusable Person Profiles for agents."
argument-hint: "[character] [name-or-slug]"
version: "1.0.0"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

> **Language / 语言**: This skill supports both English and Chinese. Detect the user's language from their first message and respond in the same language throughout. Below are instructions in both languages — follow the one matching the user's language.
>
> 本 Skill 支持中英文。根据用户第一条消息的语言，全程使用同一语言回复。下方提供了两种语言的指令，按用户语言选择对应版本执行。

> **Skill Root / Skill 根目录**: Before reading a bundled prompt or running a bundled command, resolve the absolute directory of the `SKILL.md` that the host actually loaded. In the instructions below, `{distilly_skill_root}` means that exact directory. Claude Code exposes it as `${CLAUDE_SKILL_DIR}`; on every other host, use the loaded-skill path supplied by that host's discovery context. Do not assume the shell's current working directory is the Skill root, and do not guess or hard-code an install path. If the host does not expose the loaded path or more than one Distilly installation is ambiguous, ask the user to identify the active installation before running code.
>
> Keep the shell in the user's current workspace so relative output paths such as `./skills/...` remain project-local. Resolve every `prompts/...` resource against `{distilly_skill_root}`. The only supported entrypoint is the `distilly` CLI; do not call the bundled Python tools directly (they are deprecated, see the migration table below).
>
> 在读取内置 prompt 或执行内置命令前，先取得宿主实际加载的这份 `SKILL.md` 所在绝对目录；下文以 `{distilly_skill_root}` 表示。Claude Code 可用 `${CLAUDE_SKILL_DIR}`，其他宿主使用其 Skill discovery 上下文提供的实际路径。不要假定 shell 当前目录就是 Skill 目录，也不要猜测或硬编码安装路径。shell 应继续停留在用户工作区，使 `./skills/...` 等输出仍写入当前项目；所有 `prompts/...` 都必须从 `{distilly_skill_root}` 解析。唯一受支持的入口是 `distilly` CLI，不要直接调用仓库里的 Python 工具（它们已废弃，见下方迁移对照表）。

# Distilly 创建器

> Distilly 原名 **Colleague Skill / colleague-skill（原同事 Skill）**。当前 Skill frontmatter 名称和创建器入口均为 `distilly`。

## 触发条件

当用户说以下任意内容时启动：
- `/distilly`
- "帮我创建一个 skill"
- "我想蒸馏一个人"
- "新建一个 skill"
- "给我做一个 XX 的 skill"

兼容宿主：
- Claude Code
- OpenClaw
- Hermes
- Codex
- DeepSeek Harness
- Pi coding agent
- Grok Build
- OpenCode

有显式调用语法的宿主各不相同：Claude Code、Hermes、DeepSeek Harness 和 Grok Build 用 `/distilly`；OpenClaw 优先用 `/distilly`，未注册 native slash 时用 `/skill distilly`；Codex 用 `$distilly` 或通过 `/skills` 选择；Pi 用 `/skill:distilly`。OpenCode 使用原生 Skill 发现与加载，不要臆造专用命令。

Grok Bot 可以把流程保存为 private Skill，但目前没有官方的本地 `SKILL.md` 目录导入方式。不要把本仓库描述为可直接安装到 Grok Bot；需要手工迁移为 saved Skill 或等待专用 adapter。

当用户对已有 Skill 说以下内容时，进入进化模式：
- "我有新文件" / "追加"
- "这不对" / "他不会这样" / "他应该是"
- `/update-skill {character} {slug}`

兼容更新别名：
- `/update-colleague {slug}`

当用户要求查看已生成的 Skill 时，执行下方"管理操作"里的列出命令。

---

## 命令契约（唯一入口）

所有采集、派生、渲染都走 `distilly`。命令名与 `docs/v2/CONTRACT.md` §1 的命令表逐字一致；不要发明子命令或字段。

| 任务 | 命令 |
|------|------|
| 零凭据：目录/文件 → `knowledge/` | `distilly harvest <dir\|file>` |
| 解析 ChatGPT / Claude / Slack / Telegram / Discord 导出 | `distilly parse-chat <export.json>` |
| 解析邮件 | `distilly parse-email <x.eml\|.mbox>` |
| 解析字幕 | `distilly parse-subtitle <x.srt\|.vtt>` |
| 解析文档 | `distilly parse-doc <x.docx\|xlsx\|pdf>` |
| 解析归档（X 官方归档 / Takeout / 社交平台导出） | `distilly parse-archive <x.zip\|dir>` |
| 纯派生 → `evidence/derived/*.json` | `distilly retrospect` |
| 需要 key / OAuth 的渠道采集 | `distilly collect <feishu\|slack\|dingtalk\|x\|discord\|reddit\|notion\|gmail>` |
| 浏览器 computer use（必须带同意 token） | `distilly collect x --mode browser --consent <token>` |
| 音视频转写（可选后端） | `distilly transcribe <audio\|video>` |
| 把 LLM 自己读到的内容登记进账本 | `distilly note --from <file\|->` |
| 同意授权管理 | `distilly consent <grant\|list\|revoke>` |
| 视图检查与渲染 | `distilly view check`；`distilly view render [--shareable]` |
| 证据体检 | `distilly doctor` |
| 生成 Skill 的创建/更新/列出/版本 | `distilly skill <create\|update\|list\|version>` |
| 宿主安装 | `distilly install <host>`；`distilly uninstall` |

- 所有子命令支持 `--json` 回执；`--help` 有中文/英文两段。
- 需要 key / OAuth 的渠道：先向用户说明将读取哪个渠道、可拿到什么，拿到同意后才运行 `distilly collect`。
- computer-use 类命令必须带 `--consent <token>`；没有 token 时命令以 `exit 2` 结束并在回执里写"等待用户同意"。
- 密钥只从 `~/.distilly/*_config.json` 或环境变量读取；回执、日志、对话里只出现配置文件名，永不出现值。

### 迁移对照表（旧写法一律 deprecated）

| 旧写法（deprecated） | 新写法 |
|----------------------|--------|
| `tools/feishu_parser.py`（deprecated） | `distilly parse-chat` |
| `tools/feishu_auto_collector.py`（deprecated） | `distilly collect feishu` |
| `tools/feishu_browser.py`（deprecated） | `distilly collect feishu --mode browser --consent <token>` |
| `tools/feishu_mcp_client.py`（deprecated） | `distilly collect feishu` |
| `tools/dingtalk_auto_collector.py`（deprecated） | `distilly collect dingtalk` |
| `tools/email_parser.py`（deprecated） | `distilly parse-email` |
| `tools/research/xquik_public_posts.py`（deprecated） | `distilly collect x` |
| `tools/research/transcribe_audio.py`（deprecated） | `distilly transcribe` |
| `tools/research/srt_to_transcript.py`（deprecated） | `distilly parse-subtitle` |
| `tools/skill_writer.py`（deprecated） | `distilly skill create` / `distilly skill update` / `distilly skill list` |
| `tools/version_manager.py`（deprecated） | `distilly skill version` |
| `tools/install_generated_skill.py`（deprecated） | `distilly install <host>` |
| `tools/research/quality_check.py`（deprecated） | `distilly doctor`（实现归属派生层 `src/derive/quality.mjs`，ds/06） |
| `tools/research/merge_research.py`（deprecated） | `distilly retrospect`（研究笔记合并并入派生层 `src/derive/merge.mjs`，ds/02；合并后的输出仍走 `evidence/derived/*.json`） |
| `tools/research/download_subtitles.sh`（deprecated） | 暂无契约替代：先让用户提供本地字幕文件，再走 `distilly parse-subtitle` |

迁移期允许两者并存，但新写法优先；只要 Python 工具还在被引用，就必须保留 `deprecated` 标注。

---

## 磁盘契约（LLM 只能写这些）

```
skills/<family>/<slug>/
  SKILL.md work.md persona.md work_skill.md persona_skill.md manifest.json meta.json
  knowledge/{docs,messages,emails}/
  knowledge/raw/<source>/...      # 原样字节，只增不改
  knowledge/text/<source>.md      # 归一化正文，段落锚点 [k0012] / [k0012:t3]
  knowledge/index.json            # 账本 {id,kind,origin,fetched_at,bytes,sha256,credentialed,method,warnings[]}
  evidence/derived/*.json         # retrospect 派生，每条结论带 evidence 锚点
  views/<slug>.view.json          # LLM 只写章节/顺序/强调（不含事实）
  views/<slug>.html               # render 产物：单文件、离线、双主题
  evidence/renders/receipt.json   # render 回执（sha256 + 字节数 + 内联来源）
```

- LLM 可以写：`views/<slug>.view.json`（只写章节、顺序、强调）、临时工作文件、以及通过 `distilly note --from <file|->` 登记的"model-read"来源。
- LLM 不可以写：`knowledge/raw/**`（原样字节，只增不改）、`knowledge/index.json`、`evidence/derived/*.json`（由 `distilly retrospect` 生成）、`evidence/renders/receipt.json`。
- 截图、回执图、diff 图不入库（`.gitignore` 已含 `dst-evidence/`）；本地产物放 `/tmp/dst-evidence/<pr>/`。
- 锚点格式统一为 `[k00NN]`（4 位补零）或 `[k00NN:tM]`（带轮次）。任何结论必须带 `文件 + 锚点`，没有证据就写 `unknown`。

---

## 五步主线

创建、追加、纠正都走同一条主线：**Collect → Derive → Read → Distill → Render**。

| 步骤 | 必须存在的产物 | 计数判据 | sha256 从哪来 | 失败怎么办 |
|------|----------------|----------|---------------|------------|
| 1 Collect | `knowledge/raw/<source>/**`、`knowledge/text/<source>.md`、`knowledge/index.json` | 每个落地来源 1 条账本条目；每个 text 文件 ≥1 个锚点 | `distilly <cmd> --json` 回执的 `outputs[].sha256`，与 `knowledge/index.json` 的 `sha256` 逐字节一致 | 非零退出：记录命令、stderr、补救步骤；0 条落地来源时停下，不得进入 Derive |
| 2 Derive | `evidence/derived/*.json` | 每条派生结论带 evidence 锚点；连跑两次字节相同 | 回执 `outputs[].sha256`；两次运行 sha256 相同 | 非零退出：先修 `knowledge/index.json` 完整性；不得手写派生 JSON |
| 3 Read | 无新文件，产出"读了什么"的复述 | 按文件列出：文件 → 条数 → 锚点数 | 引用 `knowledge/index.json` 的 `sha256`，不自算 | 文件缺失或锚点为 0：回到 Step 1 补齐，不得凭记忆写结论 |
| 4 Distill | `work.md`、`persona.md`，celebrity 另有 research/audit/synthesis/validation | 每个维度有锚点或 `unknown`；celebrity 有明确 `PASS/FAIL` | 引用被引用的来源 sha256（来自账本） | 证据不足：标 `（原材料不足）` / candidate，并说明需要补什么材料 |
| 5 Render | `views/<slug>.view.json`、`views/<slug>.html`、`evidence/renders/receipt.json` | 回执 sha256 与 html 实际 sha256 一致；`distilly doctor` 锚点回指率可查 | `evidence/renders/receipt.json` 的 sha256 | 渲染失败：保留 view.json，不发布，报告错误 |

任何一步的失败都不允许"静默降级"：要么修好，要么把失败写进对用户的汇报和回执的 `warnings[]` / `unavailable[]`。

### Step 1：Collect（采集）

1. 先读 `prompts/collectors.md`，按"什么时候用哪条命令"选路。
2. 零凭据来源（本地文件、导出包、字幕、文档、归档）直接走 `distilly harvest`、`distilly parse-chat`、`distilly parse-email`、`distilly parse-subtitle`、`distilly parse-doc`、`distilly parse-archive`。
3. 需要 key / OAuth 的渠道（飞书、Slack、钉钉、X、Discord、Reddit、Notion、Gmail）先征求用户同意，再走 `distilly collect <channel>`；同意范围用 `distilly consent <grant|list|revoke>` 管理。
4. 浏览器 computer use 必须按 `prompts/computer-use.md` 执行：先问再动、只读白名单、默认 ≤20 屏 / ≤10 分钟 / 每分钟 ≤6 次滚动、每屏落盘原文 + URL + 时间 + 截图（截图只放本地）、可中断；`distilly collect x --mode browser --consent <token>` 没有 token 就直接退出，不要绕过。
5. 用户只能"贴文字/截图"时，用 `distilly note --from <file|->` 登记来源（`method:"model-read"`），不要假装它是采集来的。
6. 音视频先 `distilly transcribe`，再解析字幕；不要把整段 transcript 抄进仓库。

**完成判据**：`knowledge/index.json` 里每个落地来源一条账本条目（含 `id`、`kind`、`origin`、`fetched_at`、`bytes`、`sha256`、`credentialed`、`method`、`warnings[]`）；每个 `knowledge/text/<source>.md` 至少 1 个锚点；回执 `inputs[]`/`outputs[]` 的 sha256 与账本一致；不可用渠道进 `unavailable[]`。
**失败怎么办**：命令非零退出时，把命令原文、stderr、补救步骤（例如缺凭据要配置哪个 `~/.distilly/*_config.json`）告诉用户，然后停下等指示；如果 0 条来源落地，不要进入 Step 2。

### Step 2：Derive（派生）

1. 派生之前不要读 `evidence/derived/*`——先跑 `distilly retrospect`。
2. `distilly retrospect` 只做纯派生：输入是 `knowledge/**`，输出是 `evidence/derived/*.json`，每条结论带 evidence 锚点。
3. 为验证确定性，连跑两次；同一输入两次的 sha256 必须相同。

**完成判据**：`evidence/derived/*.json` 存在；回执给出 `anchors.total` / `anchors.cited`；两次运行 `outputs[].sha256` 相同。
**失败怎么办**：非零退出说明输入侧有问题——回到 Step 1 检查账本与 text 锚点；绝不手写、手改派生 JSON 来"跑通"。

### Step 3：Read（阅读）

1. 读的顺序：`knowledge/index.json` → `knowledge/text/*.md` → `evidence/derived/*.json`。
2. 先向用户复述"读了哪些文件、各多少条、多少锚点"，再写结论。
3. 每条结论后面跟 `文件 + 锚点`（例如 `knowledge/text/feishu.md [k0042]`）。
4. 找不到证据的结论写 `unknown`，并说明缺什么材料可以补上。
5. 事实与候选分开：有具体锚点支撑的才算事实；派生文件里的模式、倾向、推断一律按候选处理，候选不能升级为结论。
6. 全文细节规范见 `prompts/retrospection.md`。

**完成判据**：复述清单里的每个文件都能在账本里回指；被引用的锚点都真实存在于 `knowledge/text/**`；没有无锚点的结论。
**失败怎么办**：文件缺失或锚点为 0 时回到 Step 1 补齐；不要凭记忆或常识补写内容。

### Step 4：Distill（蒸馏）

先用第 0 步确认的 family 解析执行矩阵：

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompts/intake.md` | `prompts/persona_analyzer.md` | `prompts/persona_builder.md` | `prompts/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompts/relationship/intake.md` | `prompts/relationship/persona_analyzer.md` | `prompts/relationship/persona_builder.md` | `prompts/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompts/celebrity/intake.md` | `prompts/celebrity/persona_analyzer.md` | `prompts/celebrity/persona_builder.md` | `prompts/celebrity/merger.md` | `./skills/celebrity/{slug}` |

所有 family 共用：Work analyzer `prompts/work_analyzer.md`、Work builder `prompts/work_builder.md`、Correction handler `prompts/correction_handler.md`。

两条线：

- **线路 A（Work Skill）**：参考 `prompts/work_analyzer.md`，提取负责系统、技术规范、工作流程、输出偏好、经验知识；celebrity 场景下 `work` 更偏方法论、判断框架、决策习惯。
- **线路 B（Persona）**：用当前 family 的 persona analyzer；`celebrity` + `research_profile=budget-unfriendly` 时改用 `prompts/celebrity/budget_unfriendly/persona_analyzer.md`。把用户填的标签翻译为具体行为规则，并从材料里提取表达风格、决策模式、人际行为。

写文件时不要手工拼 `skills/{family}/{slug}` 文件树，统一走 writer：把 `meta.json` / `work.md` / `persona.md` 写到临时文件，再调 `distilly skill create`（或 `distilly skill update`）。人物 Skill 的安装走 `distilly install <host>`。

**完成判据**：每个维度都有锚点或明确的 `（原材料不足）`；每条行为规则具体可执行；celebrity 的 audit / validation 给出明确 `PASS` 或 `FAIL`；`distilly doctor` 能报告证据覆盖率、不可用渠道、锚点回指率。celebrity 场景下的 research 门槛见下方子流程。
**失败怎么办**：证据不足的维度标 `（原材料不足，建议追加相关文档）` 并降级为 candidate；`source_grounding` 不达标时保留 `FAIL` 并说明还缺什么，绝不用泛化链接刷过检查。

### Step 5：Render（渲染）

1. 先 `distilly view check`，确认锚点都能回指到 `knowledge/index.json`。
2. 写 `views/<slug>.view.json`：只写章节、顺序、强调，不写事实。
3. `distilly view render` 生成单文件、离线、双主题的 `views/<slug>.html`，并写 `evidence/renders/receipt.json`（sha256 + 字节数 + 内联来源）。
4. 对外分享时才用 `distilly view render --shareable`，并先让用户确认。
5. 用 `distilly doctor` 复核证据覆盖率、不可用渠道、锚点回指率、computer-use 占比。

**完成判据**：`views/<slug>.html` 与 `evidence/renders/receipt.json` 同时存在；回执 sha256 与 html 实际 sha256 一致；内部链接 0 坏链。
**失败怎么办**：渲染失败时保留 `views/<slug>.view.json`，不发布 HTML，把错误与缺失来源报告给用户。

### 第 0 步（前置）：确认 family 与 intake

如果用户使用的是 `/distilly`，先确认本次要蒸馏的是哪一类：

1. `colleague`
2. `relationship`
3. `celebrity`

如果上层宿主已经显式把 family 传进来，则直接固定对应的 character family。

如果当前 family 是 `celebrity`，还必须确认 research profile：

1. `budget-friendly`
2. `budget-unfriendly`

默认使用 `budget-friendly`。只有当用户明确要求更深研究、更高置信度、或者愿意接受更慢更贵的蒸馏流程时，才切到 `budget-unfriendly`。

根据 family 选择 intake prompt：`colleague` → `prompts/intake.md`；`relationship` → `prompts/relationship/intake.md`；`celebrity` → `prompts/celebrity/intake.md`。`colleague` 和 `relationship` 只问 3 个问题；`celebrity` 问 4 个问题，其中第 4 个必须确认 `research_profile`。

默认的 3 个基础问题：

1. **花名/代号**（必填）
2. **基本信息**（一句话：公司、职级、职位、性别，想到什么写什么）
   - 示例：`字节 2-1 后端工程师 男`
3. **性格画像**（一句话：MBTI、星座、个性标签、企业文化、印象）
   - 示例：`INTJ 摩羯座 甩锅高手 字节范 CR很严格但从来不解释原因`

除姓名外均可跳过。收集完后汇总确认，再进入 Collect。

---

## celebrity research 子流程（在 Step 2/3 之间）

### budget-friendly

1. 读 `prompts/celebrity/research.md`，按其中的 **6 维度并行采集策略** 做 research planning。
2. 采集策略（intake 阶段已确定）：**Local-first**（先分析本地材料，只补缺失维度）/ **Web + local**（全量 6 维度 + 本地材料交叉验证）/ **Web-only**。
3. 需要视频/播客时：先 `distilly transcribe <audio|video>`，字幕走 `distilly parse-subtitle`；不要把完整 transcript 落进仓库。
4. 原始 research 笔记**至少**拆成 3 个文件（每个覆盖 2 个维度），不能只写一个 `research_notes.md`：
   - `knowledge/research/raw/01_core_profile.md`（维度 1 著作 + 维度 6 时间线）
   - `knowledge/research/raw/02_conversations_and_material.md`（维度 2 对话 + 维度 4 决策）
   - `knowledge/research/raw/03_expression_and_reception.md`（维度 3 表达 DNA + 维度 5 他者视角）
5. 品味原则：长文 > 金句，争议 > 共识，变化 > 固定，一手 > 二手。信源黑名单：永不引用知乎、微信公众号、百度百科、内容农场。信源优先级：用户本地材料 > 一手著作 > 长访谈 > 决策记录 > 社交媒体 > 外部分析 > 二手转述。
6. 合并研究笔记后确认 `Files scanned >= 3`、`Unique URLs >= 2`、`Potential long quote lines = 0`；notes 里的 URL 必须是实际打开过的具体页面，不是平台首页、搜索页、话题页或占位路径。
7. **质量关卡（Phase 1.5）**：进入分析前向用户展示结构化采集摘要（6 维度来源数 + 关键发现 + 矛盾点 + 薄弱维度 + 冷门人物判定），等用户确认再继续。
8. **冷门人物检测**：总来源 < 10 条时，心智模型限制为 2–3 个，薄弱模型标"基于有限信息"，扩大诚实边界章节，并告诉用户补什么材料能改善质量。
9. 分析输入优先使用：一手材料（信源权重 1-3）> 合并后的 research summary > 用户补充描述。

### budget-unfriendly

1. 先读 `prompts/celebrity/budget_unfriendly/research.md` 和 `references/celebrity_budget_unfriendly_framework.md`。
2. 按 **6-track 独立文件结构** 写 research notes（不可合并、不可克隆观察）：`01_writings.md` / `02_conversations.md` / `03_expression_dna.md` / `04_decisions.md` / `05_external_views.md` / `06_timeline.md`。
3. 每条 evidence 必须标注 source weight (1-7)；遵守品味原则 + 信源黑名单 + 信源优先级。
4. 最低门槛：`Files scanned >= 6`、`Unique URLs >= 8`、`Primary-source markers >= 3`、`Source metadata blocks >= 6`、`Contradiction bullets >= 6`、`Inference bullets >= 6`、`Potential long quote lines = 0`、`Track coverage count = 6`。不满足就补对应 track，不要跳到 review。
5. 依次生成 `knowledge/research/reviews/research_audit.md`（明确 `PASS/FAIL`，检查信源层级、primary 比例 > 50%、品味原则、冷门人物）→ `synthesis.md`（triple gate：cross-context recurrence / generative power / exclusivity；提取智识谱系种子与 Agentic Protocol 种子）→ 按 `prompts/celebrity/budget_unfriendly/validation.md` 生成 `validation.md`（known-answer ≥2 题 + edge-case 1 题 + voice check 100 字盲测 + copyright check + Agentic Protocol check，明确 `PASS/FAIL`）。
6. 任何 `FAIL` 都先补材料再继续；不要为了通过检查编造 URL、引用、书名或视频标题。

---

## 进化模式：追加文件

用户提供新文件或文本时：

1. 按 Step 1 的 Collect 流程采集新内容（本地文件走 `distilly harvest`，导出走 `distilly parse-chat`，粘贴走 `distilly note --from -`）。
2. 跑 `distilly retrospect` 刷新派生，再按 Step 3 复述"读了什么、多少条、多少锚点"。
3. 根据当前 family 解析 base dir，读取现有 `{resolved_base_dir}/{slug}/work.md` 和 `persona.md`。
4. 使用当前 family 对应的 merger prompt 分析增量内容。
5. 用 `distilly skill version` 存档当前版本。
6. 把 work/persona 增量分别写到临时 patch 文件，再走 `distilly skill update`。
7. 如果当前是 `celebrity`，更新后用 `distilly doctor` 复核证据覆盖率。

---

## 进化模式：对话纠正

用户表达"不对"/"应该是"时：

1. 参考 `prompts/correction_handler.md` 识别纠正内容。
2. 判断属于 Work（技术/流程）还是 Persona（性格/沟通）。
3. 如果属于 Work：生成可替换 `##` section 的 patch 临时文件，走 `distilly skill update`，不要直接手改 `work.md`。
4. 如果属于 Persona：把 correction 写成 `{scene, wrong, correct}`（多条写成 `{"persona_corrections": [...]}`）的临时 JSON，走 `distilly skill update`。
5. 纠正若与现有结论冲突，先向用户展示冲突再决定；纠正内容本身也要带锚点或标注为"用户口述，无锚点"。
6. 如果当前是 `celebrity`，更新后用 `distilly doctor` 复核。

---

## 管理操作

列出三类 Skill：

```bash
distilly skill list
```

回滚某个 Skill 版本：

```bash
distilly skill version
```

删除某个 Skill（确认 character 后）：

```bash
rm -rf skills/colleague/{slug}
rm -rf skills/relationship/{slug}
rm -rf skills/celebrity/{slug}
```

宿主安装：`distilly install <host>`；卸载：`distilly uninstall`。

列出与撤销已授予的同意：

```bash
distilly consent list
distilly consent revoke
```

---

## 必须

- 先列"读了哪些文件、各多少条、多少锚点"，再写结论；每条结论带 `文件 + 锚点`。
- 无证据写 `unknown`；候选不当结论。
- 每一步都按"五步主线"的完成判据检查产物，再进入下一步。

## 禁止

- 不改写引文，不伪造 URL、锚点、书名、视频标题，不用平台首页刷来源。
- 密钥只从 `~/.distilly/*_config.json` 或环境变量读，永不写进对话、文件、回执或日志。
- 不自己拼平台 API 请求：所有网络采集都通过 `distilly collect` / `distilly harvest` / `distilly parse-chat` / `distilly parse-email` / `distilly parse-subtitle` / `distilly parse-doc` / `distilly parse-archive` / `distilly transcribe`。
- 不静默降级：失败、不可用渠道、没跑的步骤都要说清楚。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执、`knowledge/index.json` 或 `evidence/renders/receipt.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---
---

## English

# Distilly Creator

> Distilly was formerly **Colleague Skill / colleague-skill**. The current Skill frontmatter name and creator entrypoint are both `distilly`.

## Trigger Conditions

Activate when the user says any of the following:
- `/distilly`
- "Help me create a skill"
- "I want to distill someone"
- "Create a new skill"
- "Make a skill for XX"

Compatible hosts:
- Claude Code
- OpenClaw
- Hermes
- Codex
- DeepSeek Harness
- Pi coding agent
- Grok Build
- OpenCode

Explicit invocation differs among hosts that expose it: use `/distilly` in Claude Code, Hermes, DeepSeek Harness, and Grok Build; use `/distilly` in OpenClaw, or `/skill distilly` when its native slash is not registered; use `$distilly` or choose it through `/skills` in Codex; use `/skill:distilly` in Pi. OpenCode uses native Skill discovery and loading; do not invent a dedicated command.

Grok Bot can save a workflow as a private Skill, but its official documentation does not describe direct local `SKILL.md` directory imports. Do not present this repository as a direct Grok Bot install; migrate the workflow manually into a saved Skill or wait for a dedicated adapter.

Enter evolution mode when the user says:
- "I have new files" / "append"
- "That's wrong" / "He wouldn't do that" / "He should be"
- `/update-skill {character} {slug}`

Compatibility update alias:
- `/update-colleague {slug}`

When the user asks to see generated skills, use the list command in "Management Operations" below.

---

## Command Contract (single entrypoint)

Every collection, derivation, and render step goes through `distilly`. Command names match the command table in `docs/v2/CONTRACT.md` §1 word for word; do not invent subcommands or fields.

| Task | Command |
|------|---------|
| Zero-credential: directory/file → `knowledge/` | `distilly harvest <dir\|file>` |
| Parse ChatGPT / Claude / Slack / Telegram / Discord exports | `distilly parse-chat <export.json>` |
| Parse email | `distilly parse-email <x.eml\|.mbox>` |
| Parse subtitles | `distilly parse-subtitle <x.srt\|.vtt>` |
| Parse documents | `distilly parse-doc <x.docx\|xlsx\|pdf>` |
| Parse archives (X archive / Takeout / social exports) | `distilly parse-archive <x.zip\|dir>` |
| Pure derivation → `evidence/derived/*.json` | `distilly retrospect` |
| Collection on channels needing key / OAuth | `distilly collect <feishu\|slack\|dingtalk\|x\|discord\|reddit\|notion\|gmail>` |
| Browser computer use (consent token required) | `distilly collect x --mode browser --consent <token>` |
| Audio/video transcription (optional backend) | `distilly transcribe <audio\|video>` |
| Register what the model itself read | `distilly note --from <file\|->` |
| Consent management | `distilly consent <grant\|list\|revoke>` |
| View check and render | `distilly view check`; `distilly view render [--shareable]` |
| Evidence health check | `distilly doctor` |
| Create/update/list/version a generated Skill | `distilly skill <create\|update\|list\|version>` |
| Host install | `distilly install <host>`; `distilly uninstall` |

- Every subcommand supports a `--json` receipt; `--help` has a Chinese and an English section.
- For channels needing a key or OAuth: first tell the user which channel will be read and what it yields, and only run `distilly collect` after they agree.
- Computer-use commands require `--consent <token>`; without a token the command ends with `exit 2` and its receipt says it is waiting for user consent.
- Credentials are read only from `~/.distilly/*_config.json` or environment variables; receipts, logs, and chat only ever contain the config file name, never a value.

### Migration table (all legacy forms are deprecated)

| Legacy form (deprecated) | New form |
|--------------------------|----------|
| `tools/feishu_parser.py` (deprecated) | `distilly parse-chat` |
| `tools/feishu_auto_collector.py` (deprecated) | `distilly collect feishu` |
| `tools/feishu_browser.py` (deprecated) | `distilly collect feishu --mode browser --consent <token>` |
| `tools/feishu_mcp_client.py` (deprecated) | `distilly collect feishu` |
| `tools/dingtalk_auto_collector.py` (deprecated) | `distilly collect dingtalk` |
| `tools/email_parser.py` (deprecated) | `distilly parse-email` |
| `tools/research/xquik_public_posts.py` (deprecated) | `distilly collect x` |
| `tools/research/transcribe_audio.py` (deprecated) | `distilly transcribe` |
| `tools/research/srt_to_transcript.py` (deprecated) | `distilly parse-subtitle` |
| `tools/skill_writer.py` (deprecated) | `distilly skill create` / `distilly skill update` / `distilly skill list` |
| `tools/version_manager.py` (deprecated) | `distilly skill version` |
| `tools/install_generated_skill.py` (deprecated) | `distilly install <host>` |
| `tools/research/quality_check.py` (deprecated) | `distilly doctor` (implementation owner: derive layer `src/derive/quality.mjs`, ds/06) |
| `tools/research/merge_research.py` (deprecated) | `distilly retrospect` (research-note merging folds into the derive layer `src/derive/merge.mjs`, ds/02; its output still lands as `evidence/derived/*.json`) |
| `tools/research/download_subtitles.sh` (deprecated) | No contract replacement yet: ask the user for a local subtitle file, then use `distilly parse-subtitle` |

Both forms may coexist during migration, but the new form wins; whenever a Python tool is still referenced, keep the `deprecated` marker.

---

## Disk Contract (what the model may write)

```
skills/<family>/<slug>/
  SKILL.md work.md persona.md work_skill.md persona_skill.md manifest.json meta.json
  knowledge/{docs,messages,emails}/
  knowledge/raw/<source>/...      # raw bytes, append-only
  knowledge/text/<source>.md      # normalized text, paragraph anchors [k0012] / [k0012:t3]
  knowledge/index.json            # ledger {id,kind,origin,fetched_at,bytes,sha256,credentialed,method,warnings[]}
  evidence/derived/*.json         # retrospect output, every conclusion carries evidence anchors
  views/<slug>.view.json          # the model writes only sections/order/emphasis (no facts)
  views/<slug>.html               # render output: single file, offline, dual theme
  evidence/renders/receipt.json   # render receipt (sha256 + bytes + inlined sources)
```

- The model may write: `views/<slug>.view.json` (sections, order, emphasis only), temporary working files, and sources registered through `distilly note --from <file|->` with `method:"model-read"`.
- The model must not write: `knowledge/raw/**` (raw bytes, append-only), `knowledge/index.json`, `evidence/derived/*.json` (produced by `distilly retrospect`), `evidence/renders/receipt.json`.
- Screenshots, receipts, and diff images are never committed (`.gitignore` already covers `dst-evidence/`); local artifacts live in `/tmp/dst-evidence/<pr>/`.
- Anchor format is always `[k00NN]` (4-digit zero-padded) or `[k00NN:tM]` (with turn index). Every conclusion carries `file + anchor`; with no evidence, write `unknown`.

---

## Five-Step Mainline

Creation, append, and correction all follow one mainline: **Collect → Derive → Read → Distill → Render**.

| Step | Required artifacts | Count criteria | Where sha256 comes from | What to do on failure |
|------|--------------------|----------------|-------------------------|-----------------------|
| 1 Collect | `knowledge/raw/<source>/**`, `knowledge/text/<source>.md`, `knowledge/index.json` | 1 ledger entry per grounded source; ≥1 anchor in every text file | `outputs[].sha256` of the `distilly <cmd> --json` receipt, byte-identical to `sha256` in `knowledge/index.json` | Non-zero exit: record command, stderr, remedy; with 0 grounded sources stop and do not enter Derive |
| 2 Derive | `evidence/derived/*.json` | Every derived conclusion carries evidence anchors; two runs are byte-identical | Receipt `outputs[].sha256`; identical sha256 across two runs | Non-zero exit: first repair `knowledge/index.json` integrity; never hand-write derived JSON |
| 3 Read | No new files; produce a restatement of what was read | Per file: file → rows → anchors | Quote `sha256` from `knowledge/index.json`; never compute your own | Missing files or zero anchors: go back to Step 1; never write conclusions from memory |
| 4 Distill | `work.md`, `persona.md`, plus celebrity research/audit/synthesis/validation | Every dimension has anchors or `unknown`; celebrity has an explicit `PASS/FAIL` | Quote the sha256 of cited sources from the ledger | Thin evidence: mark `(insufficient source material)` / candidate and say what material is missing |
| 5 Render | `views/<slug>.view.json`, `views/<slug>.html`, `evidence/renders/receipt.json` | Receipt sha256 matches the actual html sha256; `distilly doctor` reports the anchor back-reference rate | sha256 in `evidence/renders/receipt.json` | Render failure: keep view.json, do not publish, report the error |

No step may degrade silently: either fix it, or state the failure in the user-facing report and in the receipt's `warnings[]` / `unavailable[]`.

### Step 1: Collect

1. Read `prompts/collectors.md` first and pick the route from its "which command when" table.
2. Zero-credential sources (local files, export bundles, subtitles, documents, archives) go straight to `distilly harvest`, `distilly parse-chat`, `distilly parse-email`, `distilly parse-subtitle`, `distilly parse-doc`, `distilly parse-archive`.
3. Channels needing a key or OAuth (Feishu, Slack, DingTalk, X, Discord, Reddit, Notion, Gmail) require the user's consent first, then `distilly collect <channel>`; manage consent scope with `distilly consent <grant|list|revoke>`.
4. Browser computer use must follow `prompts/computer-use.md`: ask before acting, read-only whitelist, default ≤20 screens / ≤10 minutes / ≤6 scrolls per minute, every screen persisted with raw text + URL + timestamp + screenshot (screenshots stay local), interruptible; `distilly collect x --mode browser --consent <token>` must exit without a token — never work around it.
5. When the user can only paste text or screenshots, register the source with `distilly note --from <file|->` (`method:"model-read"`); never pretend it was collected.
6. Transcribe audio/video with `distilly transcribe` before parsing subtitles; never commit a full transcript to the repository.

**Completion criteria**: `knowledge/index.json` has one ledger entry per grounded source (with `id`, `kind`, `origin`, `fetched_at`, `bytes`, `sha256`, `credentialed`, `method`, `warnings[]`); every `knowledge/text/<source>.md` has at least one anchor; receipt `inputs[]`/`outputs[]` sha256 matches the ledger; unavailable channels appear in `unavailable[]`.
**On failure**: when a command exits non-zero, report the exact command, its stderr, and the remedy (for example which `~/.distilly/*_config.json` must be configured), then stop and wait for instructions; if 0 sources landed, do not enter Step 2.

### Step 2: Derive

1. Do not read `evidence/derived/*` before deriving — run `distilly retrospect` first.
2. `distilly retrospect` is pure derivation: input is `knowledge/**`, output is `evidence/derived/*.json`, and every conclusion carries evidence anchors.
3. To prove determinism, run it twice; the same input must produce identical sha256.

**Completion criteria**: `evidence/derived/*.json` exists; the receipt reports `anchors.total` / `anchors.cited`; `outputs[].sha256` is identical across two runs.
**On failure**: a non-zero exit means the input side is broken — go back to Step 1 and check the ledger and text anchors; never hand-write or hand-edit derived JSON to force a pass.

### Step 3: Read

1. Read in this order: `knowledge/index.json` → `knowledge/text/*.md` → `evidence/derived/*.json`.
2. Restate to the user "which files were read, how many rows each, how many anchors" before writing conclusions.
3. Every conclusion carries `file + anchor` (for example `knowledge/text/feishu.md [k0042]`).
4. Conclusions without evidence are written as `unknown`, together with what material would supply the evidence.
5. Keep facts and candidates apart: only statements backed by a specific anchor are facts; patterns, tendencies, and inferences from derived files stay candidates and never get promoted to conclusions.
6. Full detail rules are in `prompts/retrospection.md`.

**Completion criteria**: every file in the restatement list back-references into the ledger; every cited anchor really exists in `knowledge/text/**`; no conclusion is left without an anchor.
**On failure**: with missing files or zero anchors, go back to Step 1; never fill the gap from memory or general knowledge.

### Step 4: Distill

Resolve the execution matrix for the family confirmed in Step 0:

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompts/intake.md` | `prompts/persona_analyzer.md` | `prompts/persona_builder.md` | `prompts/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompts/relationship/intake.md` | `prompts/relationship/persona_analyzer.md` | `prompts/relationship/persona_builder.md` | `prompts/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompts/celebrity/intake.md` | `prompts/celebrity/persona_analyzer.md` | `prompts/celebrity/persona_builder.md` | `prompts/celebrity/merger.md` | `./skills/celebrity/{slug}` |

Shared across all families: Work analyzer `prompts/work_analyzer.md`, Work builder `prompts/work_builder.md`, Correction handler `prompts/correction_handler.md`.

Two tracks:

- **Track A (Work Skill)**: follow `prompts/work_analyzer.md` and extract responsible systems, technical standards, workflow, output preferences, experience. For `celebrity`, interpret `work` as methods, judgment frameworks, and decision patterns.
- **Track B (Persona)**: use the family-specific persona analyzer; for `celebrity` with `research_profile=budget-unfriendly`, switch to `prompts/celebrity/budget_unfriendly/persona_analyzer.md`. Translate the user's tags into concrete behavior rules and extract communication style, decision patterns, and interpersonal behavior from the material.

Never hand-build a `skills/{family}/{slug}` tree: write `meta.json` / `work.md` / `persona.md` to temporary files and call `distilly skill create` (or `distilly skill update`). Install a generated person Skill with `distilly install <host>`.

**Completion criteria**: every dimension has anchors or an explicit `(insufficient source material)`; every behavior rule is concrete and executable; celebrity audit / validation returns an explicit `PASS` or `FAIL`; `distilly doctor` can report evidence coverage, unavailable channels, and the anchor back-reference rate. Celebrity research thresholds are in the subflow below.
**On failure**: mark thin dimensions `(insufficient source material, add related documents)` and downgrade them to candidates; when `source_grounding` fails, keep the `FAIL` and explain what is missing instead of padding with generic links.

### Step 5: Render

1. Run `distilly view check` first to confirm every anchor back-references to `knowledge/index.json`.
2. Write `views/<slug>.view.json`: sections, order, and emphasis only — no facts.
3. `distilly view render` produces the single-file, offline, dual-theme `views/<slug>.html` and writes `evidence/renders/receipt.json` (sha256 + bytes + inlined sources).
4. Use `distilly view render --shareable` only for external sharing, and confirm with the user first.
5. Re-check evidence coverage, unavailable channels, anchor back-reference rate, and computer-use share with `distilly doctor`.

**Completion criteria**: both `views/<slug>.html` and `evidence/renders/receipt.json` exist; the receipt sha256 matches the actual html sha256; zero broken internal links.
**On failure**: when rendering fails, keep `views/<slug>.view.json`, do not publish the HTML, and report the error and the missing sources to the user.

### Step 0 (prerequisite): Confirm the family and run intake

If the user entered `/distilly`, first confirm which family should be distilled:

1. `colleague`
2. `relationship`
3. `celebrity`

If the host already passed an explicit family, lock the character family immediately.

If the current family is `celebrity`, also confirm the research profile:

1. `budget-friendly`
2. `budget-unfriendly`

Default to `budget-friendly`. Only switch to `budget-unfriendly` when the user explicitly wants deeper research, higher confidence, or accepts a slower and more expensive distillation pass.

Choose the intake prompt by family: `colleague` → `prompts/intake.md`; `relationship` → `prompts/relationship/intake.md`; `celebrity` → `prompts/celebrity/intake.md`. `colleague` and `relationship` ask only 3 questions; `celebrity` asks 4, and the fourth must confirm `research_profile`.

The default 3 base questions:

1. **Alias / Codename** (required)
2. **Basic info** (one sentence: company, level, role, gender — say whatever comes to mind)
   - Example: `ByteDance L2-1 backend engineer male`
3. **Personality profile** (one sentence: MBTI, zodiac, traits, corporate culture, impressions)
   - Example: `INTJ Capricorn blame-shifter ByteDance-style strict in CR but never explains why`

Everything except the alias can be skipped. Summarize and confirm before entering Collect.

---

## Celebrity research subflow (between Step 2 and Step 3)

### budget-friendly

1. Read `prompts/celebrity/research.md` and follow its **6-dimension parallel collection strategy**.
2. Collection strategy (fixed during intake): **Local-first** (analyze local material first, search only the gaps) / **Web + local** (full 6-dimension web research cross-validated with local material) / **Web-only**.
3. For video or podcasts: `distilly transcribe <audio|video>` first, then `distilly parse-subtitle`; never commit a full transcript.
4. Split the raw research notes across **at least 3 files** (2 dimensions each), never one monolithic `research_notes.md`:
   - `knowledge/research/raw/01_core_profile.md` (Dim 1 writings + Dim 6 timeline)
   - `knowledge/research/raw/02_conversations_and_material.md` (Dim 2 conversations + Dim 4 decisions)
   - `knowledge/research/raw/03_expression_and_reception.md` (Dim 3 expression DNA + Dim 5 external views)
5. Taste principles: long-form > snippets, controversy > consensus, change > fixity, firsthand > secondhand. Source blacklist: never cite Zhihu, WeChat official accounts, Baidu Baike, content farms. Source hierarchy: user local material > first-person works > long interviews > decision records > social media > external analysis > secondhand summaries.
6. Confirm `Files scanned >= 3`, `Unique URLs >= 2`, `Potential long quote lines = 0`; every URL must be a specific page actually opened, not a platform root, search page, topic page, or placeholder.
7. **Quality checkpoint (Phase 1.5)**: show the user a structured collection summary (sources per dimension + key findings + contradictions + thin dimensions + cold-figure verdict) and wait for confirmation.
8. **Cold figure detection**: below 10 total sources, limit mental models to 2–3, mark thin models "based on limited information", expand the honest boundaries section, and tell the user what material would improve quality.
9. Analysis input priority: primary material (source weight 1-3) > merged research summary > explicit user notes.

### budget-unfriendly

1. Read `prompts/celebrity/budget_unfriendly/research.md` and `references/celebrity_budget_unfriendly_framework.md` first.
2. Write the **six-track research set** as independent files (never merged, never cloned): `01_writings.md` / `02_conversations.md` / `03_expression_dna.md` / `04_decisions.md` / `05_external_views.md` / `06_timeline.md`.
3. Every evidence item carries a source weight (1-7); follow taste principles + source blacklist + source hierarchy.
4. Minimum floor: `Files scanned >= 6`, `Unique URLs >= 8`, `Primary-source markers >= 3`, `Source metadata blocks >= 6`, `Contradiction bullets >= 6`, `Inference bullets >= 6`, `Potential long quote lines = 0`, `Track coverage count = 6`. If short, fill the weak track instead of skipping to review.
5. Write, in order: `knowledge/research/reviews/research_audit.md` (explicit `PASS/FAIL`; checks source hierarchy, primary ratio > 50%, taste principles, cold figure) → `synthesis.md` (triple gate: cross-context recurrence / generative power / exclusivity; extract intellectual genealogy and Agentic Protocol seeds) → `validation.md` per `prompts/celebrity/budget_unfriendly/validation.md` (known-answer ≥2 questions + 1 edge case + 100-word voice check + copyright check + Agentic Protocol check, explicit `PASS/FAIL`).
6. Any `FAIL` means backfill first; never invent URLs, quotes, book titles, or video titles to pass a check.

---

## Evolution Mode: Append Files

When the user provides new files or text:

1. Collect the new material with the Step 1 flow (`distilly harvest` for local files, `distilly parse-chat` for exports, `distilly note --from -` for pasted text).
2. Run `distilly retrospect` to refresh derivations, then restate "what was read, how many rows, how many anchors" per Step 3.
3. Resolve the base dir for the current family and read the existing `{resolved_base_dir}/{slug}/work.md` and `persona.md`.
4. Analyze the delta with the family-specific merger prompt.
5. Archive the current version with `distilly skill version`.
6. Write the work/persona deltas to temporary patch files and apply them with `distilly skill update`.
7. For `celebrity`, re-check evidence coverage with `distilly doctor` after the update.

---

## Evolution Mode: Conversation Correction

When the user says "that's wrong" / "he should be":

1. Identify the correction with `prompts/correction_handler.md`.
2. Decide whether it belongs to Work (technical/workflow) or Persona (personality/communication).
3. Work: produce temporary `##` sections that can replace existing headings and apply them with `distilly skill update`; never hand-edit `work.md`.
4. Persona: write `{scene, wrong, correct}` (or `{"persona_corrections": [...]}` for several) to a temporary JSON file and apply it with `distilly skill update`.
5. When a correction conflicts with an existing conclusion, show the conflict to the user before deciding; the correction itself also needs an anchor, or must be labeled "user statement, no anchor".
6. For `celebrity`, re-check with `distilly doctor` after the update.

---

## Management Operations

List skills across the three families:

```bash
distilly skill list
```

Roll back a specific skill version:

```bash
distilly skill version
```

Delete a specific skill (after confirming the character family):

```bash
rm -rf skills/colleague/{slug}
rm -rf skills/relationship/{slug}
rm -rf skills/celebrity/{slug}
```

Install into a host: `distilly install <host>`; uninstall: `distilly uninstall`.

List and revoke granted consent:

```bash
distilly consent list
distilly consent revoke
```

---

## MUST

- First list "which files were read, how many rows each, how many anchors", then write conclusions; every conclusion carries `file + anchor`.
- With no evidence write `unknown`; candidates never become conclusions.
- Check every step against the completion criteria of the five-step mainline before moving on.

## MUST NOT

- Never rewrite quotes; never fabricate URLs, anchors, book titles, or video titles; never pad sources with platform roots.
- Credentials are read only from `~/.distilly/*_config.json` or environment variables and never appear in chat, files, receipts, or logs.
- Never hand-craft platform API calls: all network collection goes through `distilly collect` / `distilly harvest` / `distilly parse-chat` / `distilly parse-email` / `distilly parse-subtitle` / `distilly parse-doc` / `distilly parse-archive` / `distilly transcribe`.
- Never degrade silently: failures, unavailable channels, and skipped steps are all stated.

## RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt, `knowledge/index.json`, or `evidence/renders/receipt.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
