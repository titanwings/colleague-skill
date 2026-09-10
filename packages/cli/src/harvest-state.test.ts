import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EMPTY_HARVEST_STATE,
  hashFile,
  loadHarvestState,
  planHarvest,
  recordHarvest,
  recordedPath,
  saveHarvestState,
  type HarvestState,
} from "./harvest-state.js";

import type { HarvestFile } from "./harvest.js";

const roots: string[] = [];

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-harvest-state-"));
  roots.push(root);
  return root;
};

const file = (path: string, name: string, sizeBytes = 10): HarvestFile => ({
  path,
  pathLabel: name,
  mediaType: "text/markdown",
  relativePath: name,
  sizeBytes,
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("harvest record", () => {
  it("round-trips entries and replaces the entry for a re-ingested path", async () => {
    const root = await temporaryRoot();
    const path = join(root, "harvest-state.json");
    const note = join(root, "note.md");
    await writeFile(note, "first version\n");
    const digest = await hashFile(note);
    const first = recordHarvest(EMPTY_HARVEST_STATE, "subject_a", [
      { ...file(note, "note.md"), sha256: digest, recordedPath: note },
    ]);
    await saveHarvestState(path, first);
    const loaded = await loadHarvestState(path);
    expect(loaded.entries["subject_a"]).toEqual([{ path: note, sha256: digest, sizeBytes: 10 }]);

    await writeFile(note, "second version\n");
    const second = recordHarvest(loaded, "subject_a", [
      { ...file(note, "note.md", 15), sha256: await hashFile(note), recordedPath: note },
    ]);
    expect(second.entries["subject_a"]).toHaveLength(1);
    expect(second.entries["subject_a"]?.[0]?.sha256).not.toBe(digest);
  });

  it("treats a missing, malformed, or hand-edited record as nothing recorded", async () => {
    const root = await temporaryRoot();
    const path = join(root, "harvest-state.json");
    expect(await loadHarvestState(path)).toEqual(EMPTY_HARVEST_STATE);

    await writeFile(path, "{ not json");
    expect(await loadHarvestState(path)).toEqual(EMPTY_HARVEST_STATE);

    await writeFile(path, JSON.stringify({ version: 2, entries: {} }));
    expect(await loadHarvestState(path)).toEqual(EMPTY_HARVEST_STATE);

    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        entries: { subject_a: [{ path: "/tmp/a", sha256: "short", sizeBytes: 1 }, null] },
      }),
    );
    expect(await loadHarvestState(path)).toEqual(EMPTY_HARVEST_STATE);
  });

  it("keeps valid entries when a record mixes valid and invalid ones", async () => {
    const root = await temporaryRoot();
    const path = join(root, "harvest-state.json");
    const digest = "a".repeat(64);
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        entries: {
          subject_a: [{ path: "/tmp/a.md", sha256: digest, sizeBytes: 3 }, { path: "/tmp/b" }],
          subject_b: "not a list",
        },
      }),
    );
    const loaded = await loadHarvestState(path);
    expect(loaded.entries["subject_a"]).toEqual([
      { path: "/tmp/a.md", sha256: digest, sizeBytes: 3 },
    ]);
    expect(loaded.entries["subject_b"]).toBeUndefined();
  });
});

describe("harvest dedupe plan", () => {
  const digest = "b".repeat(64);

  it("skips only files whose recorded bytes match and keeps edited ones", () => {
    const files = [
      { ...file("/data/same.md", "same.md"), sha256: digest, recordedPath: "/data/same.md" },
      {
        ...file("/data/edited.md", "edited.md"),
        sha256: "c".repeat(64),
        recordedPath: "/data/edited.md",
      },
      { ...file("/data/new.md", "new.md"), sha256: "d".repeat(64), recordedPath: "/data/new.md" },
    ];
    const plan = planHarvest(files, [
      { path: "/data/same.md", sha256: digest, sizeBytes: 10 },
      { path: "/data/edited.md", sha256: "e".repeat(64), sizeBytes: 10 },
    ]);
    expect(plan.alreadyIngested.map((entry) => entry.pathLabel)).toEqual(["same.md"]);
    expect(plan.ingest.map((entry) => entry.pathLabel)).toEqual(["edited.md", "new.md"]);
  });

  it("matches a recorded entry only when the real path is identical", () => {
    const plan = planHarvest(
      [
        {
          ...file("/data/sub/note.md", "note.md"),
          sha256: digest,
          recordedPath: "/private/data/sub/note.md",
        },
      ],
      [{ path: "/private/data/sub/note.md", sha256: digest, sizeBytes: 10 }],
    );
    expect(plan.alreadyIngested).toHaveLength(1);
    expect(plan.ingest).toHaveLength(0);
    const other = planHarvest(
      [
        {
          ...file("/data/sub/note.md", "note.md"),
          sha256: digest,
          recordedPath: "/data/sub/note.md",
        },
      ],
      [{ path: "/private/data/sub/note.md", sha256: digest, sizeBytes: 10 }],
    );
    expect(other.ingest).toHaveLength(1);
  });

  it("records a state per subject, so another subject still ingests the same bytes", () => {
    const entry = {
      ...file("/data/note.md", "note.md"),
      sha256: digest,
      recordedPath: "/data/note.md",
    };
    const first: HarvestState = recordHarvest(EMPTY_HARVEST_STATE, "subject_a", [entry]);
    expect(
      planHarvest(
        [{ ...file("/data/note.md", "note.md"), sha256: digest, recordedPath: "/data/note.md" }],
        first.entries["subject_b"] ?? [],
      ).ingest,
    ).toHaveLength(1);
    expect(
      planHarvest(
        [{ ...file("/data/note.md", "note.md"), sha256: digest, recordedPath: "/data/note.md" }],
        first.entries["subject_a"] ?? [],
      ).alreadyIngested,
    ).toHaveLength(1);
  });
});

describe("recorded path", () => {
  it("resolves a symlinked path to the real one and falls back for a missing file", async () => {
    const root = await temporaryRoot();
    const target = join(root, "real");
    await mkdir(target);
    await writeFile(join(target, "note.md"), "note\n");
    const link = join(root, "link");
    await symlink(target, link, "dir");
    expect(await recordedPath(join(link, "note.md"))).toBe(join(await realpath(target), "note.md"));
    expect(await recordedPath(join(root, "missing.md"))).toBe(join(root, "missing.md"));
  });
});

describe("file hashing", () => {
  it("hashes the exact bytes", async () => {
    const root = await temporaryRoot();
    const path = join(root, "note.md");
    await writeFile(path, "abc");
    expect(await hashFile(path)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect((await readFile(path, "utf8")).length).toBe(3);
  });
});
