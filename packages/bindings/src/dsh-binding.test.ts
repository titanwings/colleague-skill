import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { HostCapabilities } from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { createDshHostBinding } from "./dsh/full.js";
import type { DshHostBindingOptions, HostFormPresenter } from "./protocol.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_NOW = new Date("2026-09-11T00:00:00.000Z");

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

const temporaryRoots: string[] = [];

afterEach(async () => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  }
});

const temporaryHome = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), "distilly-dsh-binding-"));
  temporaryRoots.push(home);
  return home;
};

const launcher = async (homeDirectory: string): Promise<string> => {
  const path = join(homeDirectory, ".distilly", "bin", "distilly");
  await mkdir(join(homeDirectory, ".distilly", "bin"), { recursive: true });
  await writeFile(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await chmod(path, 0o755);
  return path;
};

const forms: HostFormPresenter = {
  ask: (() => Promise.resolve({ text: "answer" })) as HostFormPresenter["ask"],
};

/**
 * Builds a fake DSH installation whose executable sits beside the MCP client package.
 *
 * The binding resolves the plugin package from the real executable path, so the
 * fixture mirrors the real layout instead of passing the path explicitly.
 *
 * @param root - Absolute directory that becomes the installation root.
 * @returns Absolute path of the fake DSH executable.
 */
const dshInstallation = async (root: string): Promise<string> => {
  const packageRoot = join(root, "node_modules", "@deepseek-ai", "dsh");
  const clientRoot = join(root, "node_modules", "@deepseek-ai", "dsh-mcp-client");
  await mkdir(join(packageRoot, "lib"), { recursive: true });
  await mkdir(join(clientRoot, "lib"), { recursive: true });
  await writeFile(join(packageRoot, "lib", "bin.js"), "#!/usr/bin/env node\n", { mode: 0o755 });
  await writeFile(
    join(clientRoot, "package.json"),
    `${JSON.stringify({ name: "@deepseek-ai/dsh-mcp-client", version: "0.0.0" })}\n`,
  );
  return join(packageRoot, "lib", "bin.js");
};

const options = async (homeDirectory: string): Promise<DshHostBindingOptions> => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, "plugins", "release-manifest.json"), "utf8"),
  ) as { releaseVersion: string; canonicalSkill: { digest: `sha256_${string}` } };
  return {
    homeDirectory,
    forms,
    now: () => FIXED_NOW,
    executablePath: await dshInstallation(homeDirectory),
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
            host: "dsh",
            hostVersion: "v0.1.5-rc.1",
            environment: context.environment,
            releaseVersion: manifest.releaseVersion,
            wireMajor: 3,
            canonicalSkillDigest: manifest.canonicalSkill.digest,
          },
          warnings: [],
        }),
    },
    release: {
      releaseVersion: manifest.releaseVersion,
      wireMajor: 3,
      canonicalSkillDigest: manifest.canonicalSkill.digest,
    },
  };
};

describe("DeepSeek Harness full binding", () => {
  it("owns a dedicated profile, inserts exactly one MCP row, and mirrors the Skill", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const binding = createDshHostBinding(await options(home));

    const result = await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "dsh"),
      runtimeVersion: "0.1.0-preview.1",
    });

    const profileRoot = join(home, "profiles", "distilly");
    expect(result.host).toBe("dsh");
    expect(result.manifestPath).toBe(join(profileRoot, "package.json"));
    expect(result.restartRequired).toBe(true);

    const manifest = JSON.parse(await readFile(join(profileRoot, "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    expect(manifest.name).toBe("distilly");
    expect(manifest.version).toBe("0.1.0-preview.1");
    const composition = JSON.parse(
      await readFile(join(profileRoot, "distilly-profile.json"), "utf8"),
    ) as { dsh: { profile: { bundles: readonly string[]; patchReload: string } } };
    expect(composition.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-headless",
    ]);
    expect(composition.dsh.profile.patchReload).toBe("startup");

    const patch = await readFile(join(profileRoot, "cordis.patch.yml"), "utf8");
    expect(patch).toContain("- insert:");
    expect(patch).toContain("id: mcp-distilly");
    expect(patch).toContain("serverName: distilly");
    expect(patch).toContain("transport: stdio");
    expect(patch).toContain(`command: '${launcherPath}'`);
    expect(patch).toContain("- mcp");
    expect(patch).toContain("- '--host'");
    expect(patch).toContain("- 'dsh'");
    expect(patch).toContain(join(home, "node_modules", "@deepseek-ai", "dsh-mcp-client"));

    const canonical = await readFile(join(profileRoot, "skills", "distilly", "SKILL.md"), "utf8");
    const mirrored = await readFile(join(home, "skills", "distilly", "SKILL.md"), "utf8");
    expect(mirrored).toBe(canonical);
  });

  it("reports health and removes only owned profile and skill state on uninstall", async () => {
    const home = await temporaryHome();
    const launcherPath = await launcher(home);
    const binding = createDshHostBinding(await options(home));
    await binding.installPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "dsh"),
      runtimeVersion: "0.1.0-preview.1",
    });

    const foreign = join(home, "profiles", "user-owned", "cordis.patch.yml");
    await mkdir(join(home, "profiles", "user-owned"), { recursive: true });
    await writeFile(foreign, "# user owned\n[]\n");
    const personData = join(home, ".distilly", "people", "keep.txt");
    await mkdir(join(home, ".distilly", "people"), { recursive: true });
    await writeFile(personData, "keep me\n");

    const health = await binding.doctor({ sessionId: "dsh-doctor", environment: "cli" });
    expect(health.installed).toBe(true);
    expect(health.wireCompatible).toBe(true);
    expect(health.warnings).toEqual([]);

    await binding.uninstallPlugin({
      launcherPath,
      pluginSourcePath: join(REPOSITORY_ROOT, "plugins", "dsh"),
      runtimeVersion: "0.1.0-preview.1",
    });

    expect(existsSync(join(home, "profiles", "distilly"))).toBe(false);
    expect(existsSync(join(home, "skills", "distilly"))).toBe(false);
    expect(existsSync(foreign)).toBe(true);
    expect(await readFile(personData, "utf8")).toBe("keep me\n");
  });

  it("refuses a DSH tree that does not expose the MCP client package", async () => {
    const home = await temporaryHome();
    // Build a DSH executable whose nearest node_modules has no MCP client package.
    const lone = join(home, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
    await mkdir(join(home, "node_modules", "@deepseek-ai", "dsh", "lib"), { recursive: true });
    await writeFile(lone, "#!/usr/bin/env node\n", { mode: 0o755 });
    const manifest = JSON.parse(
      await readFile(join(REPOSITORY_ROOT, "plugins", "release-manifest.json"), "utf8"),
    ) as { releaseVersion: string; canonicalSkill: { digest: `sha256_${string}` } };
    let failure: unknown;
    try {
      createDshHostBinding({
        homeDirectory: home,
        forms,
        now: () => FIXED_NOW,
        executablePath: lone,
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
                host: "dsh",
                hostVersion: "v0.1.5-rc.1",
                environment: context.environment,
                releaseVersion: manifest.releaseVersion,
                wireMajor: 3,
                canonicalSkillDigest: manifest.canonicalSkill.digest,
              },
              warnings: [],
            }),
        },
        release: {
          releaseVersion: manifest.releaseVersion,
          wireMajor: 3,
          canonicalSkillDigest: manifest.canonicalSkill.digest,
        },
      });
    } catch (error) {
      failure = error;
    }
    expect(failure === undefined ? "constructed" : (failure as Error).message).toMatch(
      /dsh-mcp-client/u,
    );
  });
});
