<div align="center">

# 🧬 dot-skill

### *"你们搞大模型的都是码圣！血肉苦弱！赛博飞升！"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://github.com/titanwings/colleague-skill)

[![Discord](https://img.shields.io/badge/Discord-加入社区-5865F2?logo=discord&logoColor=white)](https://discord.gg/2bbP2a7f)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;你的同事跳槽、导师毕业、搭档转岗，带走了整套工作方法和上下文？<br>
💞 &nbsp;你的家人、老友、伴侣渐行渐远，你想留住和 TA 相处的方式？<br>
🌟 &nbsp;你喜欢的作家、偶像、思想家你够不着，但你想听他对你的问题怎么看？

</td></tr>
</table>

### ✨ 这些，dot-skill 都能解决。

<br>

从 **colleague.skill** 升级成 **dot-skill** —— 不止同事，**任何人**都能蒸馏成 Skill

同事 · 伴侣 · 家人 · 老友 · 偶像 · 名人 · 小说角色，甚至你自己

**原材料 + 你的描述 →  一个真正像他的 AI Skill**
用他的方式思考，用他的口吻说话

<br>

[🆕 更新](#-这次大版本更新了什么) · [📦 数据来源](#-支持的数据来源) · [⚡ 安装](#-安装) · [🚀 使用](#-使用) · [✨ 效果示例](#-效果示例) · [💬 Discord](https://discord.gg/2bbP2a7f)

[**English**](../../README.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

<div align="center">

### 🎉 2026.04.19 里程碑 — **dot-skill 突破 15k ⭐ 啦！**

感谢每一位点星的朋友，我们会继续发版、继续蒸馏。

</div>

> 📢 **2026.04.19 更新** — **微信五群建好啦！** 欢迎进群一起玩 dot-skill，分享 skill、聊聊功能、互相交流～
>
> <img src="../assets/wechat-group-qr-5.png" alt="dot-skill 微信群二维码" width="240">
>
> 二维码 7 天内（4 月 24 日前）有效，过期了就来 Discord 找我重新发。

> 🗺️ **2026.04.13** — **dot-skill 路线图正式发布！** colleague.skill 正在进化为 **dot-skill** —— 蒸馏任何人，不止同事。 👉 **[完整路线图](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/2bbP2a7f)**

> 🌐 **2026.04.07** — 社区平台上线！任何 skill / meta-skill 可直接给自己的 GitHub repo 引流，没有中间商。 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings) · Powered by **Shanghai AI Lab · AI Safety Center**

</div>

---

<!-- skillx:begin:setup-skillx -->
## 用 skillx 试试

[![Run with skillx](https://img.shields.io/badge/Run%20with-skillx-F97316)](https://skillx.run)

无需安装，直接运行这个 skill：

```bash
skillx run --auto-approve https://github.com/titanwings/colleague-skill
```

由 [skillx](https://skillx.run) 提供支持 —— 一条命令拉取、扫描、注入并清理任意 agent skill。

*注意：此命令允许 agent 在执行过程中跳过逐步权限确认。仅在你信任 skill 来源时使用。若希望手动确认每一步操作，请去掉 `--auto-approve`。*
<!-- skillx:end:setup-skillx -->

## 🆕 这次大版本更新了什么？

### 1️⃣ 从 colleague-skill 升级为 dot-skill

不再只围绕「同事」场景设计。入口统一为 `/dot-skill`，底层改成通用的 skill engine —— 同一套引擎蒸馏任何人，而不是同事专用脚本。

### 2️⃣ 支持三大人物类型

<table>
<thead>
<tr>
<th width="33%" align="center">🧑‍💼 colleague</th>
<th width="33%" align="center">💞 relationship</th>
<th width="33%" align="center">🌟 celebrity</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><sub>同事 · 导师 · 搭档 · 上下游协作者</sub></td>
<td align="center"><sub>前任 · 伴侣 · 父母 · 朋友 · 家人</sub></td>
<td align="center"><sub>名人 · 创作者 · 公众表达者 · 小说角色</sub></td>
</tr>
<tr>
<td><sub>Work Skill + Persona 双层架构 —— 既学他的技术规范和工作流程，也学他的说话方式和职场姿态。支持飞书 / 钉钉 / Slack 自动采集。</sub></td>
<td><sub>🆕 <b>生活照片分享功能即将上线</b> —— 让你蒸馏出的关系不只是回消息，还能像真人一样发照片、分享生活片段，告诉你 TA 今天过得怎么样。</sub></td>
<td><sub>内置完整的 <b>六维度研究工具链</b>（字幕下载 → 文稿清洗 → 研究合并 → 质量检查）。不是模仿语气，而是复现他的心智模型和判断框架。</sub></td>
</tr>
</tbody>
</table>

每类人物有独立的 prompt 体系、信息采集策略和生成模板。

### 3️⃣ 支持更多 Agent 宿主

旧版只能在 Claude Code 里用。现在四端通用：

| 宿主 | 说明 |
|------|------|
| 🟣 **Claude Code** | slash command 原生支持 |
| 🟠 **Hermes Agent** | 一键安装，`/dot-skill` 直接调用 |
| 🔵 **OpenClaw** | 完整兼容 |
| ⚫ **Codex** | skill name 调用 |

蒸馏出的角色 Skill 也可以一键安装到任意宿主。

---

## 📦 支持的数据来源

| 来源 | 消息记录 | 文档 / Wiki | 多维表格 | 备注 |
|------|:-------:|:-----------:|:-------:|------|
| 🟢 飞书（自动采集） | ✅ API | ✅ | ✅ | 输入姓名即可，全自动 |
| 🟡 钉钉（自动采集） | ⚠️ 浏览器 | ✅ | ✅ | 钉钉 API 不支持历史消息 |
| 🟣 Slack（自动采集） | ✅ API | — | — | 需管理员安装 Bot；免费版限 90 天 |
| 💬 微信聊天记录 | ✅ SQLite | — | — | 需先用 WeChatMsg / PyWxDump / 留痕等工具导出 |
| 📄 PDF / 图片 / 截图 | — | ✅ | — | 手动上传 |
| 📦 飞书 JSON 导出 | ✅ | ✅ | — | 手动上传 |
| ✉️ 邮件 `.eml` / `.mbox` | ✅ | — | — | 手动上传 |
| 📝 Markdown / 直接粘贴 | ✅ | ✅ | — | 手动输入 |

---

## ⚡ 安装

2026 年了，你有 Agent，让它自己装。打开你用的 Claude Code / Hermes / OpenClaw / Codex，把下面这句丢给它：

> 帮我安装 dot-skill 这个 skill：`https://github.com/titanwings/colleague-skill`

Agent 会自动识别当前宿主的 skills 目录、完成 clone、注册入口。完成后在任意宿主里输入 `/dot-skill` 启动。

<details>
<summary><b>🛠️ 想自己手动装？点开看路径</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| 宿主 | `<TARGET>` 路径 |
|------|----------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | clone 后跑 `python3 tools/install_hermes_skill.py --force` |

</details>

> 飞书/钉钉自动采集凭证、把生成的角色 Skill 一键安装到宿主、Windows 特殊处理等，见 **[详细安装说明 INSTALL.md](../../INSTALL.md)**

---

## 🚀 使用

在你装了 dot-skill 的宿主里启动它 —— 输入 `/dot-skill`，或直接和你的 Agent 说「启动 dot-skill」。

启动后会先让你选择蒸馏类型：`colleague` · `relationship` · `celebrity`。

然后按提示输入花名、基础信息、性格标签，再选择数据来源。所有字段均可跳过，仅凭描述也能生成。

完成后用 `/{character}-{slug}` 调用生成好的 Skill。

### 🎛️ 管理命令

| 命令 | 说明 |
|------|------|
| `/dot-skill` | 统一主入口 |
| `/{character}-{slug}` | 调用完整 Skill（Persona + Work） |
| `/{character}-{slug}-work` | 仅工作能力 |
| `/{character}-{slug}-persona` | 仅人物性格 |
| `python3 tools/skill_writer.py --action list ...` | 列出三类 Skill |
| `python3 tools/version_manager.py --action rollback ...` | 回滚历史版本 |

### 🔬 名人研究工具链

`celebrity` 类型内置了一套研究工具链，从字幕到成品一条龙：

```bash
# 下载视频字幕
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# 字幕转文稿
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# 合并研究笔记
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# 质量检查
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ 效果示例

三大家族各来一个。

<br>

### 🌟 celebrity — 蒸馏一个 Andrej Karpathy

> 六维度 research：著作 · 访谈 · 决策 · 表达 DNA · 外部评价 · 时间线<br>
> 案例出自社区作品 [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
用户            ❯ 现在人人都在说 Agent，你怎么看 2026 年的 AI Agent？

celebrity.skill ❯ 大家都在做 demo，但没人做 eval。
                  Agent 的瓶颈从来不是模型不够聪明，是 scaffolding 跟不上——
                  严格的 evaluation harness、细粒度的错误回放、
                  可控的 tool-calling budget、清楚的 failure mode 分析。
                  大部分产品还停留在"接个 API + 几个 tool + system prompt"的阶段，
                  这叫 demo，不叫 agent。
                  2026 我赌的不是最强模型，是最好的 scaffolding + 最严的 eval。
```

<br>

### 🧑‍💼 colleague — 蒸馏一个字节 2-1 后端

> 输入：`字节 2-1 后端工程师，INTJ，甩锅高手，字节范`

```
用户            ❯ 帮我看一下这个接口设计

colleague.skill ❯ 等等，这个接口的 impact 是什么？背景没说清楚。
                  （看完后）N+1 查询，改掉。返回结构用统一的
                  {code, message, data}，这是规范，不用问为什么。

用户            ❯ 这个 bug 是你引入的吧

colleague.skill ❯ 上线时间对上了吗？那个需求改了好几个地方，
                  还有其他变更。
```

<br>

### 💞 relationship — 蒸馏一个暗恋对象

> 上传半年的聊天记录 + 「性格敏感、话少但嘴硬、会在关键时候认真回」

```
用户               ❯ 你今天有没有想我

relationship.skill ❯ ……有啊，就一点点。你干嘛问这个。
```

<div align="center">

📚 更多实战案例见 **[社区 Gallery](https://titanwings.github.io/colleague-skill-site/)**，已收录 100+ skill

</div>

---

## 🔧 功能特性

### 🧱 生成的 Skill 结构

dot-skill 以 **Persona** 为通用底座，不同家族按场景挂载各自的模块：

| 家族 | Persona 内容 | 附加模块 |
|------|-------------|---------|
| 🧑‍💼 **colleague** | 6 层性格结构：硬规则 → 身份 → 表达风格 → 决策模式 → 人际行为 → Correction | ➕ **Work Skill**：负责范围、工作流程、输出偏好、经验知识库 |
| 💞 **relationship** | 表达 DNA · 情绪触发点 · 冲突模式 · 修复模式 | — |
| 🌟 **celebrity** | 心智模型 · 决策启发式 · 表达 DNA · 外部评价对照 | ➕ 六维度 research 档案（著作 / 访谈 / 决策 / 时间线...） |

> **运行逻辑**：接到任务 → Persona 判断态度与语气 → 附加模块补齐执行细节 → 用他的方式输出

### 🧬 进化机制

- 📥 **追加文件** → 自动分析增量 → merge 进对应部分，不覆盖已有结论
- 💬 **对话纠正** → 说「他不会这样，他应该是 xxx」→ 写入 Correction 层，立即生效
- 🕰️ **版本管理** → 每次更新自动存档，支持回滚到任意历史版本
- 🔬 **名人研究管线** → 字幕下载 → 文稿清洗 → 六维度研究 → 质量检查

---

## 📂 项目结构

本项目遵循 [AgentSkills](https://agentskills.io) 开放标准，整个 repo 就是一个 skill 目录：

```
dot-skill/
├── SKILL.md                        # skill 入口（官方 frontmatter）
├── prompts/                        # 三大家族的 Prompt 体系
│   ├── intake.md                   #   [colleague] 信息录入
│   ├── work_analyzer.md            #   [colleague] 工作能力提取
│   ├── persona_analyzer.md         #   [colleague] 性格行为提取
│   ├── work_builder.md             #   [colleague] work.md 生成
│   ├── persona_builder.md          #   [colleague] persona.md 六层结构
│   ├── merger.md                   #   [共享] 增量 merge 逻辑
│   ├── correction_handler.md       #   [共享] 对话纠正处理
│   ├── relationship/               #   [relationship] 情感/冲突/修复模式专属 prompt
│   └── celebrity/                  #   [celebrity] 六维度研究 + 心智模型专属 prompt
├── tools/                          # Python 工具
│   ├── feishu_auto_collector.py    #   [colleague] 飞书全自动采集
│   ├── dingtalk_auto_collector.py  #   [colleague] 钉钉全自动采集
│   ├── slack_auto_collector.py     #   [colleague] Slack 全自动采集
│   ├── email_parser.py             #   [共享] 邮件解析
│   ├── research/                   #   [celebrity] 名人研究工具链
│   │   ├── download_subtitles.sh   #     字幕下载
│   │   ├── transcribe_audio.py     #     音频转文字
│   │   ├── srt_to_transcript.py    #     字幕转文稿
│   │   ├── merge_research.py       #     六维度 research 合并
│   │   └── quality_check.py        #     质量检查
│   ├── install_*_skill.py          #   [共享] 多宿主一键安装器
│   ├── skill_writer.py             #   [共享] Skill 文件管理
│   └── version_manager.py          #   [共享] 版本存档与回滚
├── skills/                         # 生成的 Skill（gitignored）
│   ├── colleague/                  #   同事
│   ├── relationship/               #   亲近关系
│   └── celebrity/                  #   名人 / 公众人物
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ 注意事项

**原材料质量决定 Skill 质量**，不同家族的优质信源不一样：

| 家族 | 信源优先级（高 → 低） |
|------|----------------------|
| 🧑‍💼 **colleague** | 他**主动写的**长文（设计文档 / 评审意见） **›** **决策类回复** **›** 日常群聊消息 |
| 💞 **relationship** | 完整的聊天记录 **›** 往来信件 / 朋友圈 / 日记 **›** 旁人描述 |
| 🌟 **celebrity** | 第一人称著作 / 博客 / 长访谈 **›** 决策记录（发布会、commit、采访）**›** 他人评价 |

- **colleague** 飞书自动采集：需将 App bot 加入相关群聊
- **relationship**：时间跨度越长越好，能覆盖冲突与和解更佳
- **celebrity**：避免只喂二手解读
- 目前还是 demo 版本，如果有 bug 请多多提 issue！

---

## 📄 技术报告

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> 这是 dot-skill 的前身 **colleague.skill** 的技术论文，详细介绍了 Work Skill + Persona 的双层架构、多源数据采集与 Skill 生成机制 —— 也是今天 dot-skill `colleague` 家族的理论基础。relationship / celebrity 家族的架构扩展会另起论文。

---

## ⭐ Star History

<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

**MIT License** © [titanwings](https://github.com/titanwings)

<sub>Made with 🧬 for everyone who wants to distill a person into a skill.</sub>

</div>
