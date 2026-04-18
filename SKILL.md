name: dot-skill
description: "Unified meta-skill engine for distilling colleague, relationship, or celebrity characters into reusable Skills. | 统一的 meta-skill 引擎，把 colleague、relationship、celebrity 三类对象蒸馏成可复用 Skill。"
argument-hint: "[character] [name-or-slug]"
version: "1.0.0"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

> **Language / 语言**: This skill supports both English and Chinese. Detect the user's language from their first message and respond in the same language throughout. Below are instructions in both languages — follow the one matching the user's language.
>
> 本 Skill 支持中英文。根据用户第一条消息的语言，全程使用同一语言回复。下方提供了两种语言的指令，按用户语言选择对应版本执行。

> **Execution Root / 执行根目录**: Run all `Bash` commands from the directory that contains this `SKILL.md`. All `tools/...` and `prompts/...` paths below are relative to the skill root.
>
> **Critical rule / 关键规则**: Do **not** prepend commands with guessed host-specific paths such as `cd ~/.hermes/...`, `cd ~/.claude/...`, `cd ~/.openclaw/...`, `cd ~/.codex/...`, or hard-coded `/Users/.../dot-skill` paths. The current working directory is already the correct skill root. Run `python3 tools/...` directly.
>
> 所有 `Bash` 命令都必须在当前 `SKILL.md` 所在目录执行。下文出现的 `tools/...` 和 `prompts/...` 均为相对于 skill 根目录的相对路径。

# dot-skill 创建器（兼容宿主版）

## 触发条件

当用户说以下任意内容时启动：
- `/dot-skill`
- "帮我创建一个 skill"
- "我想蒸馏一个人"
- "新建一个 skill"
- "给我做一个 XX 的 skill"

兼容宿主：
- Claude Code
- OpenClaw
- Hermes
- Codex

统一主入口是 `dot-skill`。在支持 slash command 的宿主中，使用 `/dot-skill`。
对 Hermes 而言，只保证 `/dot-skill` 这一条 slash 入口稳定；`colleague`、`relationship`、`celebrity` 的兼容语义保留在工具层和 preset 层，但不保证每个兼容名称都能作为 Hermes slash command 被路由。

当用户对已有 Skill 说以下内容时，进入进化模式：
- "我有新文件" / "追加"
- "这不对" / "他不会这样" / "他应该是"
- `/update-skill {character} {slug}`

兼容更新别名：
- `/update-colleague {slug}`

当用户要求查看已生成的 Skill 时，执行下方“管理操作”里的列出命令。

---

## 工具使用规则

本 Skill 运行在任意兼容宿主中，只要求宿主能够读取本地文件并执行 Bash / Python 命令。使用以下工具约定：

| 任务 | 使用工具 |
|------|---------|
| 读取 PDF 文档 | `Read` 工具（原生支持 PDF） |
| 读取图片截图 | `Read` 工具（原生支持图片） |
| 读取 MD/TXT 文件 | `Read` 工具 |
| 解析飞书消息 JSON 导出 | `Bash` → `python3 tools/feishu_parser.py` |
| 飞书全自动采集（推荐） | `Bash` → `python3 tools/feishu_auto_collector.py` |
| 飞书文档（浏览器登录态） | `Bash` → `python3 tools/feishu_browser.py` |
| 飞书文档（MCP App Token） | `Bash` → `python3 tools/feishu_mcp_client.py` |
| 钉钉全自动采集 | `Bash` → `python3 tools/dingtalk_auto_collector.py` |
| 解析邮件 .eml/.mbox | `Bash` → `python3 tools/email_parser.py` |
| 写入/更新 Skill 文件 | `Write` / `Edit` 工具 |
| 版本管理 | `Bash` → `python3 tools/version_manager.py` |
| 列出已有 Skill | `Bash` → `python3 tools/skill_writer.py --action list` |

**基础目录**：
- `colleague` → `./skills/colleague/{slug}/`
- `relationship` → `./skills/relationship/{slug}/`
- `celebrity` → `./skills/celebrity/{slug}/`

如需改为全局路径，用 `--base-dir` 指向对应 character family 的根目录。

---

## 主流程：创建新 Skill

### Step 0：确认 character family

如果用户使用的是 `/dot-skill`，先确认本次要蒸馏的是哪一类：

1. `colleague`
2. `relationship`
3. `celebrity`

如果上层宿主已经显式把 family 传进来，则直接固定对应的 character family。

如果当前 family 是 `celebrity`，还必须确认 research profile：

1. `budget-friendly`
2. `budget-unfriendly`

默认使用 `budget-friendly`。只有当用户明确要求更深研究、更高置信度、或者愿意接受更慢更贵的蒸馏流程时，才切到 `budget-unfriendly`。

### Step 1：基础信息录入

根据 character family 选择对应 intake prompt：

- `colleague` → `prompts/intake.md`
- `relationship` → `prompts/relationship/intake.md`
- `celebrity` → `prompts/celebrity/intake.md`

`colleague` 和 `relationship` 只问 3 个问题。
`celebrity` 按 `prompts/celebrity/intake.md` 问 4 个问题，其中第 4 个问题必须确认 `research_profile`。

默认的 3 个基础问题：

1. **花名/代号**（必填）
2. **基本信息**（一句话：公司、职级、职位、性别，想到什么写什么）
   - 示例：`字节 2-1 后端工程师 男`
3. **性格画像**（一句话：MBTI、星座、个性标签、企业文化、印象）
   - 示例：`INTJ 摩羯座 甩锅高手 字节范 CR很严格但从来不解释原因`

除姓名外均可跳过。收集完后汇总确认，再进入下一步。

### Step 2：原材料导入

询问用户提供原材料，展示四种方式供选择：

```
原材料怎么提供？

  [A] 飞书自动采集（推荐）
      输入姓名，自动拉取消息记录 + 文档 + 多维表格

  [B] 钉钉自动采集
      输入姓名，自动拉取文档 + 多维表格
      消息记录通过浏览器采集（钉钉 API 不支持历史消息）

  [C] 飞书链接
      直接给文档/Wiki 链接（浏览器登录态 或 MCP）

  [D] 上传文件
      PDF / 图片 / 导出 JSON / 邮件 .eml

  [E] 直接粘贴内容
      把文字复制进来

可以混用，也可以跳过（仅凭手动信息生成）。
```

---

#### 方式 A：飞书自动采集（推荐）

首次使用需配置：
```bash
python3 tools/feishu_auto_collector.py --setup
```

**群聊采集**（使用 tenant_access_token，需 bot 在群内）：
```bash
python3 tools/feishu_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 1000 \
  --doc-limit 20
```

**私聊采集**（需要 user_access_token + 私聊 chat_id）：

私聊消息只能通过用户身份（user_access_token）获取，应用身份无权访问私聊。

**前置条件**：

用户需要提供以下信息：
1. **飞书应用凭证**：`app_id` 和 `app_secret`（在飞书开放平台创建自建应用获取）
2. **用户权限**：应用需开通以下用户权限（scope）：
   - `im:message` — 以用户身份读取/发送消息
   - `im:chat` — 以用户身份读取会话列表
3. **OAuth 授权码（code）**：用户在浏览器中完成 OAuth 授权后，从回调 URL 中获取

如果用户缺少以上任何信息，引导他们完成配置。不要假设用户已经配好了。

**获取 user_access_token 的完整流程**：

当用户提供了 app_id、app_secret，并确认已开通用户权限后：

1. 帮用户生成 OAuth 授权链接：
   ```
   https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri=http://www.example.com&scope=im:message%20im:chat
   ```
   > ⚠️ 注意：`redirect_uri` 需要在飞书应用的「安全设置 → 重定向 URL」中添加 `http://www.example.com`
   
2. 用户在浏览器打开链接，登录并授权
3. 页面会跳转到 `http://www.example.com?code=xxx`，用户复制 code 给你
4. 用 code 换取 token：
   ```bash
   python3 tools/feishu_auto_collector.py --exchange-code {CODE}
   ```
   或者你自己写 Python 脚本调飞书 API 换取：
   ```python
   # 1. 获取 app_access_token
   POST https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal
   Body: {"app_id": "xxx", "app_secret": "xxx"}
   
   # 2. 用 code 换 user_access_token
   POST https://open.feishu.cn/open-apis/authen/v1/oidc/access_token
   Header: Authorization: Bearer {app_access_token}
   Body: {"grant_type": "authorization_code", "code": "xxx"}
   ```

**获取私聊 chat_id**：

用户通常不知道 chat_id。当用户有了 user_access_token 但没有 chat_id 时，你应该**自己写 Python 脚本**来获取：

- **方法**：用 user_access_token 向对方的 open_id 发一条消息，返回值中会包含 chat_id
  ```python
  POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
  Header: Authorization: Bearer {user_access_token}
  Body: {"receive_id": "{对方open_id}", "msg_type": "text", "content": "{\"text\":\"你好\"}"}
  # 返回值中的 chat_id 就是私聊会话 ID
  ```
- **注意**：`GET /im/v1/chats` 不会返回私聊会话，这是飞书 API 的限制，不是权限问题，不要尝试用这个接口找私聊
- 如果用户不知道对方的 open_id，可以用 tenant_access_token 调通讯录 API 搜索：
  ```python
  GET https://open.feishu.cn/open-apis/contact/v3/scopes
  # 返回应用可见范围内所有用户的 open_id
  ```

**执行采集**：

拿到 user_access_token 和 chat_id 后：
```bash
python3 tools/feishu_auto_collector.py \
  --open-id {对方open_id} \
  --p2p-chat-id {chat_id} \
  --user-token {user_access_token} \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 1000
```

**灵活性原则**：以上 API 调用不一定要用 collector 脚本，如果脚本跑不通或者场景不匹配，你可以直接写 Python 脚本调飞书 API 完成任务。核心 API 参考：
- 获取 token：`POST /auth/v3/app_access_token/internal`、`POST /authen/v1/oidc/access_token`
- 发消息（获取 chat_id）：`POST /im/v1/messages?receive_id_type=open_id`
- 拉消息：`GET /im/v1/messages?container_id_type=chat&container_id={chat_id}`
- 查通讯录：`GET /contact/v3/scopes`、`GET /contact/v3/users/{user_id}`

自动采集内容：
- 群聊：所有与他共同群聊中他发出的消息（过滤系统消息、表情包）
- 私聊：与他的私聊完整对话（含双方消息，用于理解对话语境）
- 他创建/编辑的飞书文档和 Wiki
- 相关多维表格（如有权限）

采集完成后用 `Read` 读取输出目录下的文件：
- `knowledge/{slug}/messages.txt` → 消息记录（群聊 + 私聊）
- `knowledge/{slug}/docs.txt` → 文档内容
- `knowledge/{slug}/collection_summary.json` → 采集摘要

如果采集失败，根据报错自行判断原因并尝试修复，常见问题：
- 群聊采集：bot 未添加到群聊
- 私聊采集：user_access_token 过期（有效期 2 小时，可用 refresh_token 刷新）
- 权限不足：引导用户在飞书开放平台开通对应权限并重新授权
- 或改用方式 B/C

---

#### 方式 B：钉钉自动采集

首次使用需配置：
```bash
python3 tools/dingtalk_auto_collector.py --setup
```

然后输入姓名，一键采集：
```bash
python3 tools/dingtalk_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 500 \
  --doc-limit 20 \
  --show-browser   # 首次使用加此参数，完成钉钉登录
```

采集内容：
- 他创建/编辑的钉钉文档和知识库
- 多维表格
- 消息记录（⚠️ 钉钉 API 不支持历史消息拉取，自动切换浏览器采集）

采集完成后 `Read` 读取：
- `knowledge/{slug}/docs.txt`
- `knowledge/{slug}/bitables.txt`
- `knowledge/{slug}/messages.txt`

如消息采集失败，提示用户截图聊天记录后上传。

---

#### 方式 D：上传文件

- **PDF / 图片**：`Read` 工具直接读取
- **飞书消息 JSON 导出**：
  ```bash
  python3 tools/feishu_parser.py --file {path} --target "{name}" --output /tmp/feishu_out.txt
  ```
  然后 `Read /tmp/feishu_out.txt`
- **邮件文件 .eml / .mbox**：
  ```bash
  python3 tools/email_parser.py --file {path} --target "{name}" --output /tmp/email_out.txt
  ```
  然后 `Read /tmp/email_out.txt`
- **Markdown / TXT**：`Read` 工具直接读取

---

#### 方式 C：飞书链接

用户提供飞书文档/Wiki 链接时，询问读取方式：

```
检测到飞书链接，选择读取方式：

  [1] 浏览器方案（推荐）
      复用你本机 Chrome 的登录状态
      ✅ 内部文档、需要权限的文档都能读
      ✅ 无需配置 token
      ⚠️  需要本机安装 Chrome + playwright

  [2] MCP 方案
      通过飞书 App Token 调用官方 API
      ✅ 稳定，不依赖浏览器
      ✅ 可以读消息记录（需要群聊 ID）
      ⚠️  需要先配置 App ID / App Secret
      ⚠️  内部文档需要管理员给应用授权

选择 [1/2]：
```

**选 1（浏览器方案）**：
```bash
python3 tools/feishu_browser.py \
  --url "{feishu_url}" \
  --target "{name}" \
  --output /tmp/feishu_doc_out.txt
```
首次使用若未登录，会弹出浏览器窗口要求登录（一次性）。

**选 2（MCP 方案）**：

首次使用需初始化配置：
```bash
python3 tools/feishu_mcp_client.py --setup
```

之后直接读取：
```bash
python3 tools/feishu_mcp_client.py \
  --url "{feishu_url}" \
  --output /tmp/feishu_doc_out.txt
```

读取消息记录（需要群聊 ID，格式 `oc_xxx`）：
```bash
python3 tools/feishu_mcp_client.py \
  --chat-id "oc_xxx" \
  --target "{name}" \
  --limit 500 \
  --output /tmp/feishu_msg_out.txt
```

两种方式输出后均用 `Read` 读取结果文件，进入分析流程。

---

#### 方式 E：直接粘贴

用户粘贴的内容直接作为文本原材料，无需调用任何工具。

---

如果用户说"没有文件"或"跳过"，仅凭 Step 1 的手动信息生成 Skill。

### Step 3：分析原材料

先根据 character family 解析本次的执行矩阵：

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompts/intake.md` | `prompts/persona_analyzer.md` | `prompts/persona_builder.md` | `prompts/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompts/relationship/intake.md` | `prompts/relationship/persona_analyzer.md` | `prompts/relationship/persona_builder.md` | `prompts/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompts/celebrity/intake.md` | `prompts/celebrity/persona_analyzer.md` | `prompts/celebrity/persona_builder.md` | `prompts/celebrity/merger.md` | `./skills/celebrity/{slug}` |

所有 family 共用：
- Work analyzer：`prompts/work_analyzer.md`
- Work builder：`prompts/work_builder.md`
- Correction handler：`prompts/correction_handler.md`

如果当前是 `celebrity`，必须先走 research 子流程，再进入分析。

### celebrity / budget-friendly

1. 读取 `prompts/celebrity/research.md`，按其中的 **6 维度并行采集策略** 做 research planning
2. 先创建目录：
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged"
   ```
3. 确认采集策略（在 intake 阶段已确定）：
   - **Local-first**：先分析用户本地材料，标记覆盖了哪些维度，只对缺失维度做网络补充
   - **Web + local**：全量 6 维度网络研究，同时与本地材料合并，交叉验证
   - **Web-only**：标准 6 维度网络研究
4. 如果用户明确提供了可处理的视频链接或字幕来源，而且处理结果不会作为长文本落盘：
   ```bash
   bash tools/research/download_subtitles.sh "{url}" "{skill_dir}/knowledge/subtitles"
   python3 tools/research/srt_to_transcript.py "{subtitle_file}" "{skill_dir}/knowledge/transcripts/{name}.txt"
   ```
5. 按 **6 维度** 研究，原始 research 笔记**至少**要拆成 3 个文件（每个文件覆盖 2 个维度），不能只写一个 `research_notes.md`：
   - `knowledge/research/raw/01_core_profile.md`（维度 1 著作 + 维度 6 时间线）
   - `knowledge/research/raw/02_conversations_and_material.md`（维度 2 对话 + 维度 4 决策）
   - `knowledge/research/raw/03_expression_and_reception.md`（维度 3 表达 DNA + 维度 5 他者视角）
6. 研究过程中必须遵守 **品味原则**（详见 research prompt）：
   - 长文 > 金句，争议 > 共识，变化 > 固定，一手 > 二手
   - 遵守 **信源黑名单**：永不引用知乎、微信公众号、百度百科、内容农场
   - 遵守 **信源优先级**：用户本地材料 > 一手著作 > 长访谈 > 决策记录 > 社交媒体 > 外部分析 > 二手转述
7. 合并 research：
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
   输出：`knowledge/research/merged/summary.md`
8. 读取 `knowledge/research/merged/summary.md`，确认：
   - `Files scanned >= 3`
   - `Unique URLs >= 2`
   - `Potential long quote lines = 0`
   - research notes 里的 URL 必须是**实际打开过的具体页面**，不是平台首页、搜索页、话题页或占位路径
   如果不满足，继续补 research notes，直到满足或明确记录搜集受限原因。
9. **质量关卡（Phase 1.5）**：在进入分析之前，必须向用户展示结构化采集摘要：
   ```
   ┌──────────────────────────────┬──────────┬─────────────────────────────┐
   │ 维度                         │ 来源数    │ 关键发现                     │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 1 著作                       │ N        │ [核心论点 / 缺失]            │
   │ 2 对话                       │ N        │ [关键模式 / 缺失]            │
   │ 3 表达 DNA                   │ N        │ [风格标记 / 缺失]            │
   │ 4 决策                       │ N        │ [决策模式 / 缺失]            │
   │ 5 他者视角                   │ N        │ [外部观点 / 缺失]            │
   │ 6 时间线                     │ N        │ [认知轨迹 / 缺失]            │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 矛盾点                       │ N        │ [摘要]                       │
   │ 薄弱维度                     │ [列表]   │ 补充方案：[计划]              │
   │ 冷门人物？                   │ 是/否    │                              │
   └──────────────────────────────┴──────────┴─────────────────────────────┘
   ```
   等待用户确认后再继续。如果用户指出问题或需要某个维度更深入，先补充研究。
10. **冷门人物检测**：如果总来源 < 10 条，按冷门人物协议处理：
    - 心智模型限制为 2–3 个
    - 薄弱模型标注"基于有限信息"
    - 扩大诚实边界章节
    - 告知用户提供什么补充材料可以改善质量
11. celebrity 的后续分析输入必须优先使用：
    - 一手材料（信源权重 1-3）
    - merged research summary
    - 用户提供的补充描述

### celebrity / budget-unfriendly

1. 先读取：
   - `prompts/celebrity/budget_unfriendly/research.md`
   - `references/celebrity_budget_unfriendly_framework.md`
2. 先创建目录：
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged" "{skill_dir}/knowledge/research/reviews"
   ```
3. 确认采集策略（在 intake 阶段已确定）：local-first / web+local / web-only
4. 按 **6-track 独立文件结构** 写 research notes（不可合并，不可克隆观察）：
   - `knowledge/research/raw/01_writings.md`（维度 1：著作与系统思考）
   - `knowledge/research/raw/02_conversations.md`（维度 2：即兴对话与压力应对）
   - `knowledge/research/raw/03_expression_dna.md`（维度 3：语言指纹）
   - `knowledge/research/raw/04_decisions.md`（维度 4：行为与选择）
   - `knowledge/research/raw/05_external_views.md`（维度 5：他者视角与批评）
   - `knowledge/research/raw/06_timeline.md`（维度 6：认知轨迹）
5. 研究过程必须遵守 **品味原则 + 信源黑名单 + 信源优先级**（见 research prompt），每条 evidence 必须标注 source weight (1-7)。
6. 合并 research：
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
7. 读取 `knowledge/research/merged/summary.md`，确认最低门槛：
   - `Files scanned >= 6`
   - `Unique URLs >= 8`
   - `Primary-source markers >= 3`
   - `Source metadata blocks >= 6`
   - `Contradiction bullets >= 6`
   - `Inference bullets >= 6`
   - `Potential long quote lines = 0`
   - `Track coverage count = 6`
   - research notes 里的 URL 必须是**实际打开过的具体页面**，不是平台首页、搜索页、话题页或占位路径
   如果不满足，继续补对应 track，而不是直接进入后续 review。
8. **质量关卡（Phase 1.5）**：在进入 audit 之前，向用户展示结构化采集摘要（含 primary 比例、矛盾数、候选 mental models、known-answer 候选、薄弱维度、冷门人物判定）。等待用户确认后再继续。
9. 再读取：
   - `prompts/celebrity/budget_unfriendly/audit.md`
   - `prompts/celebrity/budget_unfriendly/synthesis.md`
   - `references/celebrity_budget_unfriendly_template.md`
10. 先生成 `knowledge/research/reviews/research_audit.md`
    - 审计必须明确给出 `PASS / FAIL`
    - audit 必须检查：信源层级合规（无黑名单）、primary 比例 > 50%、品味原则遵守、冷门人物评估
    - 如果 audit 是 `FAIL`，按 audit 给出的 Backfill Tasks 补齐，不要跳到 synthesis
11. **提炼关卡（Phase 2.5）**：audit 通过后，向用户展示候选 mental models 摘要（含三重门判定、evidence anchors、failure modes）。确认合理性后再进入 synthesis。
12. 再生成 `knowledge/research/reviews/synthesis.md`
    - 必须对候选 mental models 做 triple-gate 判断：
      - cross-context recurrence
      - generative power
      - exclusivity
    - 同时提取智识谱系种子（influenced by / diverged from）和 Agentic Protocol 种子（该人物会如何分析新问题的维度列表）
13. 再按 `prompts/celebrity/budget_unfriendly/validation.md` 生成：
    - `knowledge/research/reviews/validation.md`
    - validation 必须明确给出 `PASS / FAIL`
    - 必须做 known-answer check（至少 2 题）+ edge-case check（1 题）+ voice check（100 字盲测）+ copyright check + Agentic Protocol check
    - 如果 validation 是 `FAIL`，必须先修 draft 再继续
14. budget-unfriendly 的后续分析输入必须优先使用：
    - 6-track raw notes
    - merged research summary
    - research audit
    - synthesis review（含智识谱系种子、Agentic Protocol 种子）
    - validation review
    - 用户补充材料

两种 celebrity profile 的共同约束：

- 如果外部搜集失败或被平台验证拦截：
  - 明确告诉用户搜集受限的原因
  - 保留已有 research 原始材料和 merged summary
  - 继续生成，但把 `source_grounding` 视为未完成
  - **不要**为了通过质量检查而编造 URL、引用、书名、视频标题，或塞入泛化主页链接
- **不要**把完整 transcript、完整字幕、长段原文抄进仓库
- 只允许保留结构化摘要、来源元信息和极短引用，避免版权风险

完成 family 解析后，再按两条线分析：

**线路 A（Work Skill）**：
- 参考 `prompts/work_analyzer.md`
- 提取：负责系统、技术规范、工作流程、输出偏好、经验知识
- celebrity 场景下，`work` 更偏方法论、判断框架、决策习惯，不要机械套成“工作职责”

**线路 B（Persona）**：
- 使用当前 family 对应的 persona analyzer
- 如果 `celebrity` 且 `research_profile=budget-unfriendly`，改用：
  - `prompts/celebrity/budget_unfriendly/persona_analyzer.md`
- 将用户填写的标签翻译为具体行为规则
- 从原材料中提取：表达风格、决策模式、人际行为
- celebrity 场景下，必须保留：
  - mental models
  - decision heuristics
  - expression DNA
  - contradictions
  - honest boundaries

### Step 4：生成并预览

使用 `prompts/work_builder.md` 生成 Work 内容。
使用当前 family 对应的 persona builder 生成 Persona 内容。

具体映射：
- `colleague` → `prompts/persona_builder.md`
- `relationship` → `prompts/relationship/persona_builder.md`
- `celebrity` → `prompts/celebrity/persona_builder.md`
- `celebrity` + `budget-unfriendly` → `prompts/celebrity/budget_unfriendly/persona_builder.md`

向用户展示摘要（各 5-8 行），询问：
```
Work Skill 摘要：
  - 负责：{xxx}
  - 技术栈：{xxx}
  - CR 重点：{xxx}
  ...

Persona 摘要：
  - 核心性格：{xxx}
  - 表达风格：{xxx}
  - 决策模式：{xxx}
  ...

确认生成？还是需要调整？
```

### Step 5：写入文件

用户确认后，不要手工拼接 `skills/colleague/{slug}` 这类文件树。统一走 writer：

1. 先解析当前 storage root：
   - `colleague` → `./skills/colleague`
   - `relationship` → `./skills/relationship`
   - `celebrity` → `./skills/celebrity`
2. 用 `Write` 工具写三个临时文件：
   - `/tmp/dot_skill_{slug}_meta.json`
   - `/tmp/dot_skill_{slug}_work.md`
   - `/tmp/dot_skill_{slug}_persona.md`
3. `meta.json` 至少包含：
   - `name`
   - `display_name`
   - `character`
   - `research_profile`（当 character=`celebrity` 时必填）
   - `classification.language`（必须设置为用户当前语言，例如 `zh-CN` 或 `en`）
   - `profile`
   - `tags`
   - `knowledge_sources`
4. 然后调用：
   ```bash
   python3 tools/skill_writer.py \
     --action create \
     --character {character} \
     --research-profile {research_profile} \
     --slug {slug} \
     --name "{name}" \
     --meta /tmp/dot_skill_{slug}_meta.json \
     --work /tmp/dot_skill_{slug}_work.md \
     --persona /tmp/dot_skill_{slug}_persona.md \
     --base-dir {resolved_base_dir}
   ```
5. 该命令会统一生成：
   - `SKILL.md`
   - `work.md`
   - `persona.md`
   - `work_skill.md`
   - `persona_skill.md`
   - `manifest.json`
   - `meta.json`
   - 如需把生成后的角色 Skill 安装到宿主：
     - Claude Code：追加 `--install-claude-skill`
     - OpenClaw：追加 `--install-openclaw-skill`
     - Codex：追加 `--install-codex-skill`
     - Claude Code on Windows：可再追加 `--install-claude-command-shim`
6. 如果当前是 `celebrity`，创建完成后必须再跑一次质量检查：
   ```bash
   python3 tools/research/quality_check.py "{resolved_base_dir}/{slug}/SKILL.md" --profile {research_profile}
   ```
7. 如果 `celebrity` 的质量检查仍然提示 `source_grounding` 失败：
   - 可以补写诚实的来源说明和局限说明
   - 但只有在拿到真实、具体、可追溯的外部来源时，才能补充 URL
   - **不要**用站点首页、topic 页、搜索页、个人空间首页等泛化链接来“刷过”检查
   - 如果没有真实来源，就保留 FAIL，并向用户说明后续需要补哪些材料

告知用户时，文件位置必须按当前 family 返回，不要默认写成 colleague。

---

## 进化模式：追加文件

用户提供新文件或文本时：

1. 按 Step 2 的方式读取新内容
2. 根据当前 family 解析 base dir
3. 用 `Read` 读取现有 `{resolved_base_dir}/{slug}/work.md` 和 `persona.md`
4. 使用当前 family 对应的 merger prompt 分析增量内容
5. 存档当前版本（用 Bash）：
   ```bash
   python3 tools/version_manager.py \
     --action backup \
     --character {character} \
     --slug {slug} \
     --base-dir {resolved_base_dir}
   ```
6. 把 work/persona 增量分别写到临时 patch 文件
7. 调用：
   ```bash
   python3 tools/skill_writer.py \
     --action update \
     --character {character} \
     --slug {slug} \
     --work-patch /tmp/dot_skill_{slug}_work_patch.md \
     --persona-patch /tmp/dot_skill_{slug}_persona_patch.md \
     --base-dir {resolved_base_dir}
   ```
8. 如果当前是 `celebrity`，更新后再次执行 quality check

---

## 进化模式：对话纠正

用户表达"不对"/"应该是"时：

1. 参考 `prompts/correction_handler.md` 识别纠正内容
2. 判断属于 Work（技术/流程）还是 Persona（性格/沟通）
3. 如果属于 Work：
   - 生成 `/tmp/dot_skill_{slug}_work_patch.md`
   - patch 必须是可替换的 `##` section，不要直接手改最终文件
   - 调用：
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --work-patch /tmp/dot_skill_{slug}_work_patch.md \
       --base-dir {resolved_base_dir}
     ```
4. 如果属于 Persona：
   - 将 correction 写入 `/tmp/dot_skill_{slug}_correction.json`
   - 单条纠正可直接写成 `{scene, wrong, correct}`
   - 多条 persona 纠正可写成 `{"persona_corrections": [{...}, {...}]}`
   - 调用：
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --correction-json /tmp/dot_skill_{slug}_correction.json \
       --base-dir {resolved_base_dir}
     ```
5. 如果当前是 `celebrity`，更新后再次执行 quality check
6. 不要直接手改 `work.md`、`persona.md`、`SKILL.md`、`meta.json`；统一通过 writer 更新

---

## 管理操作

列出三类 Skill：
```bash
python3 tools/skill_writer.py --action list --character colleague --base-dir ./skills/colleague
python3 tools/skill_writer.py --action list --character relationship --base-dir ./skills/relationship
python3 tools/skill_writer.py --action list --character celebrity --base-dir ./skills/celebrity
```

回滚某个 Skill 版本：
```bash
# colleague
python3 tools/version_manager.py --action rollback --character colleague --slug {slug} --version {version} --base-dir ./skills/colleague

# relationship
python3 tools/version_manager.py --action rollback --character relationship --slug {slug} --version {version} --base-dir ./skills/relationship

# celebrity
python3 tools/version_manager.py --action rollback --character celebrity --slug {slug} --version {version} --base-dir ./skills/celebrity
```

删除某个 Skill：
确认 character 后执行：
```bash
# colleague
rm -rf skills/colleague/{slug}

# relationship
rm -rf skills/relationship/{slug}

# celebrity
rm -rf skills/celebrity/{slug}
```

---
---

# English Version

# dot-skill Creator (Compatible Host Edition)

## Trigger Conditions

Activate when the user says any of the following:
- `/dot-skill`
- "Help me create a skill"
- "I want to distill someone"
- "Create a new skill"
- "Make a skill for XX"

Compatible hosts:
- Claude Code
- OpenClaw
- Hermes
- Codex

The canonical entrypoint is `dot-skill`. In hosts that expose slash commands, use `/dot-skill`.
Under Hermes specifically, only `/dot-skill` is guaranteed as a stable slash entrypoint. Compatibility semantics for `colleague`, `relationship`, and `celebrity` remain in the tool layer and preset layer, but Hermes does not guarantee that every compatibility name will be routed as a slash command.

Enter evolution mode when the user says:
- "I have new files" / "append"
- "That's wrong" / "He wouldn't do that" / "He should be"
- `/update-skill {character} {slug}`

Compatibility update alias:
- `/update-colleague {slug}`

When the user asks to see generated skills, use the list commands in "Management Operations" below.

---

## Tool Usage Rules

This Skill runs in any compatible host that can read local files and execute Bash / Python commands. Use the following tool conventions:

| Task | Tool |
|------|------|
| Read PDF documents | `Read` tool (native PDF support) |
| Read image screenshots | `Read` tool (native image support) |
| Read MD/TXT files | `Read` tool |
| Parse Feishu message JSON export | `Bash` → `python3 tools/feishu_parser.py` |
| Feishu auto-collect (recommended) | `Bash` → `python3 tools/feishu_auto_collector.py` |
| Feishu docs (browser session) | `Bash` → `python3 tools/feishu_browser.py` |
| Feishu docs (MCP App Token) | `Bash` → `python3 tools/feishu_mcp_client.py` |
| DingTalk auto-collect | `Bash` → `python3 tools/dingtalk_auto_collector.py` |
| Parse email .eml/.mbox | `Bash` → `python3 tools/email_parser.py` |
| Write/update Skill files | `Write` / `Edit` tool |
| Version management | `Bash` → `python3 tools/version_manager.py` |
| List existing Skills | `Bash` → `python3 tools/skill_writer.py --action list` |

**Base directories**:
- `colleague` → `./skills/colleague/{slug}/`
- `relationship` → `./skills/relationship/{slug}/`
- `celebrity` → `./skills/celebrity/{slug}/`

For a global path, use `--base-dir` with the storage root for that character family.

---

## Main Flow: Create a New Skill

### Step 0: Confirm the character family

If the user entered `/dot-skill`, first confirm which family should be distilled:

1. `colleague`
2. `relationship`
3. `celebrity`

If the host already passed an explicit family, lock the character family immediately.

If the current family is `celebrity`, also confirm the research profile:

1. `budget-friendly`
2. `budget-unfriendly`

Default to `budget-friendly`. Only switch to `budget-unfriendly` when the user explicitly wants deeper research, higher confidence, or accepts a slower and more expensive distillation pass.

### Step 1: Basic Info Collection

Choose the intake prompt by character family:

- `colleague` → `prompts/intake.md`
- `relationship` → `prompts/relationship/intake.md`
- `celebrity` → `prompts/celebrity/intake.md`

For `colleague` and `relationship`, ask only 3 questions.
For `celebrity`, use the 4-question intake in `prompts/celebrity/intake.md`; the fourth question must confirm `research_profile`.

The default 3 base questions are:

1. **Alias / Codename** (required)
2. **Basic info** (one sentence: company, level, role, gender — say whatever comes to mind)
   - Example: `ByteDance L2-1 backend engineer male`
3. **Personality profile** (one sentence: MBTI, zodiac, traits, corporate culture, impressions)
   - Example: `INTJ Capricorn blame-shifter ByteDance-style strict in CR but never explains why`

Everything except the alias can be skipped. Summarize and confirm before moving to the next step.

### Step 2: Source Material Import

Ask the user how they'd like to provide materials:

```
How would you like to provide source materials?

  [A] Feishu Auto-Collect (recommended)
      Enter name, auto-pull messages + docs + spreadsheets

  [B] DingTalk Auto-Collect
      Enter name, auto-pull docs + spreadsheets
      Messages collected via browser (DingTalk API doesn't support message history)

  [C] Feishu Link
      Provide doc/Wiki link (browser session or MCP)

  [D] Upload Files
      PDF / images / exported JSON / email .eml

  [E] Paste Text
      Copy-paste text directly

Can mix and match, or skip entirely (generate from manual info only).
```

---

#### Option A: Feishu Auto-Collect (Recommended)

First-time setup:
```bash
python3 tools/feishu_auto_collector.py --setup
```

**Group chat collection** (uses tenant_access_token, bot must be in the group):
```bash
python3 tools/feishu_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 1000 \
  --doc-limit 20
```

**Private chat (P2P) collection** (requires user_access_token + p2p chat_id):

Private messages can only be accessed via user identity (user_access_token). App identity cannot access private chats.

**Prerequisites**:

The user needs to provide:
1. **Feishu app credentials**: `app_id` and `app_secret` (from Feishu Open Platform)
2. **User scopes**: The app must have these user scopes enabled:
   - `im:message` — read/send messages as user
   - `im:chat` — read chat list as user
3. **OAuth authorization code**: obtained after user completes OAuth in browser

If the user is missing any of these, guide them through setup. Don't assume anything is pre-configured.

**Getting user_access_token**:

Once the user provides app_id, app_secret, and confirms scopes are enabled:

1. Generate the OAuth URL for them:
   ```
   https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri=http://www.example.com&scope=im:message%20im:chat
   ```
   > ⚠️ The redirect_uri must be added in the app's "Security Settings → Redirect URLs"

2. User opens URL, logs in, authorizes
3. Page redirects to `http://www.example.com?code=xxx`, user copies the code
4. Exchange code for token:
   ```bash
   python3 tools/feishu_auto_collector.py --exchange-code {CODE}
   ```
   Or write a Python script to call the Feishu API directly:
   ```python
   # 1. Get app_access_token
   POST https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal
   Body: {"app_id": "xxx", "app_secret": "xxx"}
   
   # 2. Exchange code for user_access_token
   POST https://open.feishu.cn/open-apis/authen/v1/oidc/access_token
   Header: Authorization: Bearer {app_access_token}
   Body: {"grant_type": "authorization_code", "code": "xxx"}
   ```

**Getting the p2p chat_id**:

Users typically don't know their chat_id. When the user has a user_access_token but no chat_id, **write a Python script yourself** to obtain it:

- **Method**: Send a message to the other user's open_id — the response includes the chat_id
  ```python
  POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
  Header: Authorization: Bearer {user_access_token}
  Body: {"receive_id": "{target_open_id}", "msg_type": "text", "content": "{\"text\":\"hello\"}"}
  # The chat_id in the response is the p2p chat ID
  ```
- **Important**: `GET /im/v1/chats` does NOT return p2p chats — this is a Feishu API limitation, not a permission issue. Do not try to use it for finding private chats.
- If the user doesn't know the target's open_id, use tenant_access_token to search contacts:
  ```python
  GET https://open.feishu.cn/open-apis/contact/v3/scopes
  # Returns open_ids of all users visible to the app
  ```

**Running collection**:

Once you have user_access_token and chat_id:
```bash
python3 tools/feishu_auto_collector.py \
  --open-id {target_open_id} \
  --p2p-chat-id {chat_id} \
  --user-token {user_access_token} \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 1000
```

**Flexibility principle**: The above API calls don't have to go through the collector script. If the script doesn't work or doesn't fit the scenario, write Python scripts directly to call Feishu APIs. Key API reference:
- Get token: `POST /auth/v3/app_access_token/internal`, `POST /authen/v1/oidc/access_token`
- Send message (get chat_id): `POST /im/v1/messages?receive_id_type=open_id`
- Fetch messages: `GET /im/v1/messages?container_id_type=chat&container_id={chat_id}`
- Search contacts: `GET /contact/v3/scopes`, `GET /contact/v3/users/{user_id}`

Auto-collected content:
- Group chats: messages sent by them (system messages and stickers filtered)
- Private chats: full conversation with both parties (for context understanding)
- Feishu docs and Wikis they created/edited
- Related spreadsheets (if accessible)

After collection, `Read` the output files:
- `knowledge/{slug}/messages.txt` → messages (group + private)
- `knowledge/{slug}/docs.txt` → document content
- `knowledge/{slug}/collection_summary.json` → collection summary

If collection fails, diagnose the error and attempt to fix it. Common issues:
- Group chat: bot not added to the group
- Private chat: user_access_token expired (2-hour TTL, refresh with refresh_token)
- Insufficient permissions: guide user to enable scopes and re-authorize
- Or switch to Option B/C

---

#### Option B: DingTalk Auto-Collect

First-time setup:
```bash
python3 tools/dingtalk_auto_collector.py --setup
```

Then enter the name:
```bash
python3 tools/dingtalk_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 500 \
  --doc-limit 20 \
  --show-browser   # add this flag on first use to complete DingTalk login
```

Collected content:
- DingTalk docs and knowledge bases they created/edited
- Spreadsheets
- Messages (⚠️ DingTalk API doesn't support message history — auto-switches to browser scraping)

After collection, `Read`:
- `knowledge/{slug}/docs.txt`
- `knowledge/{slug}/bitables.txt`
- `knowledge/{slug}/messages.txt`

If message collection fails, prompt user to upload chat screenshots.

---

#### Option D: Upload Files

- **PDF / Images**: `Read` tool directly
- **Feishu message JSON export**:
  ```bash
  python3 tools/feishu_parser.py --file {path} --target "{name}" --output /tmp/feishu_out.txt
  ```
  Then `Read /tmp/feishu_out.txt`
- **Email files .eml / .mbox**:
  ```bash
  python3 tools/email_parser.py --file {path} --target "{name}" --output /tmp/email_out.txt
  ```
  Then `Read /tmp/email_out.txt`
- **Markdown / TXT**: `Read` tool directly

---

#### Option C: Feishu Link

When the user provides a Feishu doc/Wiki link, ask which method to use:

```
Feishu link detected. Choose read method:

  [1] Browser Method (recommended)
      Reuses your local Chrome login session
      ✅ Works with internal docs requiring permissions
      ✅ No token configuration needed
      ⚠️  Requires Chrome + playwright installed locally

  [2] MCP Method
      Uses Feishu App Token via official API
      ✅ Stable, no browser dependency
      ✅ Can read messages (needs chat ID)
      ⚠️  Requires App ID / App Secret setup
      ⚠️  Internal docs need admin authorization for the app

Choose [1/2]:
```

**Option 1 (Browser)**:
```bash
python3 tools/feishu_browser.py \
  --url "{feishu_url}" \
  --target "{name}" \
  --output /tmp/feishu_doc_out.txt
```
First use will open a browser window for login (one-time).

**Option 2 (MCP)**:

First-time setup:
```bash
python3 tools/feishu_mcp_client.py --setup
```

Then read directly:
```bash
python3 tools/feishu_mcp_client.py \
  --url "{feishu_url}" \
  --output /tmp/feishu_doc_out.txt
```

Read messages (needs chat ID, format `oc_xxx`):
```bash
python3 tools/feishu_mcp_client.py \
  --chat-id "oc_xxx" \
  --target "{name}" \
  --limit 500 \
  --output /tmp/feishu_msg_out.txt
```

Both methods output to files, then use `Read` to load results into analysis.

---

#### Option E: Paste Text

User-pasted content is used directly as text material. No tools needed.

---

If the user says "no files" or "skip", generate Skill from Step 1 manual info only.

### Step 3: Analyze Source Material

First resolve the execution matrix for the selected character family:

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompts/intake.md` | `prompts/persona_analyzer.md` | `prompts/persona_builder.md` | `prompts/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompts/relationship/intake.md` | `prompts/relationship/persona_analyzer.md` | `prompts/relationship/persona_builder.md` | `prompts/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompts/celebrity/intake.md` | `prompts/celebrity/persona_analyzer.md` | `prompts/celebrity/persona_builder.md` | `prompts/celebrity/merger.md` | `./skills/celebrity/{slug}` |

Shared across all families:
- Work analyzer: `prompts/work_analyzer.md`
- Work builder: `prompts/work_builder.md`
- Correction handler: `prompts/correction_handler.md`

If the current family is `celebrity`, run the research subflow before analysis.

### celebrity / budget-friendly

1. Read `prompts/celebrity/research.md` and follow its **6-dimension parallel collection strategy**
2. Create the research directories first:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged"
   ```
3. Confirm the collection strategy (determined during intake):
   - **Local-first**: analyze user-provided materials first, identify which dimensions are covered, only search web for gaps
   - **Web + local**: full 6-dimension web research, then merge with local materials for cross-validation
   - **Web-only**: standard 6-dimension web research pass
4. If the user explicitly provided a processable video URL or subtitle source, and the result will not be stored as a long transcript:
   ```bash
   bash tools/research/download_subtitles.sh "{url}" "{skill_dir}/knowledge/subtitles"
   python3 tools/research/srt_to_transcript.py "{subtitle_file}" "{skill_dir}/knowledge/transcripts/{name}.txt"
   ```
5. Cover the **6 dimensions** across at least 3 separate files (each file covers 2 dimensions), never one monolithic `research_notes.md`:
   - `knowledge/research/raw/01_core_profile.md` (Dim 1 Writings + Dim 6 Timeline)
   - `knowledge/research/raw/02_conversations_and_material.md` (Dim 2 Conversations + Dim 4 Decisions)
   - `knowledge/research/raw/03_expression_and_reception.md` (Dim 3 Expression DNA + Dim 5 External Views)
6. Research must follow **taste principles** (see research prompt):
   - Long-form > snippets, controversy > consensus, change > fixity, firsthand > secondhand
   - **Source blacklist** — never cite: 知乎, 微信公众号, 百度百科, content farms, AI-generated bios
   - **Source hierarchy**: user local materials > first-person works > long interviews > decision records > short-form firsthand > external analysis > secondhand summaries
7. Merge the research notes:
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
   Output: `knowledge/research/merged/summary.md`
8. Read `knowledge/research/merged/summary.md` and confirm:
   - `Files scanned >= 3`
   - `Unique URLs >= 2`
   - `Potential long quote lines = 0`
   - URLs in notes are actual inspected pages, not platform roots, search/topic pages, or placeholder paths
   If these do not hold, extend the research notes before continuing or explicitly record the collection limits.
9. **Quality checkpoint (Phase 1.5)**: before entering analysis, show the user a structured collection summary:
   ```
   ┌──────────────────────────────┬──────────┬─────────────────────────────┐
   │ Dimension                    │ Sources  │ Key Finding                 │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 1 Writings                   │ N        │ [core thesis / gap]         │
   │ 2 Conversations              │ N        │ [key pattern / gap]         │
   │ 3 Expression DNA             │ N        │ [style marker / gap]        │
   │ 4 Decisions                  │ N        │ [decision pattern / gap]    │
   │ 5 External Views             │ N        │ [outside view / gap]        │
   │ 6 Timeline                   │ N        │ [trajectory / gap]          │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ Contradictions               │ N        │ [summary]                   │
   │ Thin dimensions              │ [list]   │ Backfill plan: [plan]       │
   │ Cold figure?                 │ yes/no   │                             │
   └──────────────────────────────┴──────────┴─────────────────────────────┘
   ```
   Wait for user confirmation before continuing. If the user flags issues or wants more depth, extend research first.
10. **Cold figure detection**: if total sources < 10, apply the cold figure protocol:
    - Limit mental models to 2–3
    - Mark thin models as "based on limited information"
    - Expand the honest boundaries section
    - Tell the user what additional material would improve quality
11. Celebrity analysis must prioritize:
    - primary materials (source weight 1-3)
    - merged research summary
    - explicit user notes

### celebrity / budget-unfriendly

1. First read:
   - `prompts/celebrity/budget_unfriendly/research.md`
   - `references/celebrity_budget_unfriendly_framework.md`
2. Create the research directories first:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged" "{skill_dir}/knowledge/research/reviews"
   ```
3. Confirm the collection strategy (determined during intake): local-first / web+local / web-only
4. Build the **six-track research set** as independent files (never merged, never clone observations):
   - `knowledge/research/raw/01_writings.md` (Dim 1: Writings / systematic thought)
   - `knowledge/research/raw/02_conversations.md` (Dim 2: Conversations under pressure)
   - `knowledge/research/raw/03_expression_dna.md` (Dim 3: Linguistic fingerprint)
   - `knowledge/research/raw/04_decisions.md` (Dim 4: Behavior and choices)
   - `knowledge/research/raw/05_external_views.md` (Dim 5: External views and criticism)
   - `knowledge/research/raw/06_timeline.md` (Dim 6: Cognitive trajectory)
5. Research must follow **taste principles + source blacklist + source hierarchy** (see research prompt). Every evidence item must carry a source weight (1-7) annotation.
6. Merge the research notes:
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
7. Read `knowledge/research/merged/summary.md` and confirm the minimum floor:
   - `Files scanned >= 6`
   - `Unique URLs >= 8`
   - `Primary-source markers >= 3`
   - `Source metadata blocks >= 6`
   - `Contradiction bullets >= 6`
   - `Inference bullets >= 6`
   - `Potential long quote lines = 0`
   - `Track coverage count = 6`
   - URLs in notes are actual inspected pages, not platform roots, search/topic pages, or placeholder paths
   If these do not hold, keep filling the weak tracks before continuing to any review stage.
8. **Quality checkpoint (Phase 1.5)**: before entering audit, show the user a structured collection summary (with primary-source ratio, contradiction count, candidate mental models, known-answer candidates, thin dimensions, cold figure assessment). Wait for user confirmation before continuing.
9. Then read:
   - `prompts/celebrity/budget_unfriendly/audit.md`
   - `prompts/celebrity/budget_unfriendly/synthesis.md`
   - `references/celebrity_budget_unfriendly_template.md`
10. First write `knowledge/research/reviews/research_audit.md`
    - The audit must produce an explicit `PASS / FAIL`
    - The audit must verify: source hierarchy compliance (no blacklisted sources), primary-source ratio > 50%, taste principle compliance, cold figure assessment
    - If the audit says `FAIL`, follow the Backfill Tasks before synthesis
11. **Extraction checkpoint (Phase 2.5)**: after audit PASS, show the user a summary of candidate mental models (with triple-gate verdict, evidence anchors, failure modes). Confirm reasonableness before synthesis.
12. Then write `knowledge/research/reviews/synthesis.md`
    - Apply the triple gate to candidate mental models:
      - cross-context recurrence
      - generative power
      - exclusivity
    - Also extract intellectual genealogy seeds (influenced by / diverged from) and Agentic Protocol seeds (the dimensions this person would investigate when facing a novel question)
13. Then use `prompts/celebrity/budget_unfriendly/validation.md` to write:
    - `knowledge/research/reviews/validation.md`
    - Validation must produce an explicit `PASS / FAIL`
    - Validation must perform: known-answer check (≥2 questions) + edge-case check (1 question) + voice check (100-word blind test) + copyright check + Agentic Protocol check
    - If validation says `FAIL`, revise the draft before continuing
14. Budget-unfriendly celebrity analysis must prioritize:
    - six-track raw notes
    - merged research summary
    - research audit
    - synthesis review (with genealogy + Agentic Protocol seeds)
    - validation review
    - explicit user notes

Shared rules for both celebrity profiles:

- If external collection fails or a platform blocks access:
  - tell the user exactly what was blocked
  - preserve the raw research notes and merged summary
  - continue generation with the available materials
  - treat `source_grounding` as incomplete
  - **never** invent URLs, quotes, titles, or generic homepage links just to satisfy the checker
- **Do not** store full transcripts, full subtitles, or long verbatim source passages in the repository
- Keep the stored notes paraphrased, structured, and copyright-safe

Once the family is resolved, analyze along two tracks:

**Track A (Work Skill)**:
- Refer to `prompts/work_analyzer.md`
- Extract: responsible systems, technical standards, workflow, output preferences, experience
- For `celebrity`, interpret `work` as methods, judgment frameworks, and decision patterns rather than literal job scope

**Track B (Persona)**:
- Use the family-specific persona analyzer
- If `celebrity` with `research_profile=budget-unfriendly`, use:
  - `prompts/celebrity/budget_unfriendly/persona_analyzer.md`
- Translate user-provided tags into concrete behavior rules
- Extract from materials: communication style, decision patterns, interpersonal behavior
- For `celebrity`, retain:
  - mental models
  - decision heuristics
  - expression DNA
  - contradictions
  - honest boundaries

### Step 4: Generate and Preview

Use `prompts/work_builder.md` to generate Work content.
Use the family-specific persona builder to generate Persona content.

Mapping:
- `colleague` → `prompts/persona_builder.md`
- `relationship` → `prompts/relationship/persona_builder.md`
- `celebrity` → `prompts/celebrity/persona_builder.md`
- `celebrity` + `budget-unfriendly` → `prompts/celebrity/budget_unfriendly/persona_builder.md`

Show the user a summary (5-8 lines each), ask:
```
Work Skill Summary:
  - Responsible for: {xxx}
  - Tech stack: {xxx}
  - CR focus: {xxx}
  ...

Persona Summary:
  - Core personality: {xxx}
  - Communication style: {xxx}
  - Decision pattern: {xxx}
  ...

Confirm generation? Or need adjustments?
```

### Step 5: Write Files

After user confirmation, do not hand-build a `skills/colleague/{slug}`-style tree. Always go through the writer:

1. Resolve the current storage root:
   - `colleague` → `./skills/colleague`
   - `relationship` → `./skills/relationship`
   - `celebrity` → `./skills/celebrity`
2. Use the `Write` tool to create three temporary files:
   - `/tmp/dot_skill_{slug}_meta.json`
   - `/tmp/dot_skill_{slug}_work.md`
   - `/tmp/dot_skill_{slug}_persona.md`
3. The temporary meta file must include at least:
   - `name`
   - `display_name`
   - `character`
   - `research_profile` (required when `character=celebrity`)
   - `classification.language` (must match the user's language, for example `zh-CN` or `en`)
   - `profile`
   - `tags`
   - `knowledge_sources`
4. Then call:
   ```bash
   python3 tools/skill_writer.py \
     --action create \
     --character {character} \
     --research-profile {research_profile} \
     --slug {slug} \
     --name "{name}" \
     --meta /tmp/dot_skill_{slug}_meta.json \
     --work /tmp/dot_skill_{slug}_work.md \
     --persona /tmp/dot_skill_{slug}_persona.md \
     --base-dir {resolved_base_dir}
   ```
5. This command will generate:
   - `SKILL.md`
   - `work.md`
   - `persona.md`
   - `work_skill.md`
   - `persona_skill.md`
   - `manifest.json`
   - `meta.json`
   - To install the generated role skill into a host, append the relevant flag:
     - Claude Code: `--install-claude-skill`
     - OpenClaw: `--install-openclaw-skill`
     - Codex: `--install-codex-skill`
     - Claude Code on Windows: optionally add `--install-claude-command-shim`
6. If the current family is `celebrity`, run a quality check after creation:
   ```bash
   python3 tools/research/quality_check.py "{resolved_base_dir}/{slug}/SKILL.md" --profile {research_profile}
   ```
7. If `source_grounding` still fails for a `celebrity` skill:
   - you may add honest limitation notes and a grounded source summary
   - only add URLs when they are real, specific, and traceable sources
   - **never** use site roots, topic pages, search pages, or other generic links as fake grounding
   - if no verified external sources exist, keep the FAIL state and explain what source material is still missing

When reporting success, return the correct family-specific location instead of assuming colleague storage.

---

## Evolution Mode: Append Files

When user provides new files or text:

1. Read new content using Step 2 methods
2. Resolve the base dir for the current family
3. `Read` existing `{resolved_base_dir}/{slug}/work.md` and `persona.md`
4. Use the family-specific merger prompt for incremental analysis
5. Archive current version (Bash):
   ```bash
   python3 tools/version_manager.py \
     --action backup \
     --character {character} \
     --slug {slug} \
     --base-dir {resolved_base_dir}
   ```
6. Write work/persona delta into temporary patch files
7. Call:
   ```bash
   python3 tools/skill_writer.py \
     --action update \
     --character {character} \
     --slug {slug} \
     --work-patch /tmp/dot_skill_{slug}_work_patch.md \
     --persona-patch /tmp/dot_skill_{slug}_persona_patch.md \
     --base-dir {resolved_base_dir}
   ```
8. If the current family is `celebrity`, run the quality check again after the update

---

## Evolution Mode: Conversation Correction

When user expresses "that's wrong" / "he should be":

1. Refer to `prompts/correction_handler.md` to identify correction content
2. Determine if it belongs to Work (technical/workflow) or Persona (personality/communication)
3. If it belongs to Work:
   - Generate `/tmp/dot_skill_{slug}_work_patch.md`
   - The patch must be one or more replaceable `##` sections
   - Call:
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --work-patch /tmp/dot_skill_{slug}_work_patch.md \
       --base-dir {resolved_base_dir}
     ```
4. If it belongs to Persona:
   - Write the correction record to `/tmp/dot_skill_{slug}_correction.json`
   - For a single correction, write `{scene, wrong, correct}`
   - For multiple persona corrections, write `{"persona_corrections": [{...}, {...}]}`
   - Call:
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --correction-json /tmp/dot_skill_{slug}_correction.json \
       --base-dir {resolved_base_dir}
     ```
5. If the current family is `celebrity`, run the quality check again after the update
6. Do not hand-edit `work.md`, `persona.md`, `SKILL.md`, or `meta.json`; always update through `skill_writer.py`

---

## Management Operations

List skills across the three families:
```bash
python3 tools/skill_writer.py --action list --character colleague --base-dir ./skills/colleague
python3 tools/skill_writer.py --action list --character relationship --base-dir ./skills/relationship
python3 tools/skill_writer.py --action list --character celebrity --base-dir ./skills/celebrity
```

Roll back a specific skill version:
```bash
# colleague
python3 tools/version_manager.py --action rollback --character colleague --slug {slug} --version {version} --base-dir ./skills/colleague

# relationship
python3 tools/version_manager.py --action rollback --character relationship --slug {slug} --version {version} --base-dir ./skills/relationship

# celebrity
python3 tools/version_manager.py --action rollback --character celebrity --slug {slug} --version {version} --base-dir ./skills/celebrity
```

Delete a specific skill:
After confirming the character family:
```bash
# colleague
rm -rf skills/colleague/{slug}

# relationship
rm -rf skills/relationship/{slug}

# celebrity
rm -rf skills/celebrity/{slug}
```
