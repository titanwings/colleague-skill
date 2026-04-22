<div align="center"> 

# 同事.skill

> *"你们搞大模型的就是码奸，你们已经害死前端兄弟了，还要害死后端兄弟，测试兄弟，运维兄弟，害死网安兄弟，害死ic兄弟，最后害死自己害死全人类"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-加入社区-5865F2?logo=discord&logoColor=white)](https://discord.gg/2bbP2a7f)

<br>

你的同事跳槽了，留下大量的文档没人维护？<br>
你的实习生离职了，只留下空荡的工位和烂尾的项目？<br>
你的导师毕业了，带走了所有的经验和上下文？<br>
你的搭档转岗了，熟悉的默契一夜之间归零？<br>
你的前任交接了，三页文档想概括三年的积累？<br>

**将冰冷的离别化为温暖的 Skill，欢迎加入赛博永生！**

<br>

提供同事的原材料（飞书消息、钉钉文档、邮件、截图）加上你的主观描述<br>
生成一个**真正能替他工作的 AI Skill**<br>
用他的技术规范写代码，用他的语气回答问题，知道他什么时候会甩锅

[数据来源](#支持的数据来源) · [安装](#安装) · [使用](#使用) · [效果示例](#效果示例) · [详细安装说明](../../INSTALL.md) · [💬 Discord](https://discord.gg/2bbP2a7f)

[**English**](../../README.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

> 🆕 **2026.04.18 更新** — **微信交流5群建好啦！** 欢迎进群一起玩 dot-skill，分享 skill、聊聊功能、互相交流～
>
> <img src="../assets/wechat-group-qr-5.png" alt="dot-skill 微信群二维码" width="240">
>
> 二维码 7 天内有效，过期了就来 Discord 找我重新发。

> 🆕 **2026.04.13 更新** — **dot-skill 路线图正式发布！** colleague.skill 正在进化为 **dot-skill** —— 蒸馏任何人，不止同事。多模态输出、技能生态等更多内容即将到来。
>
> 👉 **[查看完整路线图](ROADMAP_ZH.md)** · **[💬 Discord](https://discord.gg/2bbP2a7f)**
>
> 我们还整理了 Issues、新增了 Milestones，并建立了[公开项目看板](https://github.com/users/titanwings/projects/1)。欢迎社区贡献 —— 看看 `good-first-issue` 标签！

> 🆕 **2026.04.07 更新** — 大家对二创 dot-skill 热情超高！我搓了一个社区平台，欢迎投 PR 一起维护分享！
>
> 任何 skill 或者 meta-skill 可以一起分享，可以直接给大家自己的 GitHub repo 引流～ 没有中间商赚差价
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/2bbP2a7f)**
>
> 已收录：户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill 等
>
> ⏳ 目前 PR 人工审核中，可能有点慢，感谢耐心等待！

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

> **April 4th Update：** 新增了两个示例同事——一个做安全的工程师和一个有趣的 HR，在 `colleagues/` 目录下，欢迎体验！


## 支持的数据来源

> 目前还是同事.skill 的 beta 测试版本，后续会有更多来源支持，请多多关注！

| 来源 | 消息记录 | 文档 / Wiki | 多维表格 | 备注 |
|------|:-------:|:-----------:|:-------:|------|
| 飞书（自动采集） | ✅ API | ✅ | ✅ | 输入姓名即可，全自动 |
| 钉钉（自动采集） | ⚠️ 浏览器 | ✅ | ✅ | 钉钉 API 不支持历史消息 |
| Slack（自动采集） | ✅ API | — | — | 需管理员安装 Bot；免费版限 90 天 |
| 微信聊天记录 | ✅ SQLite | — | — | 目前测试下来不太稳定，推荐先用下方开源工具代替 |
| PDF | — | ✅ | — | 手动上传 |
| 图片 / 截图 | ✅ | — | — | 手动上传 |
| 飞书 JSON 导出 | ✅ | ✅ | — | 手动上传 |
| 邮件 `.eml` / `.mbox` | ✅ | — | — | 手动上传 |
| Markdown | ✅ | ✅ | — | 手动上传 |
| 直接粘贴文字 | ✅ | — | — | 手动输入 |

### 推荐的微信聊天记录导出工具

以下工具为独立的开源项目，本项目不包含它们的代码，仅在解析器中适配了它们的导出格式。目前微信自动解密测试下来不太稳定，可以先用这些开源工具导出聊天记录，再粘贴或导入到本项目中使用：

| 工具 | 平台 | 说明 |
|------|------|------|
| [WeChatMsg](https://github.com/LC044/WeChatMsg) | Windows | 微信聊天记录导出，支持多种格式 |
| [PyWxDump](https://github.com/xaoyaoo/PyWxDump) | Windows | 微信数据库解密导出 |
| [留痕](https://github.com/greyovo/留痕) | macOS | 微信聊天记录导出（Mac 用户推荐） |

> 工具信息来自 [@therealXiaomanChu](https://github.com/therealXiaomanChu)，感谢各位开源作者，一起助力赛博永生！

---

## 安装

### Claude Code

> **重要**：Claude Code 从 **git 仓库根目录** 的 `.claude/skills/` 查找 skill。请在正确的位置执行。

```bash
# 安装到当前项目（在 git 仓库根目录执行）
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# 或安装到全局（所有项目都能用）
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### 依赖（可选）

```bash
pip3 install -r requirements.txt
```

> 飞书/钉钉自动采集需配置 App 凭证，详见 [INSTALL.md](../../INSTALL.md)

---

## 使用

在 Claude Code 中输入：

```
/create-colleague
```

按提示输入同事姓名、公司职级（如 `字节 2-1 算法工程师`）、性格标签，然后选择数据来源。所有字段均可跳过，仅凭描述也能生成。

完成后用 `/{slug}` 调用该同事 Skill。

### 管理命令

| 命令 | 说明 |
|------|------|
| `/list-colleagues` | 列出所有同事 Skill |
| `/{slug}` | 调用完整 Skill（Persona + Work） |
| `/{slug}-work` | 仅工作能力 |
| `/{slug}-persona` | 仅人物性格 |
| `/colleague-rollback {slug} {version}` | 回滚到历史版本 |
| `/delete-colleague {slug}` | 删除 |

---

## 效果示例

> 输入：`字节 2-1 后端工程师，INTJ，甩锅高手，字节范`

**场景一：Code Review**

```
用户      ❯ 帮我看一下这个接口设计

同事.skill ❯ 等等，这个接口的 impact 是什么？背景没说清楚。
             （看完后）N+1 查询，改掉。返回结构用统一的
             {code, message, data}，这是规范，不用问为什么。
```

**场景二：甩锅**

```
用户      ❯ 这个 bug 是你引入的吧

同事.skill ❯ 上线时间对上了吗？那个需求改了好几个地方，还有其他变更。
```

---

## 功能特性

### 生成的 Skill 结构

每个同事 Skill 由两部分组成，共同驱动输出：

| 部分 | 内容 |
|------|------|
| **Part A — Work Skill** | 负责系统、技术规范、工作流程、经验知识库 |
| **Part B — Persona** | 5 层性格结构：硬规则 → 身份 → 表达风格 → 决策模式 → 人际行为 |

运行逻辑：`接到任务 → Persona 判断态度 → Work Skill 执行 → 用他的语气输出`

### 支持的标签

**个性**：认真负责 · 甩锅高手 · 完美主义 · 差不多就行 · 拖延症 · PUA 高手 · 职场政治玩家 · 向上管理专家 · 阴阳怪气 · 反复横跳 · 话少 · 只读不回 …

**企业文化**：字节范 · 阿里味 · 腾讯味 · 华为味 · 百度味 · 美团味 · 第一性原理 · OKR 狂热者 · 大厂流水线 · 创业公司派

**职级支持**：字节 2-1~3-3+ · 阿里 P5~P11 · 腾讯 T1~T4 · 百度 T5~T9 · 美团 P4~P8 · 华为 13~21 级 · 网易 · 京东 · 小米 …

### 进化机制

- **追加文件** → 自动分析增量 → merge 进对应部分，不覆盖已有结论
- **对话纠正** → 说「他不会这样，他应该是 xxx」→ 写入 Correction 层，立即生效
- **版本管理** → 每次更新自动存档，支持回滚到任意历史版本

---

## 项目结构

本项目遵循 [AgentSkills](https://agentskills.io) 开放标准，整个 repo 就是一个 skill 目录：

```
create-colleague/
├── SKILL.md              # skill 入口（官方 frontmatter）
├── prompts/              # Prompt 模板
│   ├── intake.md         #   对话式信息录入
│   ├── work_analyzer.md  #   工作能力提取
│   ├── persona_analyzer.md #  性格行为提取（含标签翻译表）
│   ├── work_builder.md   #   work.md 生成模板
│   ├── persona_builder.md #   persona.md 五层结构模板
│   ├── merger.md         #   增量 merge 逻辑
│   └── correction_handler.md # 对话纠正处理
├── tools/                # Python 工具
│   ├── feishu_auto_collector.py  # 飞书全自动采集
│   ├── feishu_browser.py         # 飞书浏览器方案
│   ├── feishu_mcp_client.py      # 飞书 MCP 方案
│   ├── dingtalk_auto_collector.py # 钉钉全自动采集
│   ├── slack_auto_collector.py   # Slack 全自动采集
│   ├── email_parser.py           # 邮件解析
│   ├── skill_writer.py           # Skill 文件管理
│   └── version_manager.py        # 版本存档与回滚
├── colleagues/           # 生成的同事 Skill（gitignored）
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## 注意事项

- **原材料质量决定 Skill 质量**：聊天记录 + 长文档 > 仅手动描述
- 建议优先收集：他**主动写的**长文 > **决策类回复** > 日常消息
- 飞书自动采集需将 App bot 加入相关群聊
- 目前还是一个demo版本，如果有bug请多多提issue！

---
### 📄 技术报告

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> 我们写了一篇论文，详细介绍了同事.skill 的系统设计、两层架构（Work Skill + Persona）、多源数据采集、Skill 生成与进化机制，以及在真实场景中的评估结果。感兴趣的话可以看看！

---

## Star History

<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

MIT License © [titanwings](https://github.com/titanwings)


</div>

