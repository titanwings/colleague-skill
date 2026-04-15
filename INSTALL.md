# colleague.skill Installation Guide

---

## Choose Your Platform

### A. Claude Code (recommended)

This project follows the official [AgentSkills](https://agentskills.io) standard. The entire repository is the skill directory, so you only need to clone it into Claude's skills path:

```bash
# Must be run at the git repository root
cd "$(git rev-parse --show-toplevel)"

# Option 1: install into the current project
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# Option 2: install globally for all projects
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

Then invoke `/create-colleague` inside Claude Code.

Generated colleague skills are written to `./colleagues/` by default.

---

### B. OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

Restart the OpenClaw session, then run `/create-colleague`.

---

## Install Dependencies

```bash
# Base requirements (Python 3.9+)
pip3 install pypinyin        # Optional but recommended for Chinese-name slug generation

# Feishu browser method (for internal docs / docs requiring login)
pip3 install playwright
playwright install chromium  # Chromium is enough; full Chrome is not required

# Feishu MCP method (for app-authorized document access)
npm install -g feishu-mcp    # Requires Node.js 16+

# Optional format support
pip3 install python-docx     # Convert Word .docx to text
pip3 install openpyxl        # Convert Excel .xlsx to CSV
```

### Which collector should you use?

| Scenario | Recommended Tool |
|----------|------------------|
| Feishu user with app permissions | `feishu_auto_collector.py` |
| Feishu internal doc without app permissions | `feishu_browser.py` |
| Manually provided Feishu link | `feishu_mcp_client.py` |
| DingTalk user | `dingtalk_auto_collector.py` |
| DingTalk message collection fails | upload screenshots manually |
| Slack user | `slack_auto_collector.py` |

**Initialize Feishu auto-collection**

```bash
python3 tools/feishu_auto_collector.py --setup
# Enter the App ID and App Secret from Feishu Open Platform
```

**Initialize DingTalk auto-collection**

```bash
python3 tools/dingtalk_auto_collector.py --setup
# Enter the AppKey and AppSecret from DingTalk Open Platform
# Add --show-browser on first run to complete the DingTalk login flow
```

**Initialize Feishu MCP** (used for manually provided links)

```bash
python3 tools/feishu_mcp_client.py --setup
```

**Use the Feishu browser method** (first run opens a login window, later runs reuse the session)

```bash
python3 tools/feishu_browser.py \
  --url "https://xxx.feishu.cn/wiki/xxx" \
  --show-browser
```

**Initialize Slack auto-collection**

```bash
pip3 install slack-sdk
python3 tools/slack_auto_collector.py --setup
# Paste the Bot User OAuth Token (xoxb-...)
```

See the [Slack Auto-Collection Setup](#slack-auto-collection-setup) section below for detailed Slack steps.

---

## Slack Auto-Collection Setup

### Prerequisites

- Python 3.9+
- A Slack workspace
- Admin permission to install the app, or access to someone who can install it
- `pip3 install slack-sdk`

> On free Slack workspaces, only the most recent 90 days of messages are available. Paid plans do not have this limit.

---

### Step 1: Create a Slack app

1. Go to `https://api.slack.com/apps`
2. Click **Create New App**
3. Choose **From scratch**
4. Give the app a name such as `colleague-skill-bot`
5. Select the target workspace and create the app

---

### Step 2: Configure Bot Token Scopes

In **OAuth & Permissions** -> **Bot Token Scopes**, add:

| Scope | Purpose |
|-------|---------|
| `users:read` | Search for users |
| `channels:read` | List public channels |
| `channels:history` | Read public-channel history |
| `groups:read` | List private channels |
| `groups:history` | Read private-channel history |
| `mpim:read` | List group DMs |
| `mpim:history` | Read group-DM history |
| `im:read` | List DMs (optional, requires user authorization) |
| `im:history` | Read DM history (optional, requires user authorization) |

---

### Step 3: Install the app into the workspace

1. Stay on **OAuth & Permissions**
2. Click **Install to Workspace**
3. After approval, copy the **Bot User OAuth Token** (`xoxb-...`)

---

### Step 4: Invite the bot into target channels

The bot can only read channels it has joined. In each target channel, run:

```text
/invite @your-bot-name
```

If you do not yet know which channels the person is in, you can skip this first. The collector will tell you which channels it can see, and you can invite the bot afterward.

---

### Step 5: Run the setup wizard

```bash
python3 tools/slack_auto_collector.py --setup
```

Paste the bot token when prompted. It will be validated automatically and stored in `~/.colleague-skill/slack_config.json`.

Successful setup looks like this:

```text
Validating token ... OK
  Workspace: Your Company, Bot: colleague-skill-bot

Configuration saved to /Users/you/.colleague-skill/slack_config.json
```

---

### Step 6: Collect colleague data

```bash
# Basic usage
python3 tools/slack_auto_collector.py --name "john.doe"

# Custom output directory
python3 tools/slack_auto_collector.py --name "john.doe" --output-dir ./knowledge/john-doe

# Limit collection size for a large workspace
python3 tools/slack_auto_collector.py --name "john.doe" --msg-limit 500 --channel-limit 20
```

Output files:

```text
knowledge/john-doe/
├── messages.txt
└── collection_summary.json
```

---

### Common errors

| Error | Cause | Fix |
|------|------|-----|
| `missing_scope: channels:history` | Bot token is missing a required scope | Add the scope in Slack and reinstall the app |
| `invalid_auth` | Token is invalid or revoked | Run `--setup` again with a fresh token |
| `not_in_channel` | Bot was not invited into the channel | Run `/invite @bot` in Slack |
| User not found | Name is misspelled or does not match Slack | Try the Slack username, such as `john.doe` |
| Only 90 days of messages | Free plan limitation | Upgrade the workspace or add screenshots manually |
| Rate limited (429) | Too many requests | The script automatically waits and retries |

---

## Quick Verification

```bash
cd ~/.claude/skills/create-colleague

# Test the Feishu parser
python3 tools/feishu_parser.py --help

# Test the Slack collector
python3 tools/slack_auto_collector.py --help

# Test the email parser
python3 tools/email_parser.py --help

# List existing colleague skills
python3 tools/skill_writer.py --action list --base-dir ./colleagues
```

---

## Directory Layout

The entire repository is a single skill directory in AgentSkills format:

```text
colleague-skill/        # clone into .claude/skills/create-colleague/
├── SKILL.md            # skill entry point
├── prompts/            # analysis and generation prompt templates
├── tools/              # Python utilities
├── docs/               # documentation (PRD, roadmap, etc.)
│
└── colleagues/         # generated colleague skills (.gitignored)
    └── {slug}/
        ├── SKILL.md
        ├── work.md
        ├── persona.md
        ├── meta.json
        ├── versions/
        └── knowledge/
```
