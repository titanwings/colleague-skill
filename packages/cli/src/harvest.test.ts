import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DistillyError } from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { describeHarvestSelection, recordBudgetExceeded, selectHarvestFiles } from "./harvest.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  }
});

const temporaryDirectory = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-harvest-"));
  temporaryRoots.push(root);
  return root;
};

const write = async (root: string, relativePath: string, content = "x\n"): Promise<void> => {
  const path = join(root, relativePath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
};

describe("directory harvest selection", () => {
  it("selects supported files in deterministic root-relative order", async () => {
    const root = await temporaryDirectory();
    await write(root, "z.txt");
    await write(root, "nested/a.md");
    await write(root, "b.eml");
    await write(root, "nested/deep/c.mbox");

    const selection = await selectHarvestFiles(root);

    expect(selection.files.map((file) => file.relativePath)).toEqual([
      "b.eml",
      "nested/a.md",
      "nested/deep/c.mbox",
      "z.txt",
    ]);
    expect(selection.files.map((file) => file.mediaType)).toEqual([
      "message/rfc822",
      "text/markdown",
      "application/mbox",
      "text/plain",
    ]);
    expect(selection.truncated).toBe(false);
  });

  it("reports every skipped category instead of treating it as evidence", async () => {
    const root = await temporaryDirectory();
    await write(root, ".hidden.txt");
    await write(root, ".env");
    await write(root, "keys/server.pem");
    await write(root, "node_modules/pkg/index.md");
    await write(root, ".git/config.md");
    await write(root, "photo.png");
    await write(root, "keep.txt", "kept\n");

    const selection = await selectHarvestFiles(root);

    expect(selection.files.map((file) => file.pathLabel)).toEqual(["keep.txt"]);
    expect(selection.skipped).toEqual({
      credential: 2,
      "dependency-or-build": 2,
      hidden: 1,
      "unsupported-format": 1,
    });
  });

  it("never follows a file or directory symlink", async () => {
    const root = await temporaryDirectory();
    const outside = await temporaryDirectory();
    await write(outside, "secret.txt", "outside\n");
    await write(root, "real.txt", "inside\n");
    await symlink(join(outside, "secret.txt"), join(root, "linked.txt"));
    await symlink(outside, join(root, "linked-dir"));

    const selection = await selectHarvestFiles(root);

    expect(selection.files.map((file) => file.pathLabel)).toEqual(["real.txt"]);
    expect(selection.skipped["symlink"]).toBe(2);
  });

  it("counts a repeated basename rather than overwriting another file's evidence", async () => {
    const root = await temporaryDirectory();
    await write(root, "a/report.md", "first\n");
    await write(root, "b/report.md", "second\n");

    const selection = await selectHarvestFiles(root);

    expect(selection.files.map((file) => file.relativePath)).toEqual(["a/report.md"]);
    expect(selection.skipped["duplicate-name"]).toBe(1);
  });

  it("stops at the selection cap and reports truncation", async () => {
    const root = await temporaryDirectory();
    for (let index = 0; index < 5; index += 1) await write(root, `f${String(index)}.txt`);

    const selection = await selectHarvestFiles(root, { maximumFiles: 2 });

    expect(selection.files).toHaveLength(2);
    expect(selection.truncated).toBe(true);
  });

  it("renders a stable sorted report", async () => {
    const root = await temporaryDirectory();
    await write(root, "keep.txt");
    await write(root, ".env");
    await write(root, "photo.png");

    const lines = describeHarvestSelection(await selectHarvestFiles(root));

    expect(lines[0]).toBe("Selected 1 file(s) from 1 director(ies).");
    expect(lines.slice(1)).toEqual(["  skipped credential: 1", "  skipped unsupported-format: 1"]);
  });
});

describe("record budget classification", () => {
  it("recognizes the runtime's record-budget refusal and nothing else", () => {
    const budget = new DistillyError({
      code: "invalid_input",
      message:
        "This selection expands to 33 material records, more than the 32 one ingest call carries.",
      retryable: false,
      details: { reason: "record_budget_exceeded", records: 33, maximumRecords: 32 },
    });
    expect(recordBudgetExceeded(budget)).toBe(true);
    expect(
      recordBudgetExceeded(
        new DistillyError({
          code: "invalid_input",
          message: "The materials.ingest boundary input is invalid.",
          retryable: false,
        }),
      ),
    ).toBe(false);
    expect(
      recordBudgetExceeded(
        new DistillyError({
          code: "storage_corrupt",
          message: "The trusted file loader returned an invalid item count.",
          retryable: false,
        }),
      ),
    ).toBe(false);
    expect(recordBudgetExceeded(new Error("record_budget_exceeded"))).toBe(false);
  });
});
