import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isLegacyPersonDirectory, listLegacyPeople, readLegacyPerson } from "./legacy-import.js";

const roots: string[] = [];

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-legacy-"));
  roots.push(root);
  return root;
};

const person = async (
  parent: string,
  name: string,
  files: Readonly<Record<string, string>>,
): Promise<string> => {
  const directory = join(parent, name);
  await mkdir(directory, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(directory, file), content);
  }
  return directory;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("legacy person detection", () => {
  it("recognizes the legacy files and ignores other directories", async () => {
    const root = await temporaryRoot();
    const legacy = await person(root, "jiaxiu", {
      "persona.md": "# Jiaxiu\n",
      "work.md": "# Work\n",
    });
    const other = await person(root, "notes", { "readme.txt": "not a person\n" });
    expect(await isLegacyPersonDirectory(legacy)).toBe(true);
    expect(await isLegacyPersonDirectory(other)).toBe(false);
    expect(await readLegacyPerson(other)).toBeUndefined();
  });

  it("reads the descriptor name, slug alias, and notes without inventing fields", async () => {
    const root = await temporaryRoot();
    const directory = await person(root, "example_jiaxiu", {
      "persona.md": "# Jiaxiu\n",
      "meta.json": JSON.stringify({
        name: "佳秀（示例）",
        slug: "example_jiaxiu",
        profile: { role: "HRBP", company: "AI Lab" },
        impression: "招聘靠谱效率高",
      }),
    });
    const read = await readLegacyPerson(directory);
    expect(read?.displayName).toBe("佳秀（示例）");
    expect(read?.aliases).toEqual(["example_jiaxiu"]);
    expect(read?.described).toBe(true);
    expect(read?.descriptorNotes.join(" ")).toContain("HRBP at AI Lab");
    expect(read?.descriptorNotes.join(" ")).toContain("impression");
  });

  it("falls back to the directory name when the descriptor is missing or broken", async () => {
    const root = await temporaryRoot();
    const missing = await person(root, "no-meta", { "persona.md": "# Someone\n" });
    const missingRead = await readLegacyPerson(missing);
    expect(missingRead?.displayName).toBe("no-meta");
    expect(missingRead?.described).toBe(false);
    expect(missingRead?.aliases).toEqual([]);

    const broken = await person(root, "broken", {
      "persona.md": "# Someone\n",
      "meta.json": "{ not json",
    });
    const brokenRead = await readLegacyPerson(broken);
    expect(brokenRead?.displayName).toBe("broken");
    expect(brokenRead?.described).toBe(false);
    expect(brokenRead?.descriptorNotes.join(" ")).toContain("meta.json could not be read");
  });

  it("treats a single person directory as one person and a parent as many", async () => {
    const root = await temporaryRoot();
    await person(root, "b-person", { "persona.md": "# B\n" });
    await person(root, "a-person", {
      "meta.json": JSON.stringify({ name: "A" }),
      "work.md": "# A\n",
    });
    await person(root, "not-a-person", { "notes.txt": "x\n" });
    const people = await listLegacyPeople(root);
    expect(people.map((entry) => entry.displayName)).toEqual(["A", "b-person"]);

    const single = await listLegacyPeople(join(root, "b-person"));
    expect(single).toHaveLength(1);
    expect(single[0]?.displayName).toBe("b-person");
  });

  it("finds people nested under a legacy category directory", async () => {
    const root = await temporaryRoot();
    // The real legacy release nests one category level: skills/colleague/<person>.
    await person(join(root, "skills"), "colleague/example_jiaxiu", {
      "persona.md": "# Jiaxiu\n",
      "meta.json": JSON.stringify({ name: "佳秀（示例）", slug: "example_jiaxiu" }),
    });
    await person(join(root, "skills"), "celebrity/example_star", { "persona.md": "# Star\n" });
    const people = await listLegacyPeople(join(root, "skills"));
    expect(people.map((entry) => entry.displayName)).toEqual(["example_star", "佳秀（示例）"]);
    const jiaxiu = people.find((entry) => entry.slug === "example_jiaxiu");
    expect(jiaxiu?.directory.endsWith(join("colleague", "example_jiaxiu"))).toBe(true);
  });

  it("rejects a path that is not a directory", async () => {
    const root = await temporaryRoot();
    const file = join(root, "persona.md");
    await writeFile(file, "# x\n");
    await expect(listLegacyPeople(file)).rejects.toThrow(
      "The import path must be an existing directory.",
    );
  });
});
