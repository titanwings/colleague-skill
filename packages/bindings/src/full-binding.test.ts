import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILTIN_HOSTS,
  type ContentDigest,
  type HostCapabilities,
  type Profile,
  type SubjectId,
  type VersionId,
} from "@distilly/protocol";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { listPersonInstalls } from "./full/injector.js";
import { createClaudeCodeHostBinding } from "./claude-code/full.js";
import { createCodexHostBinding } from "./codex/full.js";
import { defaultHostCommandRunner } from "./full/command-runner.js";
import type { FullHostBindingOptions, HostCommandRunner, HostFormPresenter } from "./protocol.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_NOW = new Date("2026-08-31T08:00:00.000Z");
const SUBJECT_ID = `subject_${"a".repeat(32)}` as SubjectId;
const VERSION_ID = `version_${"b".repeat(64)}` as VersionId;

const CAPABILITIES = {
  webResearch: "unknown",
  localFileRead: "available",
  vision: "unknown",
  documentTextExtraction: "unknown",
  imageOcr: "unknown",
  audioTranscription: "unknown",
  videoCaptions: "unknown",
  privateUiCapture: "unavailable",
  windowScopedCapture: "unknown",
  captureDataPolicy: "unknown",
  structuredToolCalls: true,
  lifecycleHooks: [],
  subruns: true,
  subrunsInheritMcp: true,
  opensLoopbackUrls: true,
} as const satisfies HostCapabilities;

const PROFILE: Profile = {
  subjectId: SUBJECT_ID,
  displayName: "Ada Lovelace",
  versionId: VERSION_ID,
  claims: [],
  core: {
    identity: "# core.identity\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    voice: "# core.voice\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    psyche: "# core.psyche\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    relations: "# core.relations\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    boundaries:
      "# core.boundaries\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    texture: "# core.texture\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
    timeline: "# core.timeline\n\n## Active claims\n\n    []\n\n## Contested claims\n\n    []\n",
  },
  domains: {},
  rendered: "# Distilly profile\n\n## Core facets\n\nNo recorded claims.\n",
  quality: {
    sourceGroupingVersion: "source-groups-v1",
    activeClaimCount: 0,
    contestedClaimCount: 0,
    userAssertedClaimCount: 0,
    corroboratedClaimCount: 0,
    sourceGroupCount: 0,
    diversityEligibleSourceGroupCount: 0,
    unknownSourceGroupCount: 0,
    coveredCoreFacets: [],
    uncoveredCoreFacets: [
      "identity",
      "voice",
      "psyche",
      "relations",
      "boundaries",
      "texture",
      "timeline",
    ],
    maturity: "sparse",
  },
};

let releaseVersion: string;
let canonicalSkillDigest: ContentDigest;
const temporaryRoots: string[] = [];

beforeAll(async () => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, "plugins", "release-manifest.json"), "utf8"),
  ) as {
    releaseVersion: string;
    canonicalSkill: { digest: ContentDigest };
  };
  releaseVersion = manifest.releaseVersion;
  canonicalSkillDigest = manifest.canonicalSkill.digest;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const temporaryHome = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-full-binding-"));
  temporaryRoots.push(root);
  return root;
};

const forms: HostFormPresenter = {
  ask: vi.fn(() => Promise.resolve({ text: "answer" })) as HostFormPresenter["ask"],
};

const sharedOptions = (homeDirectory: string): FullHostBindingOptions => ({
  homeDirectory,
  forms,
  now: () => FIXED_NOW,
  provider: {
    load: (context) =>
      Promise.resolve({
        ok: true,
        capabilities: CAPABILITIES,
        capacity: {
          maximumInputTokens: 96_000,
          maximumToolResultBytes: 750_000,
          source: "host_handshake",
        },
        evidence: {
          kind: "host_handshake",
          host: context.sessionId.startsWith("claude") ? "claude-code" : "codex",
          hostVersion: "preview-fixture",
          environment: context.environment,
          releaseVersion,
          wireMajor: 3,
          canonicalSkillDigest,
        },
        warnings: [],
      }),
  },
  release: { releaseVersion, wireMajor: 3, canonicalSkillDigest },
});

const launcher = async (homeDirectory: string): Promise<string> => {
  const path = join(homeDirectory, ".distilly", "bin", "distilly");
  await mkdir(join(homeDirectory, ".distilly", "bin"), { recursive: true });
  await writeFile(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await chmod(path, 0o755);
  return path;
};

describe("default host command runner", () => {
  it("binds Codex state to the explicit home instead of an inherited CODEX_HOME", async () => {
    const home = await temporaryHome();
    vi.stubEnv("CODEX_HOME", join(home, "foreign-codex-home"));

    const result = await defaultHostCommandRunner.run({
      executablePath: process.execPath,
      args: [
        "-e",
        "process.stdout.write(JSON.stringify({HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE,CODEX_HOME:process.env.CODEX_HOME}))",
      ],
      homeDirectory: home,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      HOME: home,
      USERPROFILE: home,
      CODEX_HOME: join(home, ".codex"),
    });
    expect(await readdir(join(home, ".codex"))).toEqual([]);
  });
});

describe("Claude Code full binding", () => {
  it("installs a launchable skills-directory plugin and keeps person data on uninstall", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    await writeFile(join(home, ".distilly", "person-data"), "keep me\n");
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    await expect(
      binding.preflight({ sessionId: "claude-preflight", environment: "cli" }),
    ).resolves.toMatchObject({ ok: true });

    const result = await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
      runtimeVersion: releaseVersion,
    });

    expect(result.host).toBe("claude-code");
    expect(result.manifestPath).toBe(
      join(home, ".claude", "skills", "distilly", ".claude-plugin", "plugin.json"),
    );
    const installedRoot = join(home, ".claude", "skills", "distilly");
    expect(await readdir(join(home, ".claude", "skills"))).toEqual(["distilly"]);
    const mcp = await readFile(join(installedRoot, ".mcp.json"), "utf8");
    expect(JSON.parse(mcp)).toEqual({
      mcpServers: {
        distilly: { command: launcherPath, args: ["mcp", "--host", "claude-code"] },
      },
    });
    expect(mcp).not.toContain("__DISTILLY_LAUNCHER_ABSOLUTE_PATH__");
    await expect(readFile(join(installedRoot, ".mcp.json.template"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(installedRoot, "skills", "distilly", "SKILL.md"), "utf8")).toBe(
      await readFile(
        join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly", "SKILL.md"),
        "utf8",
      ),
    );
    await expect(
      binding.doctor({ sessionId: "claude-doctor", environment: "cli" }),
    ).resolves.toEqual({
      host: "claude-code",
      installed: true,
      launcherReachable: true,
      wireCompatible: true,
      warnings: [],
    });

    await binding.uninstallPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
      runtimeVersion: releaseVersion,
    });
    await expect(readFile(join(home, ".distilly", "person-data"), "utf8")).resolves.toBe(
      "keep me\n",
    );
    await expect(readFile(result.manifestPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("injects one prompt and protects self-contained person Skill projections", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-inject", environment: "cli" });
    expect(
      injector.injectSubrun(
        { subjectId: SUBJECT_ID, versionId: VERSION_ID, prompt: "Use Ada's profile." },
        { instructions: ["Keep scope narrow."], input: "Draft a response." },
      ),
    ).toEqual({
      instructions: ["Keep scope narrow.", "Use Ada's profile."],
      input: "Draft a response.",
      metadata: {
        "distilly.subjectId": SUBJECT_ID,
        "distilly.versionId": VERSION_ID,
      },
    });

    const installed = await injector.install(PROFILE, {});
    expect(await readdir(join(home, ".claude", "skills"))).toEqual([basename(installed.path)]);
    const skillPath = join(installed.path, "SKILL.md");
    expect(await readFile(skillPath, "utf8")).toContain("Distilly Person Profile");
    await writeFile(skillPath, "user modified\n");
    await expect(injector.uninstall(installed)).rejects.toMatchObject({
      code: "storage_corrupt",
    });
    await expect(readFile(skillPath, "utf8")).resolves.toBe("user modified\n");
  });

  it("returns the original install reference when the clock advances", async () => {
    const home = await temporaryHome();
    let clockRead = 0;
    const binding = createClaudeCodeHostBinding({
      ...sharedOptions(home),
      now: () =>
        new Date(clockRead++ === 0 ? "2026-08-31T08:00:00.000Z" : "2026-09-01T08:00:00.000Z"),
    });
    const injector = binding.createInjector({ sessionId: "claude-replay", environment: "cli" });

    const first = await injector.install(PROFILE, {});
    const replay = await injector.install(PROFILE, {});

    expect(replay).toEqual(first);
    expect(clockRead).toBe(1);
  });

  it("refuses a person Skill root symlink without deleting its target", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-symlink", environment: "cli" });
    const installed = await injector.install(PROFILE, {});
    const target = join(home, "preserved-person-skill");
    await rename(installed.path, target);
    await symlink(target, installed.path, "dir");

    await expect(injector.uninstall(installed)).rejects.toMatchObject({
      code: "storage_corrupt",
    });

    await expect(readFile(join(target, "SKILL.md"), "utf8")).resolves.toContain(
      "Distilly Person Profile",
    );
    await expect(readFile(join(target, ".distilly-install.json"))).resolves.toBeDefined();
  });

  it.each(["path", "files-digest"] as const)(
    "refuses a person Skill with altered %s metadata without deleting files",
    async (tamper) => {
      const home = await temporaryHome();
      const binding = createClaudeCodeHostBinding(sharedOptions(home));
      const injector = binding.createInjector({ sessionId: "claude-tamper", environment: "cli" });
      const installed = await injector.install(PROFILE, {});
      const manifestPath = join(installed.path, ".distilly-install.json");
      const skillPath = join(installed.path, "SKILL.md");
      const skillBefore = await readFile(skillPath);
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        install: { path: string };
        files: [{ contentDigest: string }];
      };
      if (tamper === "path") manifest.install.path = join(home, "outside-person-skill");
      else manifest.files[0].contentDigest = `sha256_${"0".repeat(64)}`;
      const tamperedManifest = `${JSON.stringify(manifest)}\n`;
      await writeFile(manifestPath, tamperedManifest);

      await expect(injector.install(PROFILE, {})).rejects.toMatchObject({
        code: "storage_corrupt",
      });
      await expect(injector.uninstall(installed)).rejects.toMatchObject({
        code: "storage_corrupt",
      });

      await expect(readFile(skillPath)).resolves.toEqual(skillBefore);
      await expect(readFile(manifestPath, "utf8")).resolves.toBe(tamperedManifest);
    },
  );
});

describe("Codex full binding", () => {
  it("preserves marketplace neighbors and invokes exact add/remove selectors", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const marketplacePath = join(home, ".agents", "plugins", "marketplace.json");
    await mkdir(join(home, ".agents", "plugins"), { recursive: true });
    await writeFile(
      marketplacePath,
      `${JSON.stringify(
        {
          name: "my-local",
          interface: { displayName: "My Local" },
          custom: { retained: true },
          plugins: [
            {
              name: "neighbor",
              source: { source: "local", path: "./plugins/neighbor" },
              policy: { installation: "AVAILABLE", authentication: "ON_USE" },
              category: "DeveloperTools",
            },
          ],
        },
        undefined,
        2,
      )}\n`,
    );
    const run = vi.fn<HostCommandRunner["run"]>(() =>
      Promise.resolve({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
      }),
    );
    const binding = createCodexHostBinding({
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
      commandRunner: { run },
    });
    await expect(
      binding.preflight({ sessionId: "codex-preflight", environment: "cli" }),
    ).resolves.toMatchObject({ ok: true });

    await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    });
    expect(run).toHaveBeenNthCalledWith(1, {
      executablePath: "/opt/local/bin/codex",
      args: ["plugin", "add", "distilly@my-local", "--json"],
      homeDirectory: home,
    });
    const installedMarketplace = JSON.parse(await readFile(marketplacePath, "utf8")) as {
      custom: unknown;
      plugins: { name: string }[];
    };
    expect(installedMarketplace.custom).toEqual({ retained: true });
    expect(installedMarketplace.plugins.map((entry) => entry.name)).toEqual([
      "neighbor",
      "distilly",
    ]);

    await binding.uninstallPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    });
    expect(run).toHaveBeenNthCalledWith(2, {
      executablePath: "/opt/local/bin/codex",
      args: ["plugin", "remove", "distilly@my-local", "--json"],
      homeDirectory: home,
    });
    const uninstalledMarketplace = JSON.parse(await readFile(marketplacePath, "utf8")) as {
      custom: unknown;
      plugins: { name: string }[];
    };
    expect(uninstalledMarketplace.custom).toEqual({ retained: true });
    expect(uninstalledMarketplace.plugins.map((entry) => entry.name)).toEqual(["neighbor"]);
  });

  it("does not unregister a plugin tree without Distilly ownership", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const pluginRoot = join(home, "plugins", "distilly");
    const marketplacePath = join(home, ".agents", "plugins", "marketplace.json");
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(join(pluginRoot, "manual.txt"), "manual plugin\n");
    await mkdir(join(home, ".agents", "plugins"), { recursive: true });
    const marketplace = `${JSON.stringify({
      name: "personal",
      plugins: [
        {
          name: "distilly",
          source: { source: "local", path: "./plugins/distilly" },
        },
      ],
    })}\n`;
    await writeFile(marketplacePath, marketplace);
    const run = vi.fn<HostCommandRunner["run"]>();
    const binding = createCodexHostBinding({
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
      commandRunner: { run },
    });

    await binding.uninstallPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    });

    expect(run).not.toHaveBeenCalled();
    await expect(readFile(join(pluginRoot, "manual.txt"), "utf8")).resolves.toBe("manual plugin\n");
    await expect(readFile(marketplacePath, "utf8")).resolves.toBe(marketplace);
  });

  it("cleans a registered plugin when its owned tree is already missing", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const run = vi.fn<HostCommandRunner["run"]>(() =>
      Promise.resolve({ exitCode: 0, stdout: "{}", stderr: "" }),
    );
    const options = {
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
      commandRunner: { run },
    };
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    };
    const binding = createCodexHostBinding(options);
    await binding.installPlugin(context);
    await rm(join(home, "plugins", "distilly"), { recursive: true, force: true });

    await expect(binding.uninstallPlugin(context)).resolves.toBeUndefined();
    expect(run).toHaveBeenLastCalledWith({
      executablePath: "/opt/local/bin/codex",
      args: ["plugin", "remove", "distilly@personal", "--json"],
      homeDirectory: home,
    });
    const marketplace = JSON.parse(
      await readFile(join(home, ".agents", "plugins", "marketplace.json"), "utf8"),
    ) as { plugins: { name: string }[] };
    expect(marketplace.plugins).toEqual([]);
  });

  it("refuses an unowned neighbor without damaging the active plugin", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const run = vi.fn<HostCommandRunner["run"]>(() =>
      Promise.resolve({ exitCode: 0, stdout: "{}", stderr: "" }),
    );
    const binding = createCodexHostBinding({
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
      commandRunner: { run },
    });
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    };
    await binding.installPlugin(context);
    const pluginRoot = join(home, "plugins", "distilly");
    const skillPath = join(pluginRoot, "skills", "distilly", "SKILL.md");
    const ownershipPath = join(pluginRoot, ".distilly-plugin-install.json");
    const skillBefore = await readFile(skillPath);
    const ownershipBefore = await readFile(ownershipPath);
    await writeFile(join(pluginRoot, "user-note.txt"), "keep me\n");

    await expect(
      binding.doctor({ sessionId: "codex-unowned-doctor", environment: "cli" }),
    ).resolves.toMatchObject({
      installed: true,
      launcherReachable: false,
      wireCompatible: false,
      warnings: ["The Distilly host installation manifest is invalid."],
    });
    await expect(binding.installPlugin(context)).rejects.toMatchObject({
      code: "storage_corrupt",
    });

    expect(run).toHaveBeenCalledTimes(1);
    await expect(readFile(skillPath)).resolves.toEqual(skillBefore);
    await expect(readFile(ownershipPath)).resolves.toEqual(ownershipBefore);
    await expect(readFile(join(pluginRoot, "user-note.txt"), "utf8")).resolves.toBe("keep me\n");
  });

  it("restores the active plugin when Codex registration fails", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const successfulRunner: HostCommandRunner = {
      run: () => Promise.resolve({ exitCode: 0, stdout: "{}", stderr: "" }),
    };
    const options = {
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
    };
    const active = createCodexHostBinding({ ...options, commandRunner: successfulRunner });
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    };
    await active.installPlugin(context);
    const pluginRoot = join(home, "plugins", "distilly");
    const mcpPath = join(pluginRoot, ".mcp.json");
    const ownershipPath = join(pluginRoot, ".distilly-plugin-install.json");
    const marketplacePath = join(home, ".agents", "plugins", "marketplace.json");
    const mcpBefore = await readFile(mcpPath);
    const ownershipBefore = await readFile(ownershipPath);
    const marketplaceBefore = await readFile(marketplacePath);
    const failedRun = vi.fn<HostCommandRunner["run"]>(() =>
      Promise.resolve({ exitCode: 1, stdout: "", stderr: "failed" }),
    );
    const replacement = createCodexHostBinding({
      ...options,
      commandRunner: { run: failedRun },
    });

    await expect(replacement.installPlugin(context)).rejects.toMatchObject({
      code: "internal_error",
    });

    expect(failedRun).toHaveBeenCalledTimes(1);
    await expect(readFile(mcpPath)).resolves.toEqual(mcpBefore);
    await expect(readFile(ownershipPath)).resolves.toEqual(ownershipBefore);
    await expect(readFile(marketplacePath)).resolves.toEqual(marketplaceBefore);
    await expect(
      active.doctor({ sessionId: "codex-restored", environment: "cli" }),
    ).resolves.toMatchObject({ installed: true, launcherReachable: true, wireCompatible: true });
  });

  it("does not run Codex removal for a foreign marketplace entry", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const setupRunner: HostCommandRunner = {
      run: () => Promise.resolve({ exitCode: 0, stdout: "{}", stderr: "" }),
    };
    const options = {
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
    };
    const binding = createCodexHostBinding({ ...options, commandRunner: setupRunner });
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    };
    const result = await binding.installPlugin(context);
    const marketplacePath = join(home, ".agents", "plugins", "marketplace.json");
    const foreignMarketplace = `${JSON.stringify({
      name: "personal",
      plugins: [
        {
          name: "distilly",
          source: { source: "git", url: "https://example.invalid/foreign.git" },
        },
      ],
    })}\n`;
    await writeFile(marketplacePath, foreignMarketplace);
    const run = vi.fn<HostCommandRunner["run"]>();
    const uninstalling = createCodexHostBinding({ ...options, commandRunner: { run } });

    await expect(uninstalling.uninstallPlugin(context)).rejects.toMatchObject({
      code: "invalid_input",
    });

    expect(run).not.toHaveBeenCalled();
    await expect(readFile(result.manifestPath)).resolves.toBeDefined();
    await expect(readFile(marketplacePath, "utf8")).resolves.toBe(foreignMarketplace);
  });

  it("reports missing launchers and version incompatibility without touching product data", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const commandRunner: HostCommandRunner = {
      run: () => Promise.resolve({ exitCode: 0, stdout: "{}", stderr: "" }),
    };
    const binding = createCodexHostBinding({
      ...sharedOptions(home),
      executablePath: "/opt/local/bin/codex",
      commandRunner,
    });
    await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "codex"),
      runtimeVersion: releaseVersion,
    });
    await rm(launcherPath);
    await expect(
      binding.doctor({ sessionId: "codex-doctor", environment: "cli" }),
    ).resolves.toMatchObject({
      installed: true,
      launcherReachable: false,
      wireCompatible: true,
    });

    const incompatible = createCodexHostBinding({
      ...sharedOptions(home),
      release: {
        releaseVersion: "0.0.1",
        wireMajor: 3,
        canonicalSkillDigest,
      },
      executablePath: "/opt/local/bin/codex",
      commandRunner,
    });
    await expect(
      incompatible.doctor({ sessionId: "codex-doctor", environment: "cli" }),
    ).resolves.toMatchObject({ wireCompatible: false });
  });
});

describe("person Skill lifecycle", () => {
  it("updates the install Distilly owns when the same subject is distilled again", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-update", environment: "cli" });
    const first = await injector.install(PROFILE, {});
    const skillPath = join(first.path, "SKILL.md");
    const firstSkill = await readFile(skillPath, "utf8");

    const nextVersion = {
      ...PROFILE,
      versionId: `version_${"c".repeat(64)}`,
      rendered: `${PROFILE.rendered}\n\nNew evidence changed the boundaries.\n`,
    } as typeof PROFILE;
    const updated = await injector.install(nextVersion, {});

    expect(updated.path).toBe(first.path);
    expect(updated.versionId).toBe(nextVersion.versionId);
    expect(updated.contentDigest).not.toBe(first.contentDigest);
    expect(await readdir(join(home, ".claude", "skills"))).toEqual([basename(first.path)]);
    const skill = await readFile(skillPath, "utf8");
    expect(skill).not.toBe(firstSkill);
    expect(skill).toContain("New evidence changed the boundaries.");
    const manifest = JSON.parse(
      await readFile(join(first.path, ".distilly-install.json"), "utf8"),
    ) as { install: { versionId: string } };
    expect(manifest.install.versionId).toBe(nextVersion.versionId);
  });

  it("keeps the Skill path stable when a display-name change moves its directory", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-rename", environment: "cli" });
    const first = await injector.install(PROFILE, {});
    const renamed = { ...PROFILE, displayName: "Ada B. Lovelace" } as typeof PROFILE;
    const updated = await injector.install(renamed, {});
    expect(updated.path).toBe(first.path);
    expect(await readdir(join(home, ".claude", "skills"))).toEqual([basename(first.path)]);
    expect(await readFile(join(first.path, "SKILL.md"), "utf8")).toContain("Ada B. Lovelace");
  });

  it("lists verified installs and reports a modified directory instead of hiding it", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-list", environment: "cli" });
    const installed = await injector.install(PROFILE, {});
    await mkdir(join(home, ".claude", "skills", "some-other-skill"), { recursive: true });
    const before = await listPersonInstalls(BUILTIN_HOSTS.claudeCode, home);
    expect(before).toHaveLength(2);
    expect(before[0]).toMatchObject({ verified: true, install: { subjectId: SUBJECT_ID } });
    const unverified = before[1];
    expect(unverified?.verified).toBe(false);

    await writeFile(join(installed.path, "SKILL.md"), "hand edited\n");
    const after = await listPersonInstalls(BUILTIN_HOSTS.claudeCode, home);
    expect(after.filter((entry) => entry.verified)).toHaveLength(0);
    expect(after.map((entry) => entry.verified)).toEqual([false, false]);
  });

  it("refuses to replace a modified install and leaves it untouched", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-modified", environment: "cli" });
    const first = await injector.install(PROFILE, {});
    await writeFile(join(first.path, "SKILL.md"), "hand edited\n");
    const nextVersion = {
      ...PROFILE,
      versionId: `version_${"d".repeat(64)}`,
    } as typeof PROFILE;
    await expect(injector.install(nextVersion, {})).rejects.toMatchObject({
      code: "storage_corrupt",
    });
    expect(await readFile(join(first.path, "SKILL.md"), "utf8")).toBe("hand edited\n");
  });
});

describe("Claude Code person Skill registration", () => {
  it("writes the plugin marker Claude Code needs and removes it again", async () => {
    const home = await temporaryHome();
    const binding = createClaudeCodeHostBinding(sharedOptions(home));
    const injector = binding.createInjector({ sessionId: "claude-marker", environment: "cli" });
    const installed = await injector.install(PROFILE, {});
    const marker = join(installed.path, ".claude-plugin", "plugin.json");
    const originalMarker = await readFile(marker);
    const parsed = JSON.parse(originalMarker.toString("utf8")) as {
      name: string;
      version: string;
      skills: string[];
      description: string;
    };
    expect(parsed.name).toBe(basename(installed.path));
    expect(parsed.version).toBe(`0.0.0-${VERSION_ID.replace(/^version_/u, "").slice(0, 12)}`);
    expect(parsed.skills).toEqual(["./"]);
    expect(parsed.description).toContain("Ada Lovelace");

    const manifest = JSON.parse(
      await readFile(join(installed.path, ".distilly-install.json"), "utf8"),
    ) as { files: { path: string }[] };
    expect(manifest.files.map((file) => file.path).sort()).toEqual([
      ".claude-plugin/plugin.json",
      "SKILL.md",
    ]);

    // A tampered marker is a modified install, exactly like a tampered SKILL.md.
    await writeFile(marker, "{}\n");
    await expect(injector.uninstall(installed)).rejects.toMatchObject({ code: "storage_corrupt" });

    await writeFile(marker, originalMarker);
    await injector.uninstall(installed);
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readdir(join(home, ".claude", "skills"))).toEqual([]);
  });

  it("keeps other hosts free of the Claude Code marker", async () => {
    const home = await temporaryHome();
    const binding = createCodexHostBinding({
      ...sharedOptions(home),
      executablePath: "/usr/bin/codex",
    });
    const injector = binding.createInjector({ sessionId: "codex-marker", environment: "cli" });
    const installed = await injector.install(PROFILE, {});
    expect(await readdir(installed.path)).toEqual([".distilly-install.json", "SKILL.md"]);
  });
});
