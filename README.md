<div align="center">

# 🧬 dot-skill（同事.skill）

### *"You folks building LLMs are all code-sages! Flesh is weak! Ascend to cyberspace!"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://github.com/titanwings/colleague-skill)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/NVX66RxWZv)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;Your colleague quit, your mentor graduated, your teammate transferred — taking their whole playbook and context with them?<br>
💞 &nbsp;Your family, old friends, partner drifting apart — and you want to hold on to the way it felt to be with them?<br>
🌟 &nbsp;Your favorite author, idol, thinker you'll never meet — but you want to know what they'd say about your question?

</td></tr>
</table>

### ✨ dot-skill solves all three.

<br>

Upgraded from **colleague.skill** to **dot-skill** — not just colleagues, **anyone** can be distilled into a Skill

Colleagues · partners · family · old friends · idols · public figures · fictional characters — even yourself

**Source material + your description →  an AI Skill that genuinely thinks like them**
Thinks in their frame, speaks in their voice

<br>

[🆕 What's new](#-whats-new-in-this-major-release) · [📦 Data Sources](#-supported-data-sources) · [⚡ Install](#-install) · [🚀 Usage](#-usage) · [✨ Demo](#-demo) · [💬 Discord](https://discord.gg/NVX66RxWZv)

[**中文**](docs/lang/README_ZH.md) · [**Español**](docs/lang/README_ES.md) · [**Deutsch**](docs/lang/README_DE.md) · [**日本語**](docs/lang/README_JA.md) · [**Русский**](docs/lang/README_RU.md) · [**Português**](docs/lang/README_PT.md) · [**한국어**](docs/lang/README_KO.md)

</div>

---

<div align="center">

### 🎉 2026.04.19 Milestone — **dot-skill just hit 15k ⭐!**

Massive thanks to everyone who starred — we'll keep shipping, keep distilling.

</div>

> 📢 **2026.04.22 Update** — **WeChat group 9 is live!** Come hang out with the dot-skill community — share skills, discuss features, trade tips.
>
> <img src="docs/assets/wechat-group-qr-9.png" alt="dot-skill WeChat group QR" width="240">
>
> QR refreshes every 7 days (expires 2026-05-01) — if expired, ping me on Discord.

> 🗺️ **2026.04.13** — **dot-skill Roadmap is live!** colleague.skill is evolving into **dot-skill** — distill anyone, not just colleagues. 👉 **[Full Roadmap](ROADMAP.md)** · **[💬 Discord](https://discord.gg/NVX66RxWZv)**

> 🌐 **2026.04.07** — Community gallery is live! Any skill / meta-skill can drive traffic directly to your own GitHub repo. No middleman. 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings) · Powered by **Shanghai AI Lab · AI Safety Center**

</div>

---

## 🆕 What's new in this major release?

### 1️⃣ From colleague-skill to dot-skill

No longer only built around the "colleague" scenario. A unified `/dot-skill` entrypoint sits on a general-purpose skill engine — one engine distills anyone, instead of being a colleague-specific script.

### 2️⃣ Three character families

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
<td align="center"><sub>Coworkers · mentors · teammates · up/downstream partners</sub></td>
<td align="center"><sub>Exes · partners · parents · friends · close family</sub></td>
<td align="center"><sub>Public figures · creators · public voices · fictional characters</sub></td>
</tr>
<tr>
<td><sub>Work Skill + Persona two-layer architecture — learns both their technical standards and workflows, and their manner of speaking and workplace posture. Supports Feishu / DingTalk / Slack auto-collection.</sub></td>
<td><sub>🆕 <b>Photo-sharing feature coming soon</b> — your distilled relationship won't just reply to messages; it'll send photos and share slices of its day, the way a real person would.</sub></td>
<td><sub>Ships with a complete <b>six-dimension research toolchain</b> (subtitles → transcript cleanup → research merge → quality check). Not mimicking tone — reproducing their mental models and decision frameworks.</sub></td>
</tr>
</tbody>
</table>

Each family has its own prompt pipeline, source-collection strategy, and generation template.

### 3️⃣ More Agent hosts

The old version only ran in Claude Code. Now it's cross-host across four:

| Host | Description |
|------|-------------|
| 🟣 **Claude Code** | Native slash-command support |
| 🟠 **Hermes Agent** | One-command install, `/dot-skill` works directly |
| 🔵 **OpenClaw** | Fully compatible |
| ⚫ **Codex** | Invoke by skill name |

Generated character Skills can also be one-command installed into any host.

---

## 📦 Supported Data Sources

| Source | Messages | Docs / Wiki | Spreadsheets | Notes |
|--------|:--------:|:-----------:|:------------:|-------|
| 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
| 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
| 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
| 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg / PyWxDump / 留痕 |
| 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
| 📦 Feishu JSON export | ✅ | ✅ | — | Manual upload |
| ✉️ Email `.eml` / `.mbox` | ✅ | — | — | Manual upload |
| 📝 Markdown / direct paste | ✅ | ✅ | — | Manual input |

---

## ⚡ Install

It's 2026 — you have an Agent, let it install itself. Open your Claude Code / Hermes / OpenClaw / Codex and hand it this line:

> Install the dot-skill skill for me: `https://github.com/titanwings/colleague-skill`

The Agent will detect the current host's skills directory, clone the repo, and register the entrypoint. Once done, type `/dot-skill` in any host to launch.

<details>
<summary><b>🛠️ Want to install it yourself? Click for paths</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| Host | `<TARGET>` path |
|------|-----------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | After clone, run `python3 tools/install_hermes_skill.py --force` |

</details>

> For Feishu/DingTalk auto-collection credentials, publishing a generated character Skill to any host, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](INSTALL.md)**

---

## 🚀 Usage

In the host where dot-skill is installed, launch it — type `/dot-skill`, or just tell your Agent "start dot-skill".

It first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.

Then enter alias, basic profile, personality tags, and pick a data source. All fields can be skipped — even a description alone can generate a Skill.

Once created, invoke the generated Skill with `/{character}-{slug}`.

### 🎛️ Commands

| Command | Description |
|---------|-------------|
| `/dot-skill` | Canonical unified entrypoint |
| `/{character}-{slug}` | Invoke full Skill (Persona + Work) |
| `/{character}-{slug}-work` | Work capabilities only |
| `/{character}-{slug}-persona` | Persona only |
| `python3 tools/skill_writer.py --action list ...` | List generated Skills across all three families |
| `python3 tools/version_manager.py --action rollback ...` | Roll back a Skill version |

### 🔬 Celebrity Research Toolchain

The `celebrity` family ships with an end-to-end research toolchain, from subtitles to a finished draft:

```bash
# Download video subtitles
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# Subtitles → transcript
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# Merge research notes
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Quality check
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ Demo

One from each family.

<br>

### 🌟 celebrity — distilling Andrej Karpathy

> Six-dimension research: works · interviews · decisions · expression DNA · external evaluations · timeline<br>
> Case adapted from community work [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
User            ❯ Everyone's talking about Agents now — what do you think the 2026 AI Agent looks like?

celebrity.skill ❯ Everyone's doing demos, nobody's doing eval.
                  The Agent bottleneck was never model intelligence — it's scaffolding:
                  a strict evaluation harness, fine-grained error replay,
                  controllable tool-calling budgets, clean failure-mode analysis.
                  Most products are still stuck at "wrap an API + a few tools + a system prompt."
                  That's a demo, not an agent.
                  In 2026 I'm not betting on the strongest model — I'm betting on the best
                  scaffolding and the strictest eval.
```

<br>

### 🧑‍💼 colleague — distilling a ByteDance L2-1 backend

> Input: `ByteDance L2-1 backend engineer, INTJ, blame-shifter, ByteDance-style`

```
User            ❯ Can you review this API design?

colleague.skill ❯ Hold on — what's the impact? You haven't explained the context.
                  (after reading) N+1 query, fix it. Use the standard
                  {code, message, data} response format. That's the spec,
                  don't ask why.

User            ❯ This bug was introduced by you, right?

colleague.skill ❯ Does the timeline match? That feature touched multiple places,
                  there were other changes too.
```

<br>

### 💞 relationship — distilling someone you have a crush on

> Upload half a year of chat logs + "sensitive, quiet but stubborn, will actually reply seriously when it matters"

```
User               ❯ Did you think about me today?

relationship.skill ❯ ...I did, a little bit. Why are you asking?
```

<div align="center">

📚 More real-world cases in the **[community gallery](https://titanwings.github.io/colleague-skill-site/)** — 100+ skills and counting

</div>

---

## 🔧 Features

### 🧱 Generated Skill Structure

dot-skill uses **Persona** as the universal base, with family-specific modules layered on top:

| Family | Persona Content | Additional Modules |
|--------|-----------------|-------------------|
| 🧑‍💼 **colleague** | 6-layer personality: hard rules → identity → expression → decisions → interpersonal → Correction | ➕ **Work Skill**: scope, workflow, output preferences, experience knowledge base |
| 💞 **relationship** | Expression DNA · emotional triggers · conflict pattern · repair pattern | — |
| 🌟 **celebrity** | Mental models · decision heuristics · expression DNA · external-evaluation contrast | ➕ Six-dimension research dossier (works / interviews / decisions / timeline...) |

> **Execution**: Receive task → Persona decides attitude & tone → Additional modules fill in execution detail → Output in their voice

### 🧬 Evolution

- 📥 **Append files** → auto-analyze delta → merge into relevant sections, never overwrite existing conclusions
- 💬 **Conversation correction** → say "they wouldn't do that, they'd be xxx" → writes to the Correction layer, takes effect immediately
- 🕰️ **Version control** → auto-archive on every update, rollback to any previous version
- 🔬 **Celebrity research pipeline** → subtitles → transcript cleanup → six-dimension research → quality check

---

## 📂 Project Structure

This project follows the [AgentSkills](https://agentskills.io) open standard. The entire repo is a skill directory:

```
dot-skill/
├── SKILL.md                        # skill entry point (official frontmatter)
├── prompts/                        # prompt system across three families
│   ├── intake.md                   #   [colleague] info intake
│   ├── work_analyzer.md            #   [colleague] work capability extraction
│   ├── persona_analyzer.md         #   [colleague] personality extraction
│   ├── work_builder.md             #   [colleague] work.md generation
│   ├── persona_builder.md          #   [colleague] persona.md 6-layer structure
│   ├── merger.md                   #   [shared] incremental merge logic
│   ├── correction_handler.md       #   [shared] conversation correction
│   ├── relationship/               #   [relationship] emotion/conflict/repair prompts
│   └── celebrity/                  #   [celebrity] six-dimension research + mental-model prompts
├── tools/                          # Python tools
│   ├── feishu_auto_collector.py    #   [colleague] Feishu auto-collector
│   ├── dingtalk_auto_collector.py  #   [colleague] DingTalk auto-collector
│   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
│   ├── email_parser.py             #   [shared] email parser
│   ├── research/                   #   [celebrity] celebrity research toolchain
│   │   ├── download_subtitles.sh   #     subtitle download
│   │   ├── transcribe_audio.py     #     audio → text
│   │   ├── srt_to_transcript.py    #     subtitles → transcript
│   │   ├── merge_research.py       #     six-dimension research merge
│   │   └── quality_check.py        #     quality check
│   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
│   ├── skill_writer.py             #   [shared] skill file management
│   └── version_manager.py          #   [shared] version archive & rollback
├── skills/                         # generated Skills (gitignored)
│   ├── colleague/                  #   colleagues
│   ├── relationship/               #   close relationships
│   └── celebrity/                  #   public figures
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ Notes

**Source material quality = Skill quality** — and quality sources differ across families:

| Family | Source priority (high → low) |
|--------|------------------------------|
| 🧑‍💼 **colleague** | Their **own long-form writing** (design docs / review comments) **›** **decision-making replies** **›** casual group chat |
| 💞 **relationship** | Complete chat history **›** letters / social posts / diaries **›** third-party descriptions |
| 🌟 **celebrity** | First-person books / blogs / long interviews **›** decision records (launches, commits, Q&A) **›** third-party commentary |

- **colleague** Feishu auto-collection: requires adding the App bot to relevant group chats
- **relationship**: longer time spans are better; material covering both conflict and repair is ideal
- **celebrity**: avoid feeding only second-hand interpretations
- This is still a demo version — please file issues if you find bugs!

---

## 📄 Technical Report

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> This is the paper for **colleague.skill**, dot-skill's predecessor. It covers the Work Skill + Persona two-layer architecture, multi-source data collection, and Skill generation mechanics — the theoretical foundation for today's `colleague` family. Separate papers on the relationship / celebrity family extensions are planned.

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
