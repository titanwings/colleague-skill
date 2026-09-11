import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_HOSTS } from "@distilly/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  doctorPreview,
  requireInstalledPreviewBinding,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";
import { PREVIEW_RUNTIME_MANIFEST } from "./runtime-package.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_NOW = new Date("2026-08-31T12:00:00.000Z");
const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const executable = async (path: string, version: string): Promise<void> => {
  await writeFile(
    path,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  printf '%s\\n' '${version}'\nfi\nexit 0\n`,
    { mode: 0o755 },
  );
  await chmod(path, 0o755);
};

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const packageDigest = (bytes: Uint8Array): `sha256_${string}` =>
  `sha256_${createHash("sha256").update(bytes).digest("hex")}`;

const packageFiles = async (root: string, current = root): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await packageFiles(root, path)));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
  }
  return files;
};

const packagedEnvironment = async (
  root: string,
  environment: PreviewLifecycleEnvironment,
): Promise<PreviewLifecycleEnvironment> => {
  const runtime = join(root, "Preview 包");
  const contents = new Map<string, string>([
    ["distilly", "#!/bin/sh\nexit 0\n"],
    ["package.json", '{"name":"@distilly/codex-preview","version":"0.1.0-preview.1"}\n'],
    ["packages/cli/lib/bin.js", "// packaged entry\n"],
    ["packages/panel/web/index.html", "<!doctype html>\n"],
    ["packages/prompts/host-distill-v1.md", "# Host prompt\n"],
  ]);
  await mkdir(runtime);
  for (const [path, content] of contents) {
    const target = join(runtime, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await mkdir(join(runtime, "plugins/codex/.codex-plugin"), { recursive: true });
  await cp(
    join(REPOSITORY_ROOT, "plugins/release-manifest.json"),
    join(runtime, "plugins/release-manifest.json"),
  );
  await cp(
    join(REPOSITORY_ROOT, "plugins/codex/.codex-plugin/plugin.json"),
    join(runtime, "plugins/codex/.codex-plugin/plugin.json"),
  );
  await cp(join(REPOSITORY_ROOT, "plugins/codex/skills"), join(runtime, "plugins/codex/skills"), {
    recursive: true,
  });
  await mkdir(join(runtime, "plugins/claude-code/.claude-plugin"), { recursive: true });
  await cp(
    join(REPOSITORY_ROOT, "plugins/claude-code/.claude-plugin/plugin.json"),
    join(runtime, "plugins/claude-code/.claude-plugin/plugin.json"),
  );
  await cp(
    join(REPOSITORY_ROOT, "plugins/claude-code/skills"),
    join(runtime, "plugins/claude-code/skills"),
    { recursive: true },
  );
  await cp(join(REPOSITORY_ROOT, "plugins/shared/skills"), join(runtime, "plugins/shared/skills"), {
    recursive: true,
  });
  const files = (await packageFiles(runtime)).sort(compareUtf8);
  const records = await Promise.all(
    files.map(async (path) => ({
      path,
      contentDigest: packageDigest(await readFile(join(runtime, path))),
    })),
  );
  await writeFile(
    join(runtime, PREVIEW_RUNTIME_MANIFEST),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        releaseVersion: "0.1.0-preview.1",
        entryPath: "packages/cli/lib/bin.js",
        pluginSourcesPath: "plugins",
        panelAssetsPath: "packages/panel/web",
        files: records,
      },
      undefined,
      2,
    )}\n`,
  );
  return {
    ...environment,
    entryPath: join(runtime, "packages/cli/lib/bin.js"),
    pluginSourcesPath: join(runtime, "plugins"),
    runtimePackagePath: runtime,
  };
};

const fixture = async (): Promise<{
  readonly root: string;
  readonly home: string;
  readonly environment: PreviewLifecycleEnvironment;
}> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-cli-lifecycle-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  const bin = join(root, "host-bin");
  const entryPath = join(root, "distilly-entry.js");
  await mkdir(home);
  await mkdir(bin);
  await writeFile(entryPath, "// built Distilly entry fixture\n");
  await executable(join(bin, "codex"), "codex-cli 0.146.0");
  await executable(join(bin, "claude"), "2.1.220 (Claude Code)");
  return {
    root,
    home,
    environment: {
      homeDirectory: home,
      nodePath: process.execPath,
      entryPath,
      pluginSourcesPath: join(REPOSITORY_ROOT, "plugins"),
      pathValue: bin,
      now: () => FIXED_NOW,
    },
  };
};

describe("Developer Preview CLI lifecycle", () => {
  it("restores the installed Codex home for every host version probe", async () => {
    const { root, home, environment } = await fixture();
    const codex = join(root, "host-bin", "codex");
    const expectedCodexHome = join(home, ".codex");
    const expectedNodeDirectory = dirname(environment.nodePath);
    await writeFile(
      codex,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf '%s\n' 'codex-cli 0.146.0'
  if [ "$CODEX_HOME" != ${JSON.stringify(expectedCodexHome)} ]; then
    printf '%s\n' 'Codex home was not restored.' >&2
  fi
  if [ "\${PATH%%:*}" != ${JSON.stringify(expectedNodeDirectory)} ]; then
    printf '%s\n' 'Distilly Node was not pinned first on PATH.' >&2
  fi
fi
exit 0
`,
      { mode: 0o755 },
    );
    await chmod(codex, 0o755);

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).resolves.toMatchObject({
      host: BUILTIN_HOSTS.codex,
    });
    await expect(
      requireInstalledPreviewBinding(environment, BUILTIN_HOSTS.codex),
    ).resolves.toMatchObject({ kind: "full", host: BUILTIN_HOSTS.codex });
  });

  it("creates a safe Codex home before the first version probe", async () => {
    const { root, home, environment } = await fixture();
    const codex = join(root, "host-bin", "codex");
    await writeFile(
      codex,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ ! -d "$CODEX_HOME" ]; then
    printf '%s\n' 'Codex home is missing.' >&2
    exit 1
  fi
  printf '%s\n' 'codex-cli 0.146.0'
fi
exit 0
`,
      { mode: 0o755 },
    );
    await chmod(codex, 0o755);

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).resolves.toMatchObject({
      host: BUILTIN_HOSTS.codex,
    });
    await expect(readdir(join(home, ".codex"))).resolves.toEqual([]);
  });

  it("sets up Codex, diagnoses it, and preserves data through uninstall", async () => {
    const { home, environment } = await fixture();

    const codex = await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    const replay = await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    expect(replay).toEqual(codex);
    const launcher = join(home, ".distilly", "bin", "distilly");
    expect(codex.launcherPath).toBe(launcher);
    expect(await readFile(launcher, "utf8")).toContain(process.execPath);
    expect(
      JSON.parse(await readFile(join(home, "plugins", "distilly", ".mcp.json"), "utf8")),
    ).toEqual({
      mcpServers: {
        distilly: { command: launcher, args: ["mcp", "--host", "codex"] },
      },
    });
    await expect(doctorPreview(environment)).resolves.toMatchObject({
      ok: true,
      installed: true,
      launcherReachable: true,
      hosts: [{ host: "codex", installed: true }],
    });

    const personData = join(home, ".distilly", "people", "keep.txt");
    const personSkill = join(home, ".codex", "skills", "distilly-mira", "SKILL.md");
    await mkdir(join(home, ".distilly", "people"));
    await mkdir(join(home, ".codex", "skills", "distilly-mira"), { recursive: true });
    await writeFile(personData, "keep me\n");
    await writeFile(personSkill, "# keep this person Skill\n");
    await expect(uninstallPreviewHost(BUILTIN_HOSTS.codex, environment)).resolves.toEqual({
      host: BUILTIN_HOSTS.codex,
      removed: true,
      launcherRemoved: true,
    });
    await expect(readFile(launcher)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(personData, "utf8")).resolves.toBe("keep me\n");
    await expect(readFile(personSkill, "utf8")).resolves.toBe("# keep this person Skill\n");
  });

  it("reports tampered lifecycle bytes and refuses destructive uninstall", async () => {
    const { home, environment } = await fixture();
    await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    const launcher = join(home, ".distilly", "bin", "distilly");
    const personData = join(home, ".distilly", "people", "keep.txt");
    await mkdir(join(home, ".distilly", "people"));
    await writeFile(personData, "keep me\n");
    await writeFile(launcher, "#!/bin/sh\nexit 9\n", { mode: 0o755 });

    await expect(doctorPreview(environment)).resolves.toMatchObject({
      ok: false,
      installed: true,
      launcherReachable: false,
    });
    await expect(uninstallPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /missing or modified/u,
    );
    await expect(readFile(personData, "utf8")).resolves.toBe("keep me\n");
    await expect(readFile(launcher, "utf8")).resolves.toContain("exit 9");
  });

  it("copies a packaged runtime and refuses to remove a modified installed byte", async () => {
    const { root, home, environment } = await fixture();
    const packaged = await packagedEnvironment(root, environment);
    await setupPreviewHost(BUILTIN_HOSTS.codex, packaged);
    const installedEntry = join(home, ".distilly/runtime/0.1.0-preview.1/packages/cli/lib/bin.js");
    await writeFile(installedEntry, "// tampered packaged entry\n");

    await expect(doctorPreview(packaged)).resolves.toMatchObject({
      ok: false,
      installed: true,
      launcherReachable: false,
    });
    await expect(uninstallPreviewHost(BUILTIN_HOSTS.codex, packaged)).rejects.toThrow(/modified/u);
    await expect(readFile(installedEntry, "utf8")).resolves.toBe("// tampered packaged entry\n");
    await expect(readFile(join(home, "plugins/distilly/.mcp.json"), "utf8")).resolves.toContain(
      "mcpServers",
    );
  });

  it("removes a new bootstrap when no supported host executable is found", async () => {
    const { home, environment } = await fixture();

    await expect(
      setupPreviewHost(BUILTIN_HOSTS.codex, { ...environment, pathValue: "" }),
    ).rejects.toThrow(/Could not find/u);
    await expect(readFile(join(home, ".distilly", "bin", "distilly"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("accepts a source-install provenance suffix on the Hermes version line", async () => {
    // A real source install prints "Hermes Agent v0.19.0 (2026.7.20) · upstream 01906e99".
    // The suffix is dropped so a rebuild of the same release is not read as an upgrade and
    // the host is not rejected as an invalid version.
    const home = await mkdtemp(join(tmpdir(), "distilly-hermes-version-"));
    temporaryRoots.push(home);
    const bin = join(home, "bin");
    await mkdir(bin, { recursive: true });
    const hermes = join(bin, "hermes");
    await executable(hermes, "Hermes Agent v0.19.0 (2026.7.20) · upstream 01906e99");

    const failure = await setupPreviewHost(
      BUILTIN_HOSTS.hermes,
      {
        homeDirectory: home,
        nodePath: process.execPath,
        entryPath: join(home, "entry.js"),
        pluginSourcesPath: join(home, "plugins"),
        pathValue: bin,
      },
      { allowUnverifiedHost: true },
    ).then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    // The probe must not be the failing step; whatever fails later, it is never the version.
    expect(failure).toBeDefined();
    expect(failure).not.toMatch(/invalid version/u);
  });

  it("fails before writing when the observed host version has no exact fixture", async () => {
    const { root, home, environment } = await fixture();
    await executable(join(root, "host-bin", "codex"), "codex-cli 99.0.0");

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /codex-cli 99\.0\.0 has no recorded capacity fixture/u,
    );
    // The message must name the way forward, or a host update is a dead end.
    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /--allow-unverified-host/u,
    );
    await expect(readFile(join(home, ".distilly", "install.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails before writing for a host whose real capacity evidence is not installed", async () => {
    const { home, environment } = await fixture();

    await expect(setupPreviewHost(BUILTIN_HOSTS.claudeCode, environment)).rejects.toThrow(
      /verified Distilly briefing capacity/u,
    );
    await expect(readFile(join(home, ".distilly", "install.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("accepts OpenClaw and Hermes host boundaries but fails closed for unknown versions", async () => {
    const { root, home, environment } = await fixture();
    vi.stubEnv("DISTILLY_TEST_SECRET", "must-not-cross-the-host-boundary");
    const openclaw = join(root, "host-bin", "openclaw");
    await writeFile(
      openclaw,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ -n "\${DISTILLY_TEST_SECRET:-}" ]; then
    printf '%s\\n' 'Parent secret reached OpenClaw.' >&2
    exit 1
  fi
  if [ "$OPENCLAW_STATE_DIR" != ${JSON.stringify(join(home, ".openclaw"))} ] || [ "$OPENCLAW_CONFIG_PATH" != ${JSON.stringify(join(home, ".openclaw", "openclaw.json"))} ]; then
    printf '%s\\n' 'OpenClaw state was not isolated.' >&2
    exit 1
  fi
  printf '%s\\n' 'OpenClaw 2026.3.25 (unrecorded)'
fi
exit 0
`,
      { mode: 0o755 },
    );
    await chmod(openclaw, 0o755);
    const hermes = join(root, "host-bin", "hermes");
    await writeFile(
      hermes,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ -n "\${DISTILLY_TEST_SECRET:-}" ]; then
    printf '%s\\n' 'Parent secret reached Hermes.' >&2
    exit 1
  fi
  if [ "$HERMES_HOME" != ${JSON.stringify(join(home, ".hermes"))} ]; then
    printf '%s\\n' 'Hermes home was not isolated.' >&2
    exit 1
  fi
  printf '%s\\n' 'Hermes Agent v0.9.1 (unrecorded)'
  printf '%s\\n' 'Project: hermes-agent'
fi
exit 0
`,
      { mode: 0o755 },
    );
    await chmod(hermes, 0o755);

    for (const host of [BUILTIN_HOSTS.openclaw, BUILTIN_HOSTS.hermes]) {
      await expect(setupPreviewHost(host, environment)).rejects.toThrow(
        /verified Distilly briefing capacity/u,
      );
    }
    await expect(readFile(join(home, ".distilly", "install.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses lifecycle parent symlinks without writing outside the data root", async () => {
    const { root, home, environment } = await fixture();
    const outside = join(root, "outside-bin");
    await mkdir(outside);
    await mkdir(join(home, ".distilly"));
    await symlink(outside, join(home, ".distilly", "bin"), "dir");

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /lifecycle directory/u,
    );
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
