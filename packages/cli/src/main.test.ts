import { describe, expect, it } from "vitest";

import { runPreviewCli, type PreviewCliEnvironment } from "./main.js";

const environment: PreviewCliEnvironment = {
  lifecycle: {
    homeDirectory: "/tmp/distilly-preview-home",
    nodePath: "/usr/bin/node",
    entryPath: "/tmp/distilly-preview-cli.js",
    pluginSourcesPath: "/tmp/distilly-preview-plugins",
    pathValue: "",
  },
  panelAssetsPath: "/tmp/distilly-preview-panel",
};

describe("Developer Preview CLI host boundary", () => {
  it.each([
    ["setup", ["setup", "--host", "other-host"]],
    ["doctor", ["doctor", "--host", "other-host"]],
    ["uninstall", ["uninstall", "--host", "other-host"]],
    ["mcp", ["mcp", "--host", "other-host"]],
    ["panel", ["panel", "--host", "other-host"]],
    ["harvest", ["harvest", "/tmp/evidence", "--host", "other-host", "--name", "Ada"]],
    ["person install", ["install", `subject_${"a".repeat(32)}`, "--host", "other-host"]],
  ])(
    "offers an explicit legacy guide for unsupported %s without switching modes",
    async (_, argv) => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      await expect(
        runPreviewCli(argv, environment, {
          stdout: { write: (value) => stdout.push(value) },
          stderr: { write: (value) => stderr.push(value) },
        }),
      ).rejects.toThrow(
        "https://github.com/titanwings/distilly/blob/distilly-plugin/INSTALL.md#legacy-skill-compatibility-for-hosts-without-a-verified-plugin-binding",
      );

      expect(stdout).toEqual([]);
      expect(stderr).toEqual([]);
    },
  );

  it("links the legacy compatibility guide from help", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    await expect(
      runPreviewCli(["--help"], environment, {
        stdout: { write: (value) => stdout.push(value) },
        stderr: { write: (value) => stderr.push(value) },
      }),
    ).resolves.toBe(0);

    expect(stdout.join("")).toContain("Legacy Skill compatibility path documented in INSTALL.md");
    expect(stderr).toEqual([]);
  });

  it("requires a directory and exactly one subject selector for harvest", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
    };

    await expect(
      runPreviewCli(["harvest", "--host", "codex", "--name", "Ada"], environment, io),
    ).rejects.toThrow("This command requires a directory path, then --host <host>.");

    await expect(
      runPreviewCli(["harvest", "/tmp/evidence", "--host", "codex"], environment, io),
    ).rejects.toThrow("Pass exactly one of --subject <subject-id> or --name <display-name>.");

    await expect(
      runPreviewCli(
        ["harvest", "/tmp/evidence", "--host", "codex", "--name", "Ada", "--subject", "s"],
        environment,
        io,
      ),
    ).rejects.toThrow("Pass exactly one of --subject <subject-id> or --name <display-name>.");

    expect(stdout).toEqual([]);
  });

  it("documents the standalone panel command and the dsh host", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    await expect(
      runPreviewCli(["--help"], environment, {
        stdout: { write: (value) => stdout.push(value) },
        stderr: { write: (value) => stderr.push(value) },
      }),
    ).resolves.toBe(0);

    expect(stdout.join("")).toContain("distilly panel --host <host>");
    expect(stdout.join("")).toContain("distilly harvest <directory>");
    expect(stdout.join("")).toContain("codex | claude-code | openclaw | hermes | dsh");
    expect(stderr).toEqual([]);
  });

  it("requires --host for the standalone panel command", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    await expect(
      runPreviewCli(["panel"], environment, {
        stdout: { write: (value) => stdout.push(value) },
        stderr: { write: (value) => stderr.push(value) },
      }),
    ).rejects.toThrow("This command requires --host.");
    expect(stdout).toEqual([]);
  });
});
