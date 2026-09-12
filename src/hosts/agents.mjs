/**
 * Coding-agent support matrix.
 *
 * Every entry names the directory the host actually scans and how the Skill is
 * installed there. The paths are taken from this repository only — `bin/distilly.mjs`
 * (the installers' targets) and `INSTALL.md` (the documented per-host table).
 * Nothing here is guessed: hosts whose project-local directory is user-defined
 * simply have no `projectPath`.
 *
 * Two install routes exist:
 *   1. the AgentSkills CLI — `npx skills add <repo> --agent <id>`
 *   2. a direct clone into the directory the host scans
 *
 * `capability: 'full'` means the host can read files and run shell commands, so
 * the whole collect → derive → read → distill → render workflow applies.
 */

export const REPO = 'titanwings/distilly';
export const SKILL_NAME = 'distilly';

/**
 * @typedef {object} CodingAgent
 * @property {string} id            host id, also the `install <host>` argument
 * @property {string} label         display name
 * @property {string} [cliId]       `--agent` target, only when confirmed
 * @property {string} globalPath    directory the host scans for global skills
 * @property {string} [projectPath] project-local directory, when documented
 * @property {'full'|'prompt-only'} capability
 * @property {{zh: string, en: string}} note
 */

/** @type {CodingAgent[]} */
export const AGENTS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    cliId: 'claude-code',
    globalPath: '~/.claude/skills/distilly',
    projectPath: '.claude/skills/distilly',
    capability: 'full',
    note: {
      zh: '安装后会被自动发现，可直接说"把这段聊天蒸馏成 Skill"。',
      en: 'Discovered automatically once installed; just ask it to distill a conversation.',
    },
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    cliId: 'codex',
    globalPath: '~/.agents/skills/distilly',
    projectPath: '.agents/skills/distilly',
    capability: 'full',
    note: {
      zh: 'Codex 扫描 ~/.agents/skills；旧版 ~/.codex/skills 需手动迁移。',
      en: 'Codex scans ~/.agents/skills; the legacy ~/.codex/skills path needs a manual move.',
    },
  },
  {
    id: 'opencode',
    label: 'opencode',
    cliId: 'opencode',
    globalPath: '~/.config/opencode/skills/distilly',
    projectPath: '.opencode/skills/distilly',
    capability: 'full',
    note: {
      zh: '同时兼容 ~/.agents/skills 与项目级 .opencode/skills。',
      en: 'Also reads ~/.agents/skills and the project-local .opencode/skills.',
    },
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    cliId: 'openclaw',
    globalPath: '~/.openclaw/workspace/skills/distilly',
    capability: 'full',
    note: {
      zh: 'Skill 目录即工作区子目录，装完重开 session 生效；项目级目录由用户在 OpenClaw 内自定义，本文档不猜路径。',
      en: 'The Skill directory lives inside the workspace; reopen the session after install. Project-local paths are user-defined in OpenClaw, so none is claimed here.',
    },
  },
  {
    id: 'hermes',
    label: 'Hermes',
    cliId: 'hermes',
    globalPath: '~/.hermes/skills/openclaw-imports/distilly',
    projectPath: '.hermes/skills/distilly',
    capability: 'full',
    note: {
      zh: '默认装在 Hermes 的 openclaw-imports 目录；项目级安装需先在该目录运行 hermes skills trust。',
      en: 'Installs into Hermes’ openclaw-imports directory; project-local installs need `hermes skills trust` there first.',
    },
  },
  {
    id: 'deepseek-harness',
    label: 'DeepSeek Harness',
    cliId: 'deepseek-harness',
    globalPath: '$DSH_HOME/skills/distilly',
    projectPath: '.dsh/skills/distilly',
    capability: 'full',
    note: {
      zh: 'DSH_HOME 未设置时等价于 ~/.dsh/skills/distilly；社区集成，非官方 DeepSeek 产品。',
      en: 'Falls back to ~/.dsh/skills/distilly when DSH_HOME is unset; community integration, not an official DeepSeek product.',
    },
  },
  {
    id: 'grok-build',
    label: 'Grok Build',
    cliId: 'grok-build',
    globalPath: '~/.grok/skills/distilly',
    projectPath: '.grok/skills/distilly',
    capability: 'full',
    note: {
      zh: '与 ~/.agents/skills 共用发现目录。',
      en: 'Shares the ~/.agents/skills discovery directory.',
    },
  },
  {
    id: 'pi',
    label: 'Pi',
    globalPath: '~/.pi/agent/skills/distilly',
    capability: 'full',
    note: {
      zh: '只确认了全局目录；AgentSkills CLI 的 --agent 目标未确认，因此本工具不输出该命令，用 clone 路线。',
      en: 'Only the global directory is confirmed; the AgentSkills CLI `--agent` target is not, so no such command is emitted — use the clone route.',
    },
  },
];

export const DEFAULT_AGENT = 'claude-code';

export function listAgents() {
  return AGENTS.map((a) => a.id);
}

/** @returns {CodingAgent} */
export function getAgent(id) {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`unknown coding agent "${id}"; known: ${listAgents().join(', ')}`);
  return agent;
}

/** True only when the AgentSkills CLI target for this host is confirmed. */
export function skillsCliSupported(id) {
  return Boolean(getAgent(id).cliId);
}

/**
 * One-liner via the AgentSkills CLI.
 * Pass `{ requireVerified: true }` to fail instead of emitting an unconfirmed
 * `--agent` target.
 */
export function skillsCliCommand(id, scope = 'global', { requireVerified = false } = {}) {
  const agent = getAgent(id);
  if (requireVerified && !agent.cliId) {
    throw new Error(
      `${agent.label} is not a confirmed AgentSkills CLI target; use cloneCommand('${id}', '${scope}').`,
    );
  }
  const flags = [`--agent ${agent.cliId ?? agent.id}`];
  if (scope === 'global') flags.push('--global', '--copy', '--yes');
  return `npx -y skills add ${REPO} --skill ${SKILL_NAME} ${flags.join(' ')}`;
}

/** Direct clone route, for hosts whose CLI target is unconfirmed. */
export function cloneCommand(id, scope = 'global') {
  const agent = getAgent(id);
  const target = scope === 'project' ? agent.projectPath : agent.globalPath;
  if (!target) throw new Error(`${agent.label} has no documented project-local path; use the global install.`);
  return `git clone https://github.com/${REPO} ${target}`;
}
