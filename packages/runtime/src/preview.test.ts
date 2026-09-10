import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  briefMaterialRefSchema,
  BUILTIN_HOSTS,
  DistillyError,
  facetPathSchema,
  requestIdSchema,
} from "@distilly/protocol";
import type {
  CommitInput,
  EngineClient,
  EngineEvent,
  IngestInput,
  IsoDateTime,
  RequestId,
  SubjectId,
} from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { openPreviewLocalRuntime, type PreviewLocalRuntime } from "./preview.js";

const AT = "2026-08-31T20:00:00.000Z" as IsoDateTime;
const FIRST_REF = briefMaterialRefSchema.parse("m001");
const IDENTITY = facetPathSchema.parse("identity");
const CAPACITY = {
  maximumInputTokens: 4_194_304,
  maximumToolResultBytes: 4_194_304,
  source: "sdk_explicit" as const,
};

const roots: string[] = [];
const runtimes: PreviewLocalRuntime[] = [];
let requestCounter = 100;

const request = (): RequestId =>
  requestIdSchema.parse(`req_${(requestCounter++).toString(16).padStart(32, "0")}`);

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-preview-runtime-"));
  roots.push(root);
  return root;
};

const open = async (root: string): Promise<PreviewLocalRuntime> => {
  const runtime = await openPreviewLocalRuntime({ root });
  runtimes.push(runtime);
  return runtime;
};

const close = async (runtime: PreviewLocalRuntime): Promise<void> => {
  await runtime.close();
  const index = runtimes.indexOf(runtime);
  if (index !== -1) runtimes.splice(index, 1);
};

const connect = (
  runtime: PreviewLocalRuntime,
  id: string,
  withCapacity = true,
): Promise<EngineClient> =>
  runtime.connectTrusted({
    actor: { kind: "sdk", id },
    ...(withCapacity ? { capacity: CAPACITY } : {}),
  });

const material = (subjectId: SubjectId): IngestInput => ({
  subject: { kind: "existing", subjectId },
  materials: [
    {
      clientRef: "local-note",
      kind: "document",
      content: "Mira builds reliable local-first systems and explains evidence precisely.",
      source: {
        uri: "https://example.test/local/mira.md",
        medium: "document",
        access: "private",
        role: "first_party_expression",
        capturedAt: AT,
      },
      derivation: { kind: "native_text" },
      sensitivity: "private",
    },
  ],
  enqueue: "now",
});

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("Developer Preview LocalRuntime", () => {
  it("splits one oversized local file into parts that each fit the material limit", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const path = join(inputRoot, "huge-chat.txt");
    // Three lines of 700 KB each: every pair exceeds the 1 MiB material limit, so the split
    // must land on line boundaries and produce exactly three parts.
    const line = `${"x".repeat(700_000)}\n`;
    await writeFile(path, line.repeat(3));

    const runtime = await open(root);
    const client = await connect(runtime, "file-split");
    const result = await client.call(
      "materials.ingestFiles",
      {
        subject: { kind: "create" as const, input: { displayName: "Huge", identityHints: [] } },
        paths: [path],
        enqueue: "now" as const,
      },
      { requestId: request() },
    );

    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.pathLabel)).toEqual([
      "huge-chat.txt [part 1 of 3]",
      "huge-chat.txt [part 2 of 3]",
      "huge-chat.txt [part 3 of 3]",
    ]);
    for (const item of result.items) {
      expect(item.kind).toBe("parsed");
      expect(item.warnings.join(" ")).toContain("Split into 3 parts");
    }
  });

  it("atomically ingests parsed and unparsed local files, replays before reads, and reopens", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const markdownPath = join(inputRoot, "mira.md");
    const binaryPath = join(inputRoot, "portrait.bin");
    const markdown = "Mira makes careful local-first decisions.\n";
    const binary = Uint8Array.from([0, 255, 17, 42]);
    await writeFile(markdownPath, markdown);
    await writeFile(binaryPath, binary);
    await utimes(
      markdownPath,
      new Date("2000-01-01T00:00:00.000Z"),
      new Date("2000-01-01T00:00:00.000Z"),
    );

    const runtime = await open(root);
    const client = await connect(runtime, "file-ingest");
    const requestId = request();
    const input = {
      subject: {
        kind: "create" as const,
        input: { displayName: "Mira Files", identityHints: [] },
      },
      paths: [markdownPath, binaryPath],
      enqueue: "now" as const,
    };
    const first = await client.call("materials.ingestFiles", input, { requestId });
    expect(first).toMatchObject({
      created: true,
      generation: 1,
      items: [
        { kind: "parsed", pathLabel: "mira.md", material: { kind: "accepted" } },
        {
          kind: "unparsed",
          pathLabel: "portrait.bin",
          mediaType: "application/octet-stream",
        },
      ],
      job: { state: "pending", generation: 1 },
    });
    const expectedMarkdownRaw = `raw_${createHash("sha256").update(markdown).digest("hex")}`;
    const expectedBinaryRaw = `raw_${createHash("sha256").update(binary).digest("hex")}`;
    const materials = await client.call("materials.list", { subjectId: first.subject.id });
    expect(materials.items).toHaveLength(1);
    const stored = await client.call("materials.get", {
      subjectId: first.subject.id,
      materialId: materials.items[0]!.record.id,
    });
    expect(stored.record.derivation).toMatchObject({
      kind: "raw_extract",
      rawId: expectedMarkdownRaw,
      method: "document_text",
    });
    expect(stored.record.source.capturedAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(first.items[1]).toMatchObject({ rawId: expectedBinaryRaw });

    const zeroDelta = await client.call(
      "materials.ingestFiles",
      {
        subject: { kind: "existing", subjectId: first.subject.id },
        paths: [binaryPath],
        enqueue: "now",
      },
      { requestId: request() },
    );
    expect(zeroDelta).toMatchObject({
      created: false,
      generation: first.generation,
      materialSetHash: first.materialSetHash,
      items: [{ kind: "unparsed", rawId: expectedBinaryRaw }],
      job: { id: first.job!.id },
    });
    await expect(
      client.call("distill.pending", { subjectId: first.subject.id }),
    ).resolves.toMatchObject([{ id: first.job!.id }]);

    await rm(markdownPath);
    await rm(binaryPath);
    await expect(client.call("materials.ingestFiles", input, { requestId })).resolves.toEqual(
      first,
    );
    await expect(
      client.call("materials.ingestFiles", { ...input, paths: [markdownPath] }, { requestId }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    const otherActor = await connect(runtime, "file-ingest-other");
    await expect(
      otherActor.call("materials.ingestFiles", input, { requestId }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(
      client.call(
        "subjects.create",
        { displayName: "Method Conflict", identityHints: [] },
        { requestId },
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    await close(runtime);
    const database = new DatabaseSync(join(root, "store.sqlite3"), { readOnly: true });
    expect(database.prepare("SELECT count(*) AS count FROM raw_materials").get()).toEqual({
      count: 2,
    });
    expect(database.prepare("SELECT count(*) AS count FROM subject_raw_materials").get()).toEqual({
      count: 2,
    });
    const sources = database
      .prepare("SELECT source_json FROM subject_raw_materials ORDER BY raw_id")
      .all() as unknown as readonly { readonly source_json: string }[];
    expect(sources.every((row) => !row.source_json.includes(inputRoot))).toBe(true);
    database.close();
    const binaryHex = expectedBinaryRaw.slice("raw_".length);
    await expect(
      readFile(join(root, "blobs", "sha256", binaryHex.slice(0, 2), `sha256_${binaryHex}`)),
    ).resolves.toEqual(Buffer.from(binary));
    const reopened = await open(root);
    const reopenedClient = await connect(reopened, "file-ingest-reopened");
    await expect(
      reopenedClient.call("materials.list", { subjectId: first.subject.id }),
    ).resolves.toMatchObject({ items: [{ record: { id: materials.items[0]!.record.id } }] });
  });

  it("stores invalid UTF-8 as raw-only without changing generation or enqueuing", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const invalidPath = join(inputRoot, "invalid.txt");
    await writeFile(invalidPath, Uint8Array.from([0xc3, 0x28]));
    const runtime = await open(root);
    const client = await connect(runtime, "raw-only");
    const result = await client.call(
      "materials.ingestFiles",
      {
        subject: {
          kind: "create",
          input: { displayName: "Raw Only", identityHints: [] },
        },
        paths: [invalidPath],
        enqueue: "now",
      },
      { requestId: request() },
    );
    expect(result).toMatchObject({
      created: true,
      generation: 0,
      items: [{ kind: "unparsed", pathLabel: "invalid.txt", mediaType: "text/plain" }],
    });
    expect(result).not.toHaveProperty("materialSetHash");
    expect(result).not.toHaveProperty("job");
    await expect(client.call("materials.list", { subjectId: result.subject.id })).resolves.toEqual({
      items: [],
    });
    await expect(client.call("distill.pending", { subjectId: result.subject.id })).resolves.toEqual(
      [],
    );
  });

  it("refuses a second canonical text interpretation for the same raw bytes", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const body = "1\n00:00:01,000 --> 00:00:02,000\nHello\n";
    const textPath = join(inputRoot, "same.txt");
    const subtitlePath = join(inputRoot, "same.srt");
    await writeFile(textPath, body);
    await writeFile(subtitlePath, body);
    const runtime = await open(root);
    const client = await connect(runtime, "canonical-raw-text");
    const first = await client.call(
      "materials.ingestFiles",
      {
        subject: {
          kind: "create",
          input: { displayName: "Canonical Raw Text", identityHints: [] },
        },
        paths: [textPath],
        enqueue: "now",
      },
      { requestId: request() },
    );

    await expect(
      client.call(
        "materials.ingestFiles",
        {
          subject: { kind: "existing", subjectId: first.subject.id },
          paths: [subtitlePath],
          enqueue: "now",
        },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "paths",
      message: "The selected raw bytes already have a different canonical text extraction.",
    });
    await expect(
      client.call("materials.list", { subjectId: first.subject.id }),
    ).resolves.toMatchObject({ items: [{ record: { kind: "document" } }] });
    await expect(
      client.call("distill.pending", { subjectId: first.subject.id }),
    ).resolves.toMatchObject([{ id: first.job!.id, generation: first.generation }]);
  });

  it("leaves no product-visible state when an explicit local path cannot be read", async () => {
    const root = await temporaryRoot();
    const runtime = await open(root);
    const client = await connect(runtime, "missing-file");
    await expect(
      client.call(
        "materials.ingestFiles",
        {
          subject: {
            kind: "create",
            input: { displayName: "Must Not Persist", identityHints: [] },
          },
          paths: [join(root, "missing.md")],
          enqueue: "now",
        },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "A selected local file could not be read.",
      fieldPath: "paths[0]",
    });
    await expect(client.call("subjects.list", {})).resolves.toEqual({ items: [] });
  });

  it("rejects a symlinked local file without creating a subject", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const outside = await temporaryRoot();
    const outsideFile = join(outside, "secret.md");
    const linkedFile = join(inputRoot, "linked.md");
    await writeFile(outsideFile, "must stay outside");
    await symlink(outsideFile, linkedFile);

    const runtime = await open(root);
    const client = await connect(runtime, "symlink-file");
    await expect(
      client.call(
        "materials.ingestFiles",
        {
          subject: {
            kind: "create",
            input: { displayName: "Symlink File", identityHints: [] },
          },
          paths: [linkedFile],
          enqueue: "now",
        },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({ code: "invalid_input", fieldPath: "paths[0]" });
    await expect(client.call("subjects.list", {})).resolves.toEqual({ items: [] });
  });

  it("rejects duplicate local file names before reading either file", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const firstDirectory = join(inputRoot, "first");
    const secondDirectory = join(inputRoot, "second");
    await mkdir(firstDirectory);
    await mkdir(secondDirectory);
    await writeFile(join(firstDirectory, "same.md"), "first");
    await writeFile(join(secondDirectory, "same.md"), "second");

    const runtime = await open(root);
    const client = await connect(runtime, "duplicate-labels");
    await expect(
      client.call(
        "materials.ingestFiles",
        {
          subject: {
            kind: "create",
            input: { displayName: "Duplicate Labels", identityHints: [] },
          },
          paths: [join(firstDirectory, "same.md"), join(secondDirectory, "same.md")],
          enqueue: "now",
        },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Selected local files must have unique file names.",
      fieldPath: "paths[1]",
    });
    await expect(client.call("subjects.list", {})).resolves.toEqual({ items: [] });
  });

  it("runs create, ingest, pending, capacity-bound brief, owner-bound commit, get, and prompt", async () => {
    const runtime = await open(await temporaryRoot());
    const noCapacity = await connect(runtime, "no-capacity", false);
    const first = await connect(runtime, "first-client");
    const second = await connect(runtime, "second-client");

    const subject = await first.call(
      "subjects.create",
      {
        displayName: "Mira Chen",
        aliases: ["Mira"],
        domainPack: "colleague",
        identityHints: [{ kind: "url", value: "https://example.test/mira" }],
      },
      { requestId: request() },
    );
    const ingested = await first.call("materials.ingest", material(subject.id), {
      requestId: request(),
    });
    expect(ingested.kind).toBe("ingested");
    if (ingested.kind !== "ingested" || ingested.job === undefined) {
      throw new Error("Expected an enqueued material generation.");
    }

    const pending = await first.call("distill.pending", { subjectId: subject.id });
    expect(pending).toHaveLength(1);
    await expect(
      noCapacity.call("distill.brief", { jobId: ingested.job.id }, { requestId: request() }),
    ).rejects.toMatchObject({ code: "host_unsupported" });

    const briefing = await first.call(
      "distill.brief",
      { jobId: ingested.job.id },
      { requestId: request() },
    );
    expect(briefing.limits.maximumInputTokens).toBe(CAPACITY.maximumInputTokens);
    await expect(
      second.call(
        "distill.release",
        { jobId: briefing.job.id, leaseId: briefing.lease.id },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({ code: "lease_conflict" });

    const patch: CommitInput["patch"] = {
      operations: [
        {
          op: "add",
          claim: {
            facet: IDENTITY,
            text: "Mira builds reliable local-first systems.",
            evidence: [
              {
                kind: "brief_material",
                materialRef: FIRST_REF,
                quote: "Mira builds reliable local-first systems",
              },
            ],
          },
        },
      ],
    };
    const committed = await first.call(
      "distill.commit",
      {
        jobId: briefing.job.id,
        generation: briefing.job.generation,
        leaseId: briefing.lease.id,
        briefContractDigest: briefing.contract.digest,
        materialSetHash: briefing.job.materialSetHash,
        patch,
      },
      { requestId: request() },
    );
    expect(committed.kind).toBe("current");
    const profile = await first.call("profiles.get", { subjectId: subject.id });
    expect(profile.rendered).toContain("Mira builds reliable local-first systems");
    await expect(first.call("profiles.prompt", { subjectId: subject.id })).resolves.toContain(
      profile.rendered,
    );

    const constrained = await runtime.connectTrusted({
      actor: { kind: "sdk", id: "constrained-prompt" },
      capacity: { ...CAPACITY, maximumInputTokens: 1 },
    });
    await expect(
      constrained.call("profiles.prompt", { subjectId: subject.id }),
    ).rejects.toMatchObject({
      code: "context_too_large",
      retryable: false,
      details: {
        limits: { maximumInputTokens: 1 },
      },
    });
    await constrained.close();
  });

  it("keeps client watches and closes isolated while the runtime remains usable", async () => {
    const runtime = await open(await temporaryRoot());
    const first = await connect(runtime, "watch-first");
    const second = await connect(runtime, "watch-second");
    const firstEvents: string[] = [];
    const secondEvents: string[] = [];
    await first.watch((event) => firstEvents.push(event.kind));
    await second.watch((event) => secondEvents.push(event.kind));

    await first.close();
    await second.call(
      "subjects.create",
      { displayName: "Watch Subject", identityHints: [] },
      { requestId: request() },
    );

    expect(firstEvents).toEqual([]);
    expect(secondEvents).toEqual(["subject.created"]);
    await expect(first.call("subjects.list", {})).rejects.toMatchObject({ code: "busy" });
    await expect(second.call("subjects.list", {})).resolves.toMatchObject({ items: [{}] });
  });

  it("drains a real in-flight post-commit observer before closing and rejects later calls", async () => {
    const runtime = await open(await temporaryRoot());
    const client = await connect(runtime, "drain-client");
    let entered!: () => void;
    const handlerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blockingHandler = (() => {
      entered();
      return blocked;
    }) as unknown as (event: EngineEvent) => void;
    await client.watch(blockingHandler);

    const mutation = client.call(
      "subjects.create",
      { displayName: "Drain Subject", identityHints: [] },
      { requestId: request() },
    );
    await handlerEntered;
    let closed = false;
    const closing = runtime.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    release();
    await mutation;
    await closing;
    const index = runtimes.indexOf(runtime);
    if (index !== -1) runtimes.splice(index, 1);
    await expect(client.call("subjects.list", {})).rejects.toMatchObject({ code: "busy" });
    await expect(connect(runtime, "late-client")).rejects.toMatchObject({ code: "busy" });
  });

  it("persists across close/reopen and parses runtime-owned disabled methods", async () => {
    const root = await temporaryRoot();
    const firstRuntime = await open(root);
    const first = await connect(firstRuntime, "persist-first");
    const subject = await first.call(
      "subjects.create",
      { displayName: "Persistent Subject", identityHints: [] },
      { requestId: request() },
    );

    await expect(
      first.call("hosts.install", { subjectId: subject.id } as never, {
        requestId: request(),
      }),
    ).rejects.toMatchObject({ code: "invalid_input", retryable: false });
    const unsupported = first.call(
      "hosts.install",
      { subjectId: subject.id, host: BUILTIN_HOSTS.codex },
      { requestId: request() },
    );
    await expect(unsupported).rejects.toBeInstanceOf(DistillyError);
    await expect(unsupported).rejects.toMatchObject({
      code: "host_unsupported",
      retryable: false,
      message: "The requested host does not have a verified full Distilly binding.",
    });

    await close(firstRuntime);
    const reopened = await open(root);
    const second = await connect(reopened, "persist-second");
    await expect(second.call("subjects.list", {})).resolves.toMatchObject({
      items: [{ id: subject.id, displayName: "Persistent Subject" }],
    });
    await expect(second.call("system.doctor", {})).rejects.toMatchObject({
      code: "schema_unsupported",
      retryable: false,
      details: { kind: "preview_method_deferred", method: "system.doctor" },
    });
  });
});

describe("local record budget", () => {
  it("splits an oversized text and refuses a selection that expands past the wire record limit", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const paths: string[] = [];
    // The JSON parser pretty-prints, so a 500 KB file becomes more than one material record
    // while staying under the per-file material limit that would send it alone.
    const compact = JSON.stringify({
      items: Array.from({ length: 9_000 }, (_, index) => ({
        id: index,
        name: `item-${String(index)}`,
        tags: ["alpha", "beta", "gamma"],
        nested: { a: 1, b: "two", c: [1, 2, 3] },
      })),
    });
    expect(Buffer.byteLength(compact)).toBeLessThan(1_048_576);
    expect(Buffer.byteLength(JSON.stringify(JSON.parse(compact), null, 2))).toBeGreaterThan(
      1_048_576,
    );
    const jsonPath = join(inputRoot, "export.json");
    await writeFile(jsonPath, compact);
    paths.push(jsonPath);
    for (let index = 0; index < 31; index += 1) {
      const path = join(inputRoot, `note-${String(index)}.md`);
      await writeFile(path, `Note ${String(index)} records one ordinary observation.\n`);
      paths.push(path);
    }

    const runtime = await open(root);
    const client = await connect(runtime, "record-budget");
    const failure = await client
      .call(
        "materials.ingestFiles",
        {
          subject: { kind: "create" as const, input: { displayName: "Budget", identityHints: [] } },
          paths,
          enqueue: "now" as const,
        },
        { requestId: request() },
      )
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(DistillyError);
    expect((failure as DistillyError).code).toBe("invalid_input");
    expect((failure as DistillyError).details?.["reason"]).toBe("record_budget_exceeded");

    // The same selection succeeds when the expanding file travels alone, which is what the
    // harvest command falls back to.
    const small = await client.call(
      "materials.ingestFiles",
      {
        subject: { kind: "create" as const, input: { displayName: "Budget", identityHints: [] } },
        paths: paths.slice(1),
        enqueue: "now" as const,
      },
      { requestId: request() },
    );
    expect(small.items).toHaveLength(31);
    const alone = await client.call(
      "materials.ingestFiles",
      {
        subject: { kind: "existing" as const, subjectId: small.subject.id },
        paths: [jsonPath],
        enqueue: "now" as const,
      },
      { requestId: request() },
    );
    expect(alone.items.length).toBeGreaterThan(1);
    expect(alone.items.map((item) => item.pathLabel)).toContain("export.json [part 1 of 3]");
  });
});

describe("unsplittable parsed text", () => {
  it("keeps the raw file and warns when a whitespace run cannot become a legal part", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const path = join(inputRoot, "spaces.txt");
    // One 1.2 MiB run of spaces is longer than a material, so no legal part exists; the file
    // must be kept as raw evidence with a warning instead of failing the whole call.
    await writeFile(path, `a${" ".repeat(1_200_000)}b\n`);

    const runtime = await open(root);
    const client = await connect(runtime, "unsplittable");
    const result = await client.call(
      "materials.ingestFiles",
      {
        subject: { kind: "create" as const, input: { displayName: "Spaces", identityHints: [] } },
        paths: [path],
        enqueue: "now" as const,
      },
      { requestId: request() },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("unparsed");
    expect(result.items[0]?.warnings.join(" ")).toContain("whitespace longer than one material");
  });
});

describe("split reassembly through the engine", () => {
  it("briefs every part of a split file and reproduces the parsed text byte for byte", async () => {
    const root = await temporaryRoot();
    const inputRoot = await temporaryRoot();
    const path = join(inputRoot, "mixed.md");
    // Astral characters and line boundaries both sit on part seams: 2.5 MiB of 4-byte code
    // points with a newline every 32 characters.
    const line = `${"😀".repeat(31)}\n`;
    const original = line.repeat(Math.ceil((2.5 * 1_048_576) / Buffer.byteLength(line)));
    await writeFile(path, original);

    const runtime = await open(root);
    // The direct-user capacity is wide enough to carry the whole briefing, so this proves the
    // stored parts, not the splitter alone.
    const client = await connect(runtime, "split-reassembly");
    const result = await client.call(
      "materials.ingestFiles",
      {
        subject: {
          kind: "create" as const,
          input: { displayName: "Reassembly", identityHints: [] },
        },
        paths: [path],
        enqueue: "now" as const,
      },
      { requestId: request() },
    );
    expect(result.items.length).toBeGreaterThan(1);
    if (result.job === undefined) throw new Error("Expected an enqueued job.");
    const briefing = await client.call(
      "distill.brief",
      { jobId: result.job.id },
      { requestId: request() },
    );
    const joined = briefing.materials.map((entry) => entry.content).join("");
    expect(joined).toBe(original);
    expect(joined).not.toContain("\uFFFD");
  });
});
