// Proves the release check passes on the real tree and fails on each kind of drift.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const roots = [];

/** Copies the files the release check reads into a small tree it can be pointed at. */
const releaseTree = async () => {
  const root = await mkdtemp(join(tmpdir(), "distilly-release-"));
  roots.push(root);
  for (const path of ["scripts/check_release.mjs", "CHANGELOG.md", "plugins"]) {
    await cp(join(REPOSITORY_ROOT, path), join(root, path), { recursive: true });
  }
  await cp(
    join(REPOSITORY_ROOT, "packages/cli/src/evidence"),
    join(root, "packages/cli/src/evidence"),
    { recursive: true },
  );
  const packages = ["adapters", "bindings", "cli", "distilly", "engine", "mcp", "panel", "protocol", "runtime"];
  for (const name of packages) {
    await cp(join(REPOSITORY_ROOT, "packages", name, "package.json"), join(root, "packages", name, "package.json"), { recursive: true });
  }
  return root;
};

const runCheck = (root) =>
  spawnSync(process.execPath, [join(root, "scripts", "check_release.mjs")], {
    env: { ...process.env, DISTILLY_RELEASE_ROOT: root },
    encoding: "utf8",
  });

after(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("release consistency check", () => {
  it("passes on an unmodified copy of the release tree", async () => {
    const root = await releaseTree();
    const result = runCheck(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /release check passed/u);
  });

  it("fails when a capacity fixture was measured for another release", async () => {
    const root = await releaseTree();
    const fixture = join(
      root,
      "packages/cli/src/evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v2.json",
    );
    const parsed = JSON.parse(await readFile(fixture, "utf8"));
    parsed.releaseVersion = "0.0.0-previous";
    await writeFile(fixture, `${JSON.stringify(parsed)}\n`);
    const result = runCheck(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /was measured for release 0\.0\.0-previous/u);
  });

  it("fails when the canonical Skill tree no longer matches the manifest digest", async () => {
    const root = await releaseTree();
    const skill = join(root, "plugins/shared/skills/distilly/SKILL.md");
    await writeFile(skill, `${await readFile(skill, "utf8")}\nchanged\n`);
    const result = runCheck(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /canonicalSkill\.digest|canonical Skill file/u);
  });

  it("fails when a host target's plugin manifest version drifts", async () => {
    const root = await releaseTree();
    const manifest = join(root, "plugins/codex/.codex-plugin/plugin.json");
    const parsed = JSON.parse(await readFile(manifest, "utf8"));
    parsed.version = "9.9.9";
    await writeFile(manifest, `${JSON.stringify(parsed, undefined, 2)}\n`);
    const result = runCheck(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /declares version 9\.9\.9/u);
  });

  it("fails when the changelog has no section for the release", async () => {
    const root = await releaseTree();
    await writeFile(join(root, "CHANGELOG.md"), "# Changelog\n\nNothing here yet.\n");
    const result = runCheck(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CHANGELOG\.md has no section/u);
  });

  it("fails when a token budget is not derived from the measured bytes", async () => {
    const root = await releaseTree();
    const fixture = join(
      root,
      "packages/cli/src/evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v2.json",
    );
    const parsed = JSON.parse(await readFile(fixture, "utf8"));
    parsed.capacity.estimatedInputTokens = parsed.capacity.verifiedBriefingBytes;
    await writeFile(fixture, `${JSON.stringify(parsed)}\n`);
    const result = runCheck(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /token budget that is not derived/u);
  });
});
