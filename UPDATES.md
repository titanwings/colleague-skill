# Distilly updates

## 2026-09 — Developer Preview is open for host contributors

The `distilly-plugin` branch carries the public Developer Preview; the repository's default branch is `dot-skill`, the separate legacy implementation, so a bare clone lands there. This branch packages a real TypeScript/SQLite product path for Codex: local material intake, versioned Person Profiles, five MCP tools, correction review, and explicit profile Skill installation. This update also adds local OpenClaw and Hermes compatibility bindings for bundle/Skill installation, host discovery, and five-tool MCP checks. The legacy `dot-skill` branch remains available as a separate maintenance line.

Until a host has a verified native Plugin binding, users may explicitly install that branch as a best-effort Legacy Skill compatibility mode. This keeps the older local-file distillation flow available on Claude Code, OpenClaw, Hermes, DeepSeek Harness, Pi agent, Grok Build, and OpenCode; Grok Bot remains a manual saved/private Skill path. It is not an automatic fallback and does not claim the Preview's SQLite, five-tool MCP, Panel, lifecycle, or security guarantees. See [INSTALL.md](INSTALL.md#legacy-skill-compatibility-for-hosts-without-a-verified-plugin-binding).

Codex, OpenClaw `2026.3.24`, and Hermes `v0.9.0` now have real-host transport-capacity fixtures. Their recorded net budgets are 65,536 and 49,752 serialized bytes respectively, measured through each real host executable/model and MCP transport against a deterministic synthetic fixture server in an isolated clean session. This proves the recorded briefing/tool-result path; full restart, persistent-Skill, and packaged acceptance evidence remains separate. Setup still fails closed for any unrecorded host/version or changed release/tool tuple. The next bottleneck is host evidence and binding coverage, not another layer of storage abstraction. We need contributors who can build and run Plugin packages for:

- Grok Bot
- Claude Code
- Grok Build
- OpenCode
- Pi agent
- DeepSeek Harness (DSH)

Contributions can add a binding, a host fixture, a deterministic launcher check, or a focused documentation/test improvement. Keep each host implementation in its own branch or worktree, preserve the five-tool contract, and include a reproducible local test. Please open a focused GitHub issue or pull request against `distilly-plugin`; do not target the legacy `dot-skill` branch for Preview work.

I will actively review host contributions, especially real setup/doctor/restart/uninstall runs and evidence that the host discovers the same canonical Skill bytes. A host should be called verified only after its exact version, release tuple, capacity, launcher, and five-tool behavior have been tested.

For installation and the current Preview limits, start with the root [README](README.md). Versioned user-facing changes are recorded in [CHANGELOG.md](CHANGELOG.md), and staged priorities are tracked in [ROADMAP.md](ROADMAP.md).
