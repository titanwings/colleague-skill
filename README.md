<div align="center">

<img src="docs/social-preview-distilly-v7.png" alt="Distilly — Distill how they think into Person Profiles for Agents" width="100%">

<br>

# Distilly

### Distill how they think into Person Profiles for Agents.

**Colleague Skill / colleague-skill (original name)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.19%2B-339933.svg)](https://nodejs.org/)
[![Codex Preview](https://img.shields.io/badge/Codex-Developer%20Preview-black)](https://github.com/titanwings/distilly/tree/distilly-plugin)

</div>

Distilly is a local-first product for turning a person's source material, working habits, judgment, and voice into a versioned **Person Profile for Agents**. The profile can be recalled temporarily during a run or explicitly installed as a long-lived host Skill. The storage authority stays local; no additional model API key is required.

This `distilly-plugin` branch carries the unreleased `0.1.0-preview.1` Developer Preview; the repository's default branch is `dot-skill`, the separate legacy implementation, so a bare clone lands on that line instead of this one. Codex, OpenClaw `2026.3.24`, and Hermes `v0.9.0` each have an immutable real-host transport-capacity fixture. The OpenClaw and Hermes measurements use a deterministic synthetic fixture server through the real host executable, model, and MCP transport; they do not by themselves certify packaged restart or the full product lifecycle. Setup remains fail-closed for any unrecorded host version or changed release tuple. This branch is not a tagged release or an npm package yet.

[Chinese](docs/lang/README_ZH.md) · [Español](docs/lang/README_ES.md) · [Deutsch](docs/lang/README_DE.md) · [日本語](docs/lang/README_JA.md) · [한국어](docs/lang/README_KO.md) · [Português](docs/lang/README_PT.md) · [Русский](docs/lang/README_RU.md)

## Install the Developer Preview

### For an agent

Give your coding agent the following task and let it run the commands in a fresh checkout:

> Install the Distilly Developer Preview from the `distilly-plugin` branch, build it with Node 22.19+ (or Node 24), run `distilly setup --host codex`, run `distilly doctor --host codex`, and report the result. Do not modify another branch.

The exact checkout and setup commands are shown below so the agent can verify every step.

### For a human

Requirements: Node.js `22.19+` or `24`, pnpm `10.32+`, and a locally installed Codex CLI. From a terminal:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Restart Codex after setup. The launcher registers the self-contained Plugin and its five MCP tools. To remove the host integration while keeping all local people, profiles, and source data:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

To install one approved profile as a persistent Skill after a profile has been created, use its exact subject id:

```bash
node packages/cli/lib/bin.js install subject_<32 lowercase hex characters> --host codex
```

## Host compatibility and explicit Legacy fallback

Codex uses the native Plugin preview above. The Preview also includes compatibility bindings for OpenClaw and Hermes:

- **OpenClaw** loads the Claude-compatible bundle from `~/.openclaw/extensions/distilly` and its real `.mcp.json`. Check discovery with `openclaw plugins inspect distilly --json`.
- **Hermes** installs the canonical Skill at `~/.hermes/skills/distilly`, a managed wrapper at `~/.distilly/bin/distilly-hermes`, and an MCP entry in `~/.hermes/config.yaml`. `resources` and `prompts` are disabled so the exposed surface remains five tools; check it with `hermes mcp test distilly`.

The CLI recognizes both hosts and enables setup when the installed version matches the recorded real-host transport fixture. The current net budgets, measured in isolated clean sessions with `openai-codex/gpt-5.4`, are 65,536 serialized bytes for OpenClaw and 49,752 for Hermes (the same conservative byte/token accounting used by the Codex fixture). These are transport/value lower bounds for the recorded probe, not a guarantee of remaining context in every model or user session. Any unrecorded version, release digest, tool descriptor, or serializer tuple returns `host_unsupported` before writing an unverified integration. There is no automatic switch to the legacy implementation.

Until a host has a verified Plugin binding, you can explicitly choose the maintained `dot-skill` branch as a **Legacy Skill compatibility mode**:

> Install Distilly in Legacy Skill compatibility mode from the `dot-skill` branch into this host's normal Skills directory, using a clean checkout whose final directory is named `distilly`. Verify discovery and report the installed Git commit. Do not run Plugin setup or claim SQLite, five-tool MCP, Panel, or Plugin lifecycle support.

For a manual install, replace `<target-directory>` with the complete final path in the [detailed install guide](INSTALL.md), including the last `distilly` component, and create its parent first:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git \
  <target-directory>
git -C <target-directory> rev-parse HEAD
```

This is an explicit, separate file-based implementation—not an automatic runtime fallback. It does not share a supported data model with the Plugin, and a failed Plugin preflight never switches modes. The compatibility promise currently covers local files and pasted text only. Do not enable legacy collectors while the Plugin uses the same home directory: current legacy collectors can write credential configuration into the same `~/.distilly/` namespace and remain outside the Preview's reviewed security boundary. Keep exactly one `distilly` active in any host discovery scope and verify which copy the host loaded.

## The first usable flow

On Codex, the complete flow below is verified. OpenClaw `2026.3.24` and Hermes `v0.9.0` have the same briefing transport path verified against their recorded capacity fixture; their packaged restart, long-lived Skill, and uninstall lifecycle checks remain separate. Restart the selected host and ask it to research and distill a person. Supply only the files, text, or public URLs you want included. Distilly then:

1. resolves or creates the person;
2. imports the selected material with deterministic local parsers;
3. creates a pending research job and a complete evidence-bound briefing;
4. commits a versioned Person Profile;
5. returns the profile or a complete temporary prompt for the current run;
6. accepts an explicit correction and sends a candidate to review;
7. lets you promote, reject, or roll back the candidate in the local Panel; and
8. installs the approved profile as a self-contained host Skill when you ask it to.

The direct-user surface around that flow is the same CLI on every host:

| Command | What it does |
| --- | --- |
| `distilly harvest <directory> --host <host> --name <name>` | stores a directory of local files as evidence, queues distillation, and is safe to repeat: a file whose bytes this person already stored is skipped, `--force` re-ingests it |
| `distilly import <directory> --host <host>` | migrates a store written by the older `dot-skill` release (a person folder, or a `skills/` tree of them) without modifying it |
| `distilly subjects --host <host>` | lists what this store knows, so no one has to remember a subject id |
| `distilly show <subject-id\|name> --host <host>` | prints the profile, its maturity, covered and missing core facets, and what material would cover each gap |
| `distilly versions` / `diff` / `rollback` | reads immutable version history, shows the semantic difference between two versions, and restores an earlier one as a new current version |
| `distilly install <subject-id\|name> --host <host>` | installs the profile as a person Skill; re-running after a re-distill updates it in place |
| `distilly personas` / `remove` | lists the person Skills installed for a host and removes one without touching the host integration |

The model-facing surface remains exactly five MCP tools:

`distilly_get` · `distilly_ingest` · `distilly_pending` · `distilly_commit` · `distilly_correct`

Distilly never silently truncates a complete briefing or profile prompt. If a verified host budget cannot carry the complete value, it reports a bounded capacity error with measurements and keeps the stored data unchanged.

## Host status

| Host | Native Plugin | Current compatibility route |
| --- | --- | --- |
| Codex | Fully verified in this release branch | Native Plugin |
| Claude Code | Binding verified against the real `2.1.268` binary: the host loads the plugin and reports our MCP server connected. No capacity fixture for that version yet, so setup needs `--allow-unverified-host` and runs on the conservative floor | Native Plugin |
| OpenClaw | Binding verified against the real `2026.9.2` binary: the host loads the bundle with `skills` + `mcpServers` and lists the Skill as ready. Capacity fixture recorded for `2026.3.24` (65,536-byte net budget); a fixture for `2026.9.2` still needs a measured model session | Native Plugin |
| Hermes | Lifecycle verified against a real `v0.19.0` install: install, doctor, MCP tool surface, persona install, and uninstall. Capacity fixture recorded for `v0.9.0` (49,752-byte net budget); the newer version runs on the conservative floor with an explicit `--allow-unverified-host` | Native Plugin |
| DeepSeek Harness (DSH) | Binding verified against the real harness: `dsh --profile distilly --dump-config` mounts our server, the MCP handshake exposes exactly five tools, and the full install/persona/uninstall cycle passes. No measured capacity fixture yet, so setup needs `--allow-unverified-host` | Native Plugin |
| Pi agent | Community binding planned | Explicit `dot-skill` Legacy Skill |
| Grok Build | Community binding planned | Explicit `dot-skill` Legacy Skill |
| OpenCode | Community binding planned | Explicit `dot-skill` Legacy Skill |
| Grok Bot | Community binding planned | Manual saved/private Skill only; local repository import is not claimed |

Host compatibility is a binding concern. Legacy Skill discovery is useful continuity, but it does not make a host a verified Plugin target.

## Local material formats

The Preview accepts explicit local `TXT`, `Markdown`, `JSON`, `EML`, `MBOX`/`MBX`, and `SRT`/`VTT` files. JSON chat exports from ChatGPT, Claude, Telegram, Slack, and Discord are recognized structurally and stored as transcripts with their participants; a renamed export still works, every omission (branches outside the conversation path, attachments, textless messages) is reported, and the rendered text keeps each message verbatim so claims can quote it. Email containers are parsed with their attachments skipped and reported.

A single parsed file larger than the per-material limit is split into consecutive parts at code point boundaries; joining the parts reproduces the canonical text, and a part never separates a character from its combining marks. A file whose whitespace run is longer than one material cannot become legal parts, so it is kept as raw evidence with a printed warning instead of failing the whole selection.

It also accepts pasted text and public URLs through the host's visible research flow. Files are read only from the paths or sources the user supplies; symlinked selected files and duplicate file names are rejected, and a file the person already stored is skipped unless `--force` is given. A store written by the older `dot-skill` release can be migrated with `distilly import`. PDF and hosted connectors remain follow-up work.

## 📣 2026-09 update: help expand coding-agent Plugins

Codex, OpenClaw, and Hermes now have real host/version capacity fixtures. We need community support to provide the same evidence for **Claude Code, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode, and Grok Bot**, then to build and validate their coding-agent Plugin packages. I will actively review those contributions and keep the public contracts, release digests, and host behavior aligned.

See the full call for contributors in [UPDATES.md](UPDATES.md) and the current priorities in [ROADMAP.md](ROADMAP.md).

## Project documents

- [Detailed Preview installation](INSTALL.md)
- [Changelog](CHANGELOG.md)
- [Architecture and shipped-state map](docs/architecture.md)
- [Testing contract](docs/testing.md)
- [Development workflow](docs/development.md)
- [Design corpus](docs/design/README.md)
- [Release manifest](plugins/release-manifest.json)
- [Contributing](CONTRIBUTING.md)

Distilly is released under the [MIT License](LICENSE). Created by [@titanwings](https://github.com/titanwings).
