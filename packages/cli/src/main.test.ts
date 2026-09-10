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
  dshHomeDirectory: "/tmp/distilly-preview-home/.dsh",
};

describe("Developer Preview CLI host boundary", () => {
  it.each([
    ["setup", ["setup", "--host", "other-host"]],
    ["doctor", ["doctor", "--host", "other-host"]],
    ["uninstall", ["uninstall", "--host", "other-host"]],
    ["mcp", ["mcp", "--host", "other-host"]],
    ["panel", ["panel", "--host", "other-host"]],
    ["harvest", ["harvest", "/tmp/evidence", "--host", "other-host", "--name", "Ada"]],
    ["show", ["show", `subject_${"a".repeat(32)}`, "--host", "other-host"]],
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

  it("requires a subject id or name and a host for show", async () => {
    const io = {
      stdout: { write: (value: string) => value },
      stderr: { write: (value: string) => value },
    };
    await expect(runPreviewCli(["show", "--host", "codex"], environment, io)).rejects.toThrow(
      "This command requires a subject id or display name, then --host <host>.",
    );
    await expect(
      runPreviewCli(["show", `subject_${"a".repeat(32)}`], environment, io),
    ).rejects.toThrow("This command requires --host.");
    await expect(
      runPreviewCli(
        ["show", `subject_${"a".repeat(32)}`, "--host", "codex", "--nope", "1"],
        environment,
        io,
      ),
    ).rejects.toThrow("Unknown show option: --nope.");
  });

  it("requires a host for the subjects listing and rejects unknown options", async () => {
    const stdout: string[] = [];
    const io = {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => value },
    };
    await expect(runPreviewCli(["subjects"], environment, io)).rejects.toThrow(
      "This command requires --host.",
    );
    await expect(
      runPreviewCli(["subjects", "--host", "codex", "--nope", "1"], environment, io),
    ).rejects.toThrow("Unknown subjects option: --nope.");
    await expect(
      runPreviewCli(["subjects", "--host", "codex", "--limit", "0"], environment, io),
    ).rejects.toThrow("--limit must be positive.");
    expect(stdout).toEqual([]);
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

  it("requires a host for personas and a subject plus host for remove", async () => {
    const stdout: string[] = [];
    const io = {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => value },
    };
    await expect(runPreviewCli(["personas"], environment, io)).rejects.toThrow(
      "This command requires --host.",
    );
    await expect(
      runPreviewCli(["personas", "--host", "codex", "--nope", "1"], environment, io),
    ).rejects.toThrow("Unknown personas option: --nope.");
    await expect(runPreviewCli(["remove", "--host", "codex"], environment, io)).rejects.toThrow(
      "This command requires a subject id or display name, then --host <host>.",
    );
    await expect(
      runPreviewCli(["remove", "   ", "--host", "codex"], environment, io),
    ).rejects.toThrow("This command requires a subject id or display name, then --host <host>.");
    await expect(
      runPreviewCli(["remove", `subject_${"a".repeat(32)}`], environment, io),
    ).rejects.toThrow("This command requires --host.");
    await expect(
      runPreviewCli(
        ["remove", `subject_${"a".repeat(32)}`, "--host", "codex", "--nope", "1"],
        environment,
        io,
      ),
    ).rejects.toThrow("Unknown remove option: --nope.");
    expect(stdout).toEqual([]);
  });

  it("requires a subject and the right flags for the version commands", async () => {
    const stdout: string[] = [];
    const io = {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => value },
    };
    for (const command of ["versions", "diff", "rollback"]) {
      await expect(runPreviewCli([command, "--host", "codex"], environment, io)).rejects.toThrow(
        "This command requires a subject id or display name, then --host <host>.",
      );
      await expect(
        runPreviewCli([command, `subject_${"a".repeat(32)}`], environment, io),
      ).rejects.toThrow("This command requires --host.");
    }
    await expect(
      runPreviewCli(
        ["versions", `subject_${"a".repeat(32)}`, "--host", "codex", "--nope", "1"],
        environment,
        io,
      ),
    ).rejects.toThrow("Unknown versions option: --nope.");
    await expect(
      runPreviewCli(
        ["diff", `subject_${"a".repeat(32)}`, "--host", "codex", "--reason", "x"],
        environment,
        io,
      ),
    ).rejects.toThrow("Unknown diff option: --reason.");
    await expect(
      runPreviewCli(
        ["rollback", `subject_${"a".repeat(32)}`, "--host", "codex", "--from", "x"],
        environment,
        io,
      ),
    ).rejects.toThrow("Unknown rollback option: --from.");
    await expect(
      runPreviewCli(
        ["versions", `subject_${"a".repeat(32)}`, "--host", "codex", "--limit", "0"],
        environment,
        io,
      ),
    ).rejects.toThrow("--limit must be positive.");
    expect(stdout).toEqual([]);
  });

  it("documents the version commands", async () => {
    const stdout: string[] = [];
    await expect(
      runPreviewCli(["--help"], environment, {
        stdout: { write: (value: string) => stdout.push(value) },
        stderr: { write: (value: string) => value },
      }),
    ).resolves.toBe(0);
    expect(stdout.join("")).toContain("distilly versions <subject-id|display-name> --host <host>");
    expect(stdout.join("")).toContain("distilly diff <subject-id|display-name> --host <host>");
    expect(stdout.join("")).toContain("distilly rollback <subject-id|display-name> --host <host>");
  });

  it("documents the person Skill lifecycle commands", async () => {
    const stdout: string[] = [];
    await expect(
      runPreviewCli(["--help"], environment, {
        stdout: { write: (value: string) => stdout.push(value) },
        stderr: { write: (value: string) => value },
      }),
    ).resolves.toBe(0);
    expect(stdout.join("")).toContain("distilly personas --host <host>");
    expect(stdout.join("")).toContain("distilly remove <subject-id|display-name> --host <host>");
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
    expect(stdout.join("")).toContain("distilly subjects --host <host>");
    expect(stdout.join("")).toContain("distilly show <subject-id|display-name>");
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
