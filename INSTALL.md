# 同事.skill 安装说明

---

## 选择你的平台

### A. Claude Code（推荐）

本项目遵循官方 [AgentSkills](https://agentskills.io) 标准，整个 repo 就是 skill 目录。克隆到 Claude skills 目录即可：

```bash
# ⚠️ 必须在 git 仓库根目录执行！
cd $(git rev-parse --show-toplevel)

# 方式 1：安装到当前项目
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# 方式 2：安装到全局（所有项目都能用）
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

然后在 Claude Code 中说 `/create-colleague` 即可启动。

生成的同事 Skill 默认写入 `./colleagues/` 目录。

---

### B. OpenClaw

```bash
# 克隆到 OpenClaw 的 skills 目录
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

重启 OpenClaw session，说 `/create-colleague` 启动。

---

## 依赖安装

```bash
# 基础（Python 3.9+）
pip3 install pypinyin        # 中文姓名转拼音 slug（可选但推荐）

# 飞书浏览器方案（内部文档/需要登录权限的文档）
pip3 install playwright
playwright install chromium  # 仅需安装 chromium，不需要完整 Chrome

# 飞书 MCP 方案（公司授权文档，通过 App Token 读取）
npm install -g feishu-mcp    # 需要 Node.js 16+

# 其他格式支持（可选）
pip3 install python-docx     # Word .docx 转文本
pip3 install openpyxl        # Excel .xlsx 转 CSV
```

### 平台方案选择指南

| 场景 | 推荐方案 |
|------|---------|
| 飞书用户，有 App 权限 | `feishu_auto_collector.py` |
| 飞书内部文档（无 App 权限）| `feishu_browser.py` |
| 飞书手动指定链接 | `feishu_mcp_client.py` |
| 钉钉用户 | `dingtalk_auto_collector.py` |
| 钉钉消息采集失败 | 手动截图 → 上传图片 |
| Slack 用户 | `slack_auto_collector.py` |
| Confluence 用户 | `confluence_auto_collector.py` |

**飞书自动采集初始化**：
```bash
python3 tools/feishu_auto_collector.py --setup
# 输入飞书开放平台的 App ID 和 App Secret
```

**钉钉自动采集初始化**：
```bash
python3 tools/dingtalk_auto_collector.py --setup
# 输入钉钉开放平台的 AppKey 和 AppSecret
# 首次运行加 --show-browser 参数以完成钉钉登录
```

**飞书 MCP 初始化**（手动指定链接时使用）：
```bash
python3 tools/feishu_mcp_client.py --setup
```

**飞书浏览器方案**（首次使用会弹窗登录，之后自动复用登录态）：
```bash
python3 tools/feishu_browser.py \
  --url "https://xxx.feishu.cn/wiki/xxx" \
  --show-browser    # 首次使用加这个参数，登录后不再需要
```

**Slack 自动采集初始化**：
```bash
pip3 install slack-sdk
python3 tools/slack_auto_collector.py --setup
# 按提示输入 Bot User OAuth Token（xoxb-...）
```

> Slack 详细配置见下方「[Slack 自动采集配置](#slack-自动采集配置)」章节

**Confluence 自动采集初始化**：
```bash
python3 tools/confluence_auto_collector.py --setup
# 按提示选择 Cloud 或 Server/DC，输入 URL 和认证信息
```

> Confluence 详细配置见下方「[Confluence 自动采集配置](#confluence-自动采集配置)」章节

---

## Slack 自动采集配置

### 前置条件

- Python 3.9+
- Slack Workspace（需要**管理员权限**安装 App，或联系管理员帮你安装）
- `pip3 install slack-sdk`

> **免费版 Workspace 限制**：只能访问最近 **90 天**的消息记录。付费版（Pro / Business+ / Enterprise）无此限制。

---

### 步骤 1：创建 Slack App

1. 前往 [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. 选择 **From scratch**
3. 填写 App Name（如 `colleague-skill-bot`），选择目标 Workspace → **Create App**

---

### 步骤 2：配置 Bot Token Scopes

进入 **OAuth & Permissions** → **Bot Token Scopes** → **Add an OAuth Scope**，添加以下权限：

| Scope | 用途 |
|-------|------|
| `users:read` | 搜索用户列表（必需） |
| `channels:read` | 列出 public channels（必需） |
| `channels:history` | 读取 public channel 历史消息（必需） |
| `groups:read` | 列出 private channels（必需） |
| `groups:history` | 读取 private channel 历史消息（必需） |
| `mpim:read` | 列出群 DM（可选） |
| `mpim:history` | 读取群 DM 历史消息（可选） |
| `im:read` | 列出 DM（可选，需用户授权） |
| `im:history` | 读取 DM 历史消息（可选，需用户授权） |

---

### 步骤 3：安装 App 到 Workspace

1. 仍在 **OAuth & Permissions** 页面，点击 **Install to Workspace**
2. Workspace 管理员审批后，复制 **Bot User OAuth Token**（格式：`xoxb-...`）

---

### 步骤 4：将 Bot 加入目标频道

Bot 只能读取**它已加入**的频道。在 Slack 中，进入每个目标频道，输入：

```
/invite @your-bot-name
```

> 提示：如果你不知道目标同事在哪些频道，可以先不邀请，运行采集时脚本会告知 Bot 加入了哪些频道，再补充邀请。

---

### 步骤 5：运行配置向导

```bash
python3 tools/slack_auto_collector.py --setup
```

按提示粘贴 Bot Token，脚本会自动验证并保存到 `~/.colleague-skill/slack_config.json`。

配置成功后你会看到：
```
验证 Token ... OK
  Workspace：Your Company，Bot：colleague-skill-bot

✅ 配置已保存到 /Users/you/.colleague-skill/slack_config.json
```

---

### 步骤 6：采集同事数据

```bash
# 基本用法（输入同事的中文名或英文用户名）
python3 tools/slack_auto_collector.py --name "张三"
python3 tools/slack_auto_collector.py --name "john.doe"

# 指定输出目录
python3 tools/slack_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan

# 限制采集量（大 Workspace 建议先小量测试）
python3 tools/slack_auto_collector.py --name "张三" --msg-limit 500 --channel-limit 20
```

输出文件：
```
knowledge/张三/
├── messages.txt            # 按权重分类的消息记录
└── collection_summary.json # 采集摘要（用户信息、频道列表、时间）
```

---

### 常见报错与解决

| 报错 | 原因 | 解决 |
|------|------|------|
| `missing_scope: channels:history` | Bot Token 缺少权限 | 回到 api.slack.com → OAuth & Permissions 添加对应 Scope，重新安装 App |
| `invalid_auth` | Token 无效或已吊销 | 重新运行 `--setup` 配置新 Token |
| `not_in_channel` | Bot 未加入该频道 | 在 Slack 里 `/invite @bot` 邀请 Bot |
| 未找到用户 | 姓名拼写不对 | 改用英文用户名（如 `john.doe`）或 Slack display name |
| 消息只有 90 天 | 免费版限制 | 升级 Workspace 或手动补充截图 |
| 速率限制（429）| 请求太频繁 | 脚本会自动等待重试，无需手动处理 |

---

## Confluence 自动采集配置

### 前置条件

- Python 3.9+
- `pip3 install requests`（通常已安装）
- Confluence Cloud 或 Server/Data Center 的访问权限

---

### Confluence Cloud 配置

#### 步骤 1：创建 API Token

1. 前往 [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. 点击 **Create API token**
3. 填写标签名（如 `colleague-skill`）→ **Create**
4. 复制生成的 Token（只显示一次）

#### 步骤 2：运行配置向导

```bash
python3 tools/confluence_auto_collector.py --setup
```

选择 `[1] Confluence Cloud`，按提示输入：
- Confluence URL（如 `https://yourcompany.atlassian.net`）
- Atlassian 账号邮箱
- API Token

配置成功后会自动验证连接并保存到 `~/.colleague-skill/confluence_config.json`。

---

### Confluence Server / Data Center 配置

#### 方式 A：Personal Access Token（推荐）

1. 登录 Confluence → 右上角头像 → **Settings** → **Personal Access Tokens**
2. 点击 **Create token** → 填写名称 → **Create**
3. 复制 Token

#### 方式 B：用户名 + 密码

直接使用 Confluence 登录的用户名和密码。

#### 运行配置向导

```bash
python3 tools/confluence_auto_collector.py --setup
```

选择 `[2] Confluence Server / Data Center`，按提示输入 URL 和认证信息。

---

### 采集同事数据

```bash
# 基本用法
python3 tools/confluence_auto_collector.py --name "John Doe"

# 指定输出目录
python3 tools/confluence_auto_collector.py --name "john.doe" --output-dir ./knowledge/john

# 按 Space 过滤
python3 tools/confluence_auto_collector.py --name "John" --space-key DEV --doc-limit 30

# 调整采集量
python3 tools/confluence_auto_collector.py --name "John" --doc-limit 100 --comment-limit 500
```

输出文件：
```
knowledge/john/
├── docs.txt                # 页面内容（按长度分类）
├── messages.txt            # 评论内容（按长度分类）
└── collection_summary.json # 采集摘要
```

---

### 常见报错与解决

| 报错 | 原因 | 解决 |
|------|------|------|
| `Auth failed: Invalid credentials` | Token/密码无效 | 重新运行 `--setup` 配置 |
| `Permission denied` | 账号无权访问该 Space | 联系 Confluence 管理员授权 |
| `User not found` | 姓名不匹配 | 使用 Confluence 中显示的完整姓名或用户名 |
| `Connection failed` | URL 错误或网络问题 | 检查 Confluence URL 是否正确 |
| 速率限制（429）| 请求太频繁 | 脚本会自动等待重试，无需手动处理 |

---

## 快速验证

```bash
cd ~/.claude/skills/create-colleague   # 或你的项目 .claude/skills/create-colleague

# 测试飞书解析器
python3 tools/feishu_parser.py --help

# 测试 Slack 采集器
python3 tools/slack_auto_collector.py --help

# 测试 Confluence 采集器
python3 tools/confluence_auto_collector.py --help

# 测试邮件解析器
python3 tools/email_parser.py --help

# 列出已有同事 Skill
python3 tools/skill_writer.py --action list --base-dir ./colleagues
```

---

## 目录结构说明

本项目整个 repo 就是一个 skill 目录（AgentSkills 标准格式）：

```
colleague-skill/        ← clone 到 .claude/skills/create-colleague/
├── SKILL.md            # skill 入口（官方 frontmatter）
├── prompts/            # 分析和生成的 Prompt 模板
├── tools/              # Python 工具脚本
├── docs/               # 文档（PRD 等）
│
└── colleagues/         # 生成的同事 Skill 存放处（.gitignore 排除）
    └── {slug}/
        ├── SKILL.md            # 完整 Skill（Persona + Work）
        ├── work.md             # 仅工作能力
        ├── persona.md          # 仅人物性格
        ├── meta.json           # 元数据
        ├── versions/           # 历史版本
        └── knowledge/          # 原始材料归档
```
