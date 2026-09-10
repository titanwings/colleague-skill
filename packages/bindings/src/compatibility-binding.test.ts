import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ContentDigest,
  HostCapabilities,
  Profile,
  SubjectId,
  VersionId,
} from "@distilly/protocol";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createHermesHostBinding } from "./hermes/full.js";
import { createOpenClawHostBinding } from "./openclaw/full.js";
import { defaultHostCommandRunner } from "./full/command-runner.js";
import type { FullHostBindingOptions, HostCommandRunner, HostFormPresenter } from "./protocol.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_NOW = new Date("2026-08-31T08:00:00.000Z");
const SUBJECT_ID = `subject_${"a".repeat(32)}` as SubjectId;
const VERSION_ID = `version_${"b".repeat(64)}` as VersionId;
const PROFILE: Profile = {
  subjectId: SUBJECT_ID,
  displayName: "Ada Lovelace",
  versionId: VERSION_ID,
  claims: [],
  core: {
    identity: "# identity\n",
    voice: "# voice\n",
    psyche: "# psyche\n",
    relations: "# relations\n",
    boundaries: "# boundaries\n",
    texture: "# texture\n",
    timeline: "# timeline\n",
  },
  domains: {},
  rendered: "# Profile\n",
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

let releaseVersion: string;
let canonicalSkillDigest: ContentDigest;
const temporaryRoots: string[] = [];

beforeAll(async () => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, "plugins", "release-manifest.json"), "utf8"),
  ) as { releaseVersion: string; canonicalSkill: { digest: ContentDigest } };
  releaseVersion = manifest.releaseVersion;
  canonicalSkillDigest = manifest.canonicalSkill.digest;
});

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const temporaryHome = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-compat-binding-"));
  temporaryRoots.push(root);
  return root;
};

const forms: HostFormPresenter = {
  ask: vi.fn(() => Promise.resolve({ text: "answer" })) as HostFormPresenter["ask"],
};

const options = (
  host: "openclaw" | "hermes",
  homeDirectory: string,
  commandRunner: HostCommandRunner,
): FullHostBindingOptions & { executablePath: string; commandRunner: HostCommandRunner } => ({
  homeDirectory,
  executablePath: "/opt/local/bin/host",
  commandRunner,
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
          host,
          hostVersion: "compatibility-fixture",
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
  await writeFile(path, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  await chmod(path, 0o700);
  return path;
};

const success = (stdout = "{}"): Awaited<ReturnType<HostCommandRunner["run"]>> => ({
  exitCode: 0,
  stdout,
  stderr: "",
});

const hermesCommandScalar = (value: string): string => value.split(" ").join("\n      ");

describe("compatibility host process boundary", () => {
  it("does not forward credential-bearing parent variables", async () => {
    const home = await temporaryHome();
    vi.stubEnv("DISTILLY_TEST_SECRET", "must-not-cross-the-host-boundary");

    const result = await defaultHostCommandRunner.run({
      executablePath: process.execPath,
      args: [
        "-e",
        "process.stdout.write(JSON.stringify({secret:process.env.DISTILLY_TEST_SECRET,home:process.env.HOME,hermes:process.env.HERMES_HOME}))",
      ],
      homeDirectory: home,
      environment: { HERMES_HOME: join(home, ".hermes") },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ home, hermes: join(home, ".hermes") });
  });
});

describe("OpenClaw compatibility binding", () => {
  it("installs a Claude bundle with a real absolute MCP entry and preserves data", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    await writeFile(join(home, ".distilly", "person-data"), "keep me\n");
    const pluginRoot = join(home, ".openclaw", "extensions", "distilly");
    const run = vi.fn<HostCommandRunner["run"]>(({ args }) => {
      if (args.join(" ") === "mcp list --json") return Promise.resolve(success("{}\n"));
      if (args.join(" ") === "plugins inspect distilly --json") {
        return Promise.resolve(
          success(
            `[plugins] tool-guardian: active\n${JSON.stringify({
              plugin: {
                id: "distilly",
                format: "bundle",
                bundleFormat: "claude",
                enabled: true,
                status: "loaded",
                rootDir: pluginRoot,
              },
              mcpServers: [{ name: "distilly", hasStdioTransport: true }],
            })}`,
          ),
        );
      }
      return Promise.reject(new Error(`unexpected OpenClaw command: ${args.join(" ")}`));
    });
    const binding = createOpenClawHostBinding(options("openclaw", home, { run }));

    const result = await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
      runtimeVersion: releaseVersion,
    });

    expect(result.host).toBe("openclaw");
    expect(result.manifestPath).toBe(join(pluginRoot, ".claude-plugin", "plugin.json"));
    expect(JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"))).toEqual({
      mcpServers: {
        distilly: { command: launcherPath, args: ["mcp", "--host", "openclaw"] },
      },
    });
    await expect(readFile(join(pluginRoot, ".mcp.json.template"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readdir(join(home, ".openclaw", "extensions"))).resolves.toEqual(["distilly"]);
    await expect(readdir(join(home, ".codex"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      binding.doctor({ sessionId: "openclaw-doctor", environment: "cli" }),
    ).resolves.toEqual({
      host: "openclaw",
      installed: true,
      launcherReachable: true,
      wireCompatible: true,
      warnings: [],
    });
    const personInjector = binding.createInjector({
      sessionId: "openclaw-profile",
      environment: "cli",
    });
    const personInstall = await personInjector.install(PROFILE, {});
    expect(personInstall.path).toContain(join(home, ".openclaw", "skills"));
    await personInjector.uninstall(personInstall);

    await binding.uninstallPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
      runtimeVersion: releaseVersion,
    });
    await expect(readFile(join(home, ".distilly", "person-data"), "utf8")).resolves.toBe(
      "keep me\n",
    );
    await expect(readdir(join(home, ".openclaw", "extensions"))).resolves.toEqual([]);
  });

  it("rejects a conflicting global MCP entry before writing the bundle", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const run: HostCommandRunner = {
      run: ({ args }) =>
        Promise.resolve(
          args.join(" ") === "mcp list --json"
            ? success(JSON.stringify({ distilly: { command: "/someone/else" } }))
            : success(),
        ),
    };
    const binding = createOpenClawHostBinding(options("openclaw", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readdir(join(home, ".openclaw"))).resolves.toEqual([]);
  });

  it("rejects the alternate OpenClaw server-list shape when it overrides Distilly", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const run: HostCommandRunner = {
      run: ({ args }) =>
        Promise.resolve(
          args.join(" ") === "mcp list --json"
            ? success(
                JSON.stringify({
                  path: "~/.openclaw/openclaw.json",
                  servers: [
                    {
                      name: "distilly",
                      configured: true,
                      enabled: true,
                      ok: true,
                      transport: "stdio",
                      launch: "/someone/else",
                    },
                  ],
                }),
              )
            : args.join(" ") === "mcp show distilly --json"
              ? success(JSON.stringify({ command: "/someone/else", args: [] }))
              : success(),
        ),
    };
    const binding = createOpenClawHostBinding(options("openclaw", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readdir(join(home, ".openclaw"))).resolves.toEqual([]);
  });

  it("resolves an OpenClaw status-summary entry through mcp show", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const run = vi.fn<HostCommandRunner["run"]>(({ args }) => {
      const command = args.join(" ");
      if (command === "mcp list --json") {
        return Promise.resolve(
          success(
            JSON.stringify({
              path: "~/.openclaw/openclaw.json",
              servers: [
                {
                  name: "distilly",
                  configured: true,
                  enabled: true,
                  ok: true,
                  transport: "stdio",
                  launch: launcherPath,
                },
              ],
            }),
          ),
        );
      }
      if (command === "mcp show distilly --json") {
        return Promise.resolve(
          success(JSON.stringify({ command: launcherPath, args: ["mcp", "--host", "openclaw"] })),
        );
      }
      if (command === "plugins inspect distilly --json") {
        return Promise.resolve(
          success(
            JSON.stringify({
              plugin: {
                id: "distilly",
                format: "bundle",
                bundleFormat: "claude",
                enabled: true,
                status: "loaded",
                rootDir: join(home, ".openclaw", "extensions", "distilly"),
              },
              mcpServers: [{ name: "distilly", hasStdioTransport: true }],
            }),
          ),
        );
      }
      return Promise.reject(new Error(`unexpected OpenClaw command: ${command}`));
    });
    const binding = createOpenClawHostBinding(options("openclaw", home, { run }));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
        runtimeVersion: releaseVersion,
      }),
    ).resolves.toMatchObject({ host: "openclaw" });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ args: ["mcp", "show", "distilly", "--json"] }),
    );
  });

  it("rejects duplicate OpenClaw Distilly entries during bundle inspection", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const pluginRoot = join(home, ".openclaw", "extensions", "distilly");
    const run: HostCommandRunner = {
      run: ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp list --json") return Promise.resolve(success("{}\n"));
        if (command === "plugins inspect distilly --json") {
          return Promise.resolve(
            success(
              JSON.stringify({
                plugin: {
                  id: "distilly",
                  format: "bundle",
                  bundleFormat: "claude",
                  enabled: true,
                  status: "loaded",
                  rootDir: pluginRoot,
                },
                mcpServers: [
                  { name: "distilly", hasStdioTransport: true },
                  { name: "distilly", hasStdioTransport: true },
                ],
              }),
            ),
          );
        }
        return Promise.reject(new Error(`unexpected OpenClaw command: ${command}`));
      },
    };
    const binding = createOpenClawHostBinding(options("openclaw", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "internal_error" });
    await expect(readdir(join(home, ".openclaw", "extensions"))).resolves.toEqual([]);
  });

  it("refuses an OpenClaw extension parent symlink", async () => {
    const home = await temporaryHome();
    const outside = await temporaryHome();
    const launcherPath = await launcher(home);
    await mkdir(join(home, ".openclaw"), { recursive: true });
    await symlink(outside, join(home, ".openclaw", "extensions"), "dir");
    const run: HostCommandRunner = { run: () => Promise.resolve(success("{}")) };
    const binding = createOpenClawHostBinding(options("openclaw", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "claude-code"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});

describe("Hermes compatibility binding", () => {
  it("installs the managed Skill, disables utility tools, and removes only owned state", async () => {
    const parent = await temporaryHome();
    const home = join(parent, "home with spaces");
    await mkdir(home, { recursive: true });
    const launcherPath = await launcher(home);
    await writeFile(join(home, ".distilly", "person-data"), "keep me\n");
    const configPath = join(home, ".hermes", "config.yaml");
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const run = vi.fn<HostCommandRunner["run"]>(async ({ args }) => {
      const command = args.join(" ");
      if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
        await writeFile(
          configPath,
          `mcp_servers:\n  distilly:\n    command: ${hermesCommandScalar(wrapper)}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
          { mode: 0o600 },
        );
        return success();
      }
      if (command.startsWith("config set mcp_servers.distilly.tools.")) {
        const key = command.endsWith("resources false") ? "resources" : "prompts";
        const current = await readFile(configPath, "utf8");
        await writeFile(configPath, current.replace(`${key}: true`, `${key}: false`));
        return success();
      }
      if (command === "mcp test distilly") return success("Connected\nTools discovered: 5\n");
      if (command === "mcp remove distilly") {
        await writeFile(configPath, "mcp_servers:\n", { mode: 0o600 });
        return success();
      }
      throw new Error(`unexpected Hermes command: ${command}`);
    });
    const binding = createHermesHostBinding(options("hermes", home, { run }));
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
      runtimeVersion: releaseVersion,
    };

    const result = await binding.installPlugin(context);

    const skillRoot = join(home, ".hermes", "skills", "distilly");
    expect(result.host).toBe("hermes");
    expect(result.manifestPath).toBe(join(skillRoot, ".distilly-install.json"));
    await expect(readFile(join(skillRoot, "SKILL.md"), "utf8")).resolves.toContain("Distilly");
    await expect(readFile(wrapper, "utf8")).resolves.toContain("--host hermes");
    const config = await readFile(configPath, "utf8");
    expect(config).toContain("resources: false");
    expect(config).toContain("prompts: false");
    await expect(readdir(join(home, ".codex"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      binding.doctor({ sessionId: "hermes-doctor", environment: "cli" }),
    ).resolves.toEqual({
      host: "hermes",
      installed: true,
      launcherReachable: true,
      wireCompatible: true,
      warnings: [],
    });

    await binding.uninstallPlugin(context);
    await expect(readFile(join(home, ".distilly", "person-data"), "utf8")).resolves.toBe(
      "keep me\n",
    );
    await expect(readdir(skillRoot)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(wrapper)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(configPath, "utf8")).resolves.toBe("mcp_servers:\n");
  });

  it("retains a consistent Hermes install when rollback cannot remove its MCP entry", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const configPath = join(home, ".hermes", "config.yaml");
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const run: HostCommandRunner = {
      run: async ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
          await writeFile(
            configPath,
            `mcp_servers:\n  distilly:\n    command: ${wrapper}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
          );
          return { exitCode: 1, stdout: "", stderr: "partial failure" };
        }
        if (command === "mcp remove distilly") {
          return { exitCode: 1, stdout: "", stderr: "remove failure" };
        }
        throw new Error(`unexpected Hermes command: ${command}`);
      },
    };
    const binding = createHermesHostBinding(options("hermes", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "storage_corrupt" });
    await expect(
      readFile(join(home, ".hermes", "skills", "distilly", "SKILL.md"), "utf8"),
    ).resolves.toContain("Distilly");
    await expect(readFile(wrapper, "utf8")).resolves.toContain("--host hermes");
    await expect(readFile(configPath, "utf8")).resolves.toContain(wrapper);
  });

  it("refuses to remove a Skill that uses a pre-existing Hermes MCP entry", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const configPath = join(home, ".hermes", "config.yaml");
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const run: HostCommandRunner = {
      run: async ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
          await writeFile(
            configPath,
            `mcp_servers:\n  distilly:\n    command: ${hermesCommandScalar(wrapper)}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
            { mode: 0o600 },
          );
          return success();
        }
        if (command.startsWith("config set")) {
          const key = command.endsWith("resources false") ? "resources" : "prompts";
          await writeFile(
            configPath,
            (await readFile(configPath, "utf8")).replace(`${key}: true`, `${key}: false`),
          );
          return success();
        }
        if (command === "mcp test distilly") return success("Connected\nTools discovered: 5\n");
        throw new Error(`unexpected Hermes command: ${command}`);
      },
    };
    const binding = createHermesHostBinding(options("hermes", home, run));
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
      runtimeVersion: releaseVersion,
    };

    await binding.installPlugin(context);
    const manifestPath = join(home, ".hermes", "skills", "distilly", ".distilly-install.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, configOwned: false })}\n`);
    await expect(binding.uninstallPlugin(context)).rejects.toMatchObject({
      code: "storage_corrupt",
    });
    await expect(readFile(configPath, "utf8")).resolves.toContain(wrapper);
    await expect(
      readFile(join(home, ".hermes", "skills", "distilly", "SKILL.md")),
    ).resolves.toBeDefined();
  });

  it("does not accept a tool count greater than five", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const configPath = join(home, ".hermes", "config.yaml");
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const run: HostCommandRunner = {
      run: async ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
          await writeFile(
            configPath,
            `mcp_servers:\n  distilly:\n    command: ${hermesCommandScalar(wrapper)}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
          );
          return success();
        }
        if (command.startsWith("config set")) {
          const key = command.endsWith("resources false") ? "resources" : "prompts";
          await writeFile(
            configPath,
            (await readFile(configPath, "utf8")).replace(`${key}: true`, `${key}: false`),
          );
          return success();
        }
        if (command === "mcp test distilly") return success("Connected\nTools discovered: 50\n");
        if (command === "mcp remove distilly") {
          await writeFile(configPath, "mcp_servers:\n");
          return success();
        }
        throw new Error(`unexpected Hermes command: ${command}`);
      },
    };
    const binding = createHermesHostBinding(options("hermes", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "host_unsupported" });
    await expect(
      readFile(join(home, ".hermes", "skills", "distilly", "SKILL.md")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not remove a Hermes entry edited during rollback", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const configPath = join(home, ".hermes", "config.yaml");
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const run: HostCommandRunner = {
      run: async ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
          await writeFile(
            configPath,
            `mcp_servers:\n  distilly:\n    command: ${hermesCommandScalar(wrapper)}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
          );
          return success();
        }
        if (command === "config set mcp_servers.distilly.tools.resources false") {
          await writeFile(
            configPath,
            (await readFile(configPath, "utf8")).replace("resources: true", "resources: false"),
          );
          return success();
        }
        if (command === "config set mcp_servers.distilly.tools.prompts false") {
          // Simulate a failed command after a user edits the already-observed
          // entry; cleanup must leave the user's change in place.
          await writeFile(
            configPath,
            (await readFile(configPath, "utf8")).replace("prompts: true", "prompts: false"),
          );
          return { exitCode: 1, stdout: "", stderr: "set failed" };
        }
        if (command === "mcp remove distilly") {
          throw new Error("cleanup must not remove an externally changed entry");
        }
        throw new Error(`unexpected Hermes command: ${command}`);
      },
    };
    const binding = createHermesHostBinding(options("hermes", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "storage_corrupt" });
    await expect(readFile(configPath, "utf8")).resolves.toContain("prompts: false");
    await expect(
      readFile(join(home, ".hermes", "skills", "distilly", "SKILL.md")),
    ).resolves.toBeDefined();
  });

  it("refuses to uninstall when Hermes config contains an unknown owned-entry field", async () => {
    const parent = await temporaryHome();
    const home = join(parent, "home with spaces");
    await mkdir(home, { recursive: true });
    const launcherPath = await launcher(home);
    const wrapper = join(home, ".distilly", "bin", "distilly-hermes");
    const configPath = join(home, ".hermes", "config.yaml");
    let config = false;
    const run: HostCommandRunner = {
      run: async ({ args }) => {
        const command = args.join(" ");
        if (command === "mcp add distilly --command " + wrapper + " --connect-timeout 20") {
          config = true;
          await writeFile(
            configPath,
            `mcp_servers:\n  distilly:\n    command: ${hermesCommandScalar(wrapper)}\n    enabled: true\n    tools:\n      resources: true\n      prompts: true\n`,
            { mode: 0o600 },
          );
        } else if (command.startsWith("config set")) {
          const key = command.includes("resources") ? "resources" : "prompts";
          await writeFile(
            configPath,
            (await readFile(configPath, "utf8")).replace(`${key}: true`, `${key}: false`),
          );
        }
        return command === "mcp test distilly" ? success("Tools discovered: 5") : success();
      },
    };
    const binding = createHermesHostBinding(options("hermes", home, run));
    const context = {
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
      runtimeVersion: releaseVersion,
    };
    await binding.installPlugin(context);
    expect(config).toBe(true);
    await writeFile(
      configPath,
      (await readFile(configPath, "utf8")).replace("enabled: true", "env: SECRET"),
    );

    await expect(binding.uninstallPlugin(context)).rejects.toMatchObject({
      code: "storage_corrupt",
    });
    await expect(readFile(configPath, "utf8")).resolves.toContain("env: SECRET");
    await expect(
      readFile(join(home, ".hermes", "skills", "distilly", "SKILL.md")),
    ).resolves.toBeDefined();
  });

  it("refuses a Hermes Skill parent symlink", async () => {
    const home = await temporaryHome();
    const outside = await temporaryHome();
    const launcherPath = await launcher(home);
    await mkdir(join(home, ".hermes"), { recursive: true });
    await symlink(outside, join(home, ".hermes", "skills"), "dir");
    const run: HostCommandRunner = { run: () => Promise.resolve(success()) };
    const binding = createHermesHostBinding(options("hermes", home, run));

    await expect(
      binding.installPlugin({
        launcherPath,
        pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "shared", "skills", "distilly"),
        runtimeVersion: releaseVersion,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
