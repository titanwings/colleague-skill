import type { DatabaseSync } from "node:sqlite";

import {
  DistillyError,
  WIRE_LIMITS,
  actorContextSchema,
  briefContractSchema,
  contentDigestSchema,
  engineMethodSchemas,
  ingestFilesResultSchema,
  ingestResultSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  leaseOwnerIdSchema,
  materialIdSchema,
  materialRecordSchema,
  materialSourceInputSchema,
  materialSetHashSchema,
  mutationContextSchema,
  rawIdSchema,
  provenanceDigestSchema,
  pendingJobMarkerSchema,
  subjectStateRecordSchema,
  versionIdSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  ContentDigest,
  EngineEvent,
  FactChecksum,
  IngestInput,
  IngestFilesInput,
  IngestFilesResult,
  IngestItemResult,
  IngestResult,
  IsoDateTime,
  MaterialId,
  MaterialRecord,
  MutationContext,
  PendingJob,
  PendingJobMarker,
  RawId,
  MaterialSourceInput,
  SubjectId,
  SubjectStateRecord,
  SubjectSummary,
  VersionMaterialEntry,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { canonicalJson } from "../facts/canonical-json.js";
import { sealFact, sha256Hex, verifyFactChecksum } from "../facts/checksum.js";
import { deriveMaterialId, digestMaterialProvenance, hashMaterialSet } from "../facts/digests.js";
import { canonicalRawTextJson } from "../facts/raw-extraction.js";
import { factNotFound, invalidInput, storageCorrupt } from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type {
  BlobPutResult,
  ContentAddressedBlobStore,
} from "../storage/content-addressed-blob-store.js";
import {
  computeMutationInputChecksum,
  insertCompletedOperationInTransaction,
  insertEventInTransaction,
  replayCompletedMutation,
} from "../storage/mutation-ledger.js";
import type { SqliteEngineStore } from "../storage/sqlite-engine-store.js";
import { readSqliteVersionInTransaction } from "../version/sqlite-authority.js";
import {
  createSubjectIdentityInTransaction,
  loadSubjectSummaryInTransaction,
} from "../subject/transactional-identity.js";
import type { NormalizedIngestSubjectTarget } from "../subject/identity.js";
import { canonicalizeIngestSubjectTarget } from "../subject/identity.js";
import type { PreparedMaterial, TrustedParsedMaterialDraft } from "./normalize.js";
import { bindParsedMaterial, normalizeMaterial, prepareMaterial } from "./normalize.js";
import { deriveIngestState } from "./state-transition.js";
import type { IngestBaseline } from "./state-transition.js";
import { createBriefContract } from "../distill/prompt-catalog.js";

interface StoredMaterialRow {
  readonly materialId: MaterialId;
  readonly kind: MaterialRecord["kind"];
  readonly contentDigest: ContentDigest;
  readonly provenanceDigest: VersionMaterialEntry["provenanceDigest"];
  readonly sourceIdentity: string;
  readonly identityJson: string;
  readonly record: MaterialRecord;
  readonly blobDigest: ContentDigest;
  readonly blobByteLength: number;
  readonly storedAt: IsoDateTime;
}

interface PreparedBatch {
  readonly accepted: readonly PreparedMaterial[];
  readonly items: readonly IngestItemResult[];
  readonly targetManifest: readonly VersionMaterialEntry[];
  readonly storedAtByMaterialId: ReadonlyMap<MaterialId, IsoDateTime>;
}

interface TransactionOutcome {
  readonly result: IngestResult;
  readonly events: readonly EngineEvent[];
  readonly committed: boolean;
}

/** One explicit local file after the Runtime has safely read and parsed it. */
interface TrustedLoadedFile {
  readonly pathLabel: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
  readonly source: MaterialSourceInput;
  readonly parsed?: TrustedParsedMaterialDraft;
  readonly warnings: readonly string[];
}

/** Minimal trusted seam that keeps filesystem and parser dependencies outside Engine. */
export interface TrustedFileLoader {
  load(input: {
    readonly paths: readonly string[];
    readonly subjectId: SubjectId;
    readonly requestId: MutationContext["requestId"];
    readonly sensitivity: "private" | "shareable";
  }): Promise<readonly TrustedLoadedFile[]>;
}

interface PreparedRawFile extends TrustedLoadedFile {
  readonly rawId: RawId;
  readonly blobDigest: ContentDigest;
  readonly prepared?: PreparedMaterial;
}

interface FileTransactionOutcome {
  readonly result: IngestFilesResult;
  readonly events: readonly EngineEvent[];
  readonly committed: boolean;
}

/** Fault hooks used by real process-crash tests at durable boundaries. */
export interface IngestServiceHooks {
  /** Runs after each unique immutable content blob is published. */
  readonly afterBlobPut?: (contentDigest: ContentDigest) => void | Promise<void>;
  /** Runs synchronously after all SQL writes and immediately before COMMIT. */
  readonly beforeTransactionCommit?: (requestId: MutationContext["requestId"]) => void;
  /** Runs after COMMIT and before post-commit invalidation publication. */
  readonly afterTransactionCommit?: (
    requestId: MutationContext["requestId"],
  ) => void | Promise<void>;
}

/** Concrete dependencies for the package-private SQLite ingest slice. */
export interface IngestServiceDependencies {
  readonly store: SqliteEngineStore;
  readonly blobs: ContentAddressedBlobStore;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly eventBus: EventBus;
  readonly fileLoader?: TrustedFileLoader;
  readonly hooks?: IngestServiceHooks;
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const text = (row: Readonly<Record<string, unknown>>, key: string): string => {
  const value = row[key];
  if (typeof value !== "string") throw storageCorrupt(`SQLite ${key} is invalid.`);
  return value;
};

const nullableText = (row: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = row[key];
  if (value === null) return undefined;
  if (typeof value !== "string") throw storageCorrupt(`SQLite ${key} is invalid.`);
  return value;
};

const integer = (row: Readonly<Record<string, unknown>>, key: string): number => {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw storageCorrupt(`SQLite ${key} is invalid.`);
  }
  return value;
};

const sqliteBoolean = (row: Readonly<Record<string, unknown>>, key: string): boolean => {
  const value = integer(row, key);
  if (value !== 0 && value !== 1) throw storageCorrupt(`SQLite ${key} is not boolean.`);
  return value === 1;
};

const utf8Blob = (row: Readonly<Record<string, unknown>>, key: string): string => {
  const value = row[key];
  if (!(value instanceof Uint8Array)) throw storageCorrupt(`SQLite ${key} is invalid.`);
  try {
    return UTF8_DECODER.decode(value);
  } catch (error) {
    throw storageCorrupt(`SQLite ${key} is not canonical UTF-8.`, error);
  }
};

const parseBoundary = <T>(parse: () => T, fieldPath: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw invalidInput("The materials.ingest boundary input is invalid.", fieldPath);
  }
};

const parseStored = <T>(parse: () => T, label: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError && error.code === "storage_corrupt") throw error;
    throw storageCorrupt(`SQLite ${label} is invalid.`, error);
  }
};

const parseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw storageCorrupt(`SQLite ${label} is not valid JSON.`, error);
  }
};

const queryOne = (
  database: DatabaseSync,
  sql: string,
  values: readonly (string | number | bigint | Uint8Array | null)[],
  label: string,
): Readonly<Record<string, unknown>> | undefined => {
  try {
    return database.prepare(sql).get(...values);
  } catch (error) {
    throw storageCorrupt(`SQLite could not read ${label}.`, error);
  }
};

const queryAll = (
  database: DatabaseSync,
  sql: string,
  values: readonly (string | number | bigint | Uint8Array | null)[],
  label: string,
): readonly Readonly<Record<string, unknown>>[] => {
  try {
    return database.prepare(sql).all(...values);
  } catch (error) {
    throw storageCorrupt(`SQLite could not read ${label}.`, error);
  }
};

/**
 * Selects the material fields that determine immutable identity.
 *
 * @param record - The canonical stored material record.
 * @returns Identity-bearing semantics without first-seen display metadata.
 */
const materialIdentitySemantics = (record: MaterialRecord): unknown => {
  const source = Object.fromEntries(
    Object.entries(record.source).filter(([key]) => key !== "title" && key !== "capturedAt"),
  );
  return {
    id: record.id,
    subjectId: record.subjectId,
    kind: record.kind,
    contentDigest: record.contentDigest,
    provenanceDigest: record.provenanceDigest,
    sourceIdentity: record.sourceIdentity,
    source,
    derivation: record.derivation,
    participants: record.participants,
    sensitivity: record.sensitivity,
    ...(record.correctionProvenance === undefined
      ? {}
      : { correctionProvenance: record.correctionProvenance }),
    ...(record.captureAuditRef === undefined ? {} : { captureAuditRef: record.captureAuditRef }),
    ...(record.conversationSourceKey === undefined
      ? {}
      : { conversationSourceKey: record.conversationSourceKey }),
    flags: record.flags,
  };
};

const identityJson = (record: MaterialRecord): string =>
  canonicalJson(materialIdentitySemantics(record));

const loadMaterialRows = (
  database: DatabaseSync,
  subjectId: SubjectId,
): readonly StoredMaterialRow[] =>
  queryAll(
    database,
    `SELECT materials.material_id, materials.kind, materials.content_digest,
              materials.provenance_digest, materials.source_identity,
              materials.identity_json, materials.record_json, materials.blob_digest,
              materials.stored_at, blobs.byte_length AS blob_byte_length
       FROM materials
       LEFT JOIN blobs ON blobs.digest = materials.blob_digest
       WHERE materials.subject_id = ?
       ORDER BY materials.material_id`,
    [subjectId],
    "subject materials",
  ).map((row) => {
    const recordJson = text(row, "record_json");
    const record = parseStored(
      () => materialRecordSchema.parse(parseJson(recordJson, "material record")),
      "material record",
    ) as MaterialRecord;
    verifyFactChecksum(record);
    const materialId = parseStored(
      () => materialIdSchema.parse(text(row, "material_id")),
      "material id",
    );
    const kind = text(row, "kind") as MaterialRecord["kind"];
    const contentDigest = parseStored(
      () => contentDigestSchema.parse(text(row, "content_digest")),
      "content digest",
    );
    const provenanceDigest = parseStored(
      () => provenanceDigestSchema.parse(text(row, "provenance_digest")),
      "provenance digest",
    );
    const sourceIdentity = utf8Blob(row, "source_identity");
    const storedIdentityJson = text(row, "identity_json");
    const blobDigest = parseStored(
      () => contentDigestSchema.parse(text(row, "blob_digest")),
      "blob digest",
    );
    const blobByteLength = integer(row, "blob_byte_length");
    const storedAt = parseStored(
      () => isoDateTimeSchema.parse(text(row, "stored_at")),
      "stored timestamp",
    );
    if (
      record.id !== materialId ||
      record.kind !== kind ||
      record.subjectId !== subjectId ||
      record.contentDigest !== contentDigest ||
      record.provenanceDigest !== provenanceDigest ||
      record.sourceIdentity !== sourceIdentity ||
      record.storedAt !== storedAt ||
      blobDigest !== contentDigest ||
      canonicalJson(record) !== recordJson ||
      digestMaterialProvenance(record) !== provenanceDigest ||
      deriveMaterialId(sourceIdentity, provenanceDigest, contentDigest) !== materialId ||
      identityJson(record) !== storedIdentityJson
    ) {
      throw storageCorrupt("SQLite material columns disagree with its canonical record.");
    }
    return {
      materialId,
      kind,
      contentDigest,
      provenanceDigest,
      sourceIdentity,
      identityJson: storedIdentityJson,
      record,
      blobDigest,
      blobByteLength,
      storedAt,
    };
  });

const loadPending = (
  database: DatabaseSync,
  subjectId: SubjectId,
): PendingJobMarker | undefined => {
  const row = queryOne(
    database,
    `SELECT pending_jobs.job_id, pending_jobs.generation,
              pending_jobs.base_version_id, pending_jobs.material_set_hash,
              pending_jobs.added_material_count, pending_jobs.total_material_count,
              pending_jobs.queued_at,
              job_leases.job_id AS lease_job_id,
              job_leases.lease_id, job_leases.lease_owner,
              job_leases.acquired_at, job_leases.expires_at,
              job_leases.brief_contract_digest,
              job_leases.source_grouping_version,
              job_leases.prompt_version,
              job_leases.draft_schema_version
       FROM pending_jobs
       LEFT JOIN job_leases ON job_leases.job_id = pending_jobs.job_id
       WHERE pending_jobs.subject_id = ?`,
    [subjectId],
    "a pending job",
  );
  if (row === undefined) return undefined;
  const baseVersionId = nullableText(row, "base_version_id");
  const leaseJobId = nullableText(row, "lease_job_id");
  const lease =
    leaseJobId === undefined
      ? undefined
      : {
          id: parseStored(() => leaseIdSchema.parse(text(row, "lease_id")), "lease id"),
          owner: parseStored(
            () => leaseOwnerIdSchema.parse(text(row, "lease_owner")),
            "lease owner",
          ),
          acquiredAt: parseStored(
            () => isoDateTimeSchema.parse(text(row, "acquired_at")),
            "lease acquisition time",
          ),
          expiresAt: parseStored(
            () => isoDateTimeSchema.parse(text(row, "expires_at")),
            "lease expiry time",
          ),
          contract: parseStored(
            () =>
              briefContractSchema.parse({
                digest: text(row, "brief_contract_digest"),
                sourceGroupingVersion: text(row, "source_grouping_version"),
                promptVersion: text(row, "prompt_version"),
                draftSchemaVersion: integer(row, "draft_schema_version"),
              }),
            "lease brief contract",
          ),
        };
  if (leaseJobId !== undefined && leaseJobId !== text(row, "job_id")) {
    throw storageCorrupt("A pending lease points to a different job.");
  }
  if (lease !== undefined && createBriefContract(lease.contract).digest !== lease.contract.digest) {
    throw storageCorrupt("A pending lease brief contract digest is inconsistent.");
  }
  return parseStored(
    () =>
      pendingJobMarkerSchema.parse({
        jobId: parseStored(() => jobIdSchema.parse(text(row, "job_id")), "job id"),
        generation: integer(row, "generation"),
        ...(baseVersionId === undefined
          ? {}
          : {
              baseVersionId: parseStored(
                () => versionIdSchema.parse(baseVersionId),
                "pending base version id",
              ),
            }),
        materialSetHash: parseStored(
          () => materialSetHashSchema.parse(text(row, "material_set_hash")),
          "material-set hash",
        ),
        addedMaterialCount: integer(row, "added_material_count"),
        totalMaterialCount: integer(row, "total_material_count"),
        queuedAt: parseStored(
          () => isoDateTimeSchema.parse(text(row, "queued_at")),
          "queued timestamp",
        ),
        ...(lease === undefined ? {} : { lease }),
      }) as PendingJobMarker,
    "pending job",
  );
};

const loadState = (
  database: DatabaseSync,
  subjectId: SubjectId,
): {
  readonly state: SubjectStateRecord;
  readonly rows: readonly StoredMaterialRow[];
  readonly baseline?: IngestBaseline;
} => {
  const row = queryOne(
    database,
    `SELECT generation, material_set_hash, current_version_id, suspended_version_id
       FROM subject_states
       WHERE subject_id = ?`,
    [subjectId],
    "subject state",
  );
  if (row === undefined) {
    const exists = queryOne(
      database,
      "SELECT 1 FROM subjects WHERE id = ?",
      [subjectId],
      "subject existence",
    );
    if (exists === undefined) throw factNotFound("The requested subject does not exist.");
    throw storageCorrupt("A subject is missing its authoritative state row.");
  }
  const rows = loadMaterialRows(database, subjectId);
  const materialManifest = rows.map((material) => ({
    materialId: material.materialId,
    contentDigest: material.contentDigest,
    provenanceDigest: material.provenanceDigest,
  }));
  const storedHash = nullableText(row, "material_set_hash");
  if (materialManifest.length === 0 && storedHash !== undefined) {
    throw storageCorrupt("An empty subject has a material-set hash.");
  }
  if (materialManifest.length > 0 && storedHash !== hashMaterialSet(materialManifest)) {
    throw storageCorrupt("The subject material-set hash does not match its material rows.");
  }
  const pending = loadPending(database, subjectId);
  const currentVersionId = nullableText(row, "current_version_id");
  const suspendedVersionId = nullableText(row, "suspended_version_id");
  const parsedCurrentVersionId =
    currentVersionId === undefined
      ? undefined
      : parseStored(() => versionIdSchema.parse(currentVersionId), "current version id");
  const parsedSuspendedVersionId =
    suspendedVersionId === undefined
      ? undefined
      : parseStored(() => versionIdSchema.parse(suspendedVersionId), "suspended version id");
  const currentVersion =
    parsedCurrentVersionId === undefined
      ? undefined
      : readSqliteVersionInTransaction(database, subjectId, parsedCurrentVersionId);
  if (
    (parsedCurrentVersionId === undefined) !== (currentVersion === undefined) ||
    (currentVersion !== undefined && currentVersion.status !== "current")
  ) {
    throw storageCorrupt("SQLite current version pointer has no verified current version.");
  }
  const suspendedVersion =
    parsedSuspendedVersionId === undefined
      ? undefined
      : readSqliteVersionInTransaction(database, subjectId, parsedSuspendedVersionId);
  if (
    (parsedSuspendedVersionId === undefined) !== (suspendedVersion === undefined) ||
    (suspendedVersion !== undefined && suspendedVersion.status !== "suspended")
  ) {
    throw storageCorrupt("SQLite suspended pointer has no verified suspended version.");
  }
  const state = parseStored(
    () =>
      subjectStateRecordSchema.parse(
        sealFact<SubjectStateRecord>({
          schemaVersion: 2,
          subjectId,
          generation: integer(row, "generation"),
          ...(storedHash === undefined
            ? {}
            : {
                materialSetHash: parseStored(
                  () => materialSetHashSchema.parse(storedHash),
                  "material-set hash",
                ),
              }),
          materialManifest,
          ...(parsedCurrentVersionId === undefined
            ? {}
            : {
                currentVersionId: parsedCurrentVersionId,
              }),
          ...(parsedSuspendedVersionId === undefined
            ? {}
            : {
                suspendedVersionId: parsedSuspendedVersionId,
              }),
          ...(pending === undefined ? {} : { pending }),
        }),
      ),
    "subject state",
  ) as SubjectStateRecord;
  if (
    parsedCurrentVersionId === undefined &&
    pending !== undefined &&
    (pending.baseVersionId !== undefined ||
      pending.addedMaterialCount !== materialManifest.length ||
      pending.totalMaterialCount !== materialManifest.length)
  ) {
    throw storageCorrupt("A pending job disagrees with its empty-version material baseline.");
  }
  const baseline =
    currentVersion === undefined
      ? undefined
      : { versionId: currentVersion.version.id, manifest: currentVersion.manifest.items };
  if (
    pending !== undefined &&
    parsedCurrentVersionId !== undefined &&
    (pending.baseVersionId !== parsedCurrentVersionId ||
      pending.addedMaterialCount !== materialManifest.length - (baseline?.manifest.length ?? 0))
  ) {
    throw storageCorrupt("A pending job disagrees with its current-version baseline.");
  }
  return { state, rows, ...(baseline === undefined ? {} : { baseline }) };
};

const classifyBatch = (
  existing: readonly StoredMaterialRow[],
  prepared: readonly PreparedMaterial[],
  publishedBlobs: ReadonlyMap<ContentDigest, BlobPutResult>,
): PreparedBatch => {
  const existingById = new Map(existing.map((material) => [material.materialId, material]));
  const seen = new Map<MaterialId, PreparedMaterial>();
  const accepted: PreparedMaterial[] = [];
  const items: IngestItemResult[] = [];
  const storedAtByMaterialId = new Map(existing.map((row) => [row.materialId, row.storedAt]));

  for (const material of prepared) {
    const duplicateInBatch = seen.get(material.record.id);
    const stored = existingById.get(material.record.id);
    let kind: IngestItemResult["kind"];
    if (duplicateInBatch !== undefined) {
      if (
        duplicateInBatch.content !== material.content ||
        identityJson(duplicateInBatch.record) !== identityJson(material.record)
      ) {
        throw storageCorrupt("One material id resolved to conflicting batch semantics.");
      }
      kind = "duplicate";
    } else if (stored !== undefined) {
      const published = publishedBlobs.get(material.record.contentDigest);
      if (
        published === undefined ||
        stored.blobByteLength !== published.byteLength ||
        stored.contentDigest !== material.record.contentDigest ||
        stored.provenanceDigest !== material.record.provenanceDigest ||
        stored.sourceIdentity !== material.record.sourceIdentity ||
        stored.blobDigest !== material.record.contentDigest ||
        stored.identityJson !== identityJson(material.record)
      ) {
        throw storageCorrupt("A stored material id resolves to conflicting identity semantics.");
      }
      seen.set(material.record.id, material);
      kind = "duplicate";
    } else {
      seen.set(material.record.id, material);
      accepted.push(material);
      storedAtByMaterialId.set(material.record.id, material.record.storedAt);
      kind = "accepted";
    }
    items.push({
      clientRef: material.clientRef,
      kind,
      materialId: material.record.id,
      contentDigest: material.record.contentDigest,
    });
  }

  const targetManifest = [
    ...existing.map((row) => ({
      materialId: row.materialId,
      contentDigest: row.contentDigest,
      provenanceDigest: row.provenanceDigest,
    })),
    ...accepted.map(({ record }) => ({
      materialId: record.id,
      contentDigest: record.contentDigest,
      provenanceDigest: record.provenanceDigest,
    })),
  ].sort((left, right) =>
    left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
  );
  return { accepted, items, targetManifest, storedAtByMaterialId };
};

const writePending = (
  database: DatabaseSync,
  subjectId: SubjectId,
  pending: PendingJobMarker | undefined,
): void => {
  database.prepare("DELETE FROM pending_jobs WHERE subject_id = ?").run(subjectId);
  if (pending === undefined) return;
  database
    .prepare(
      `INSERT INTO pending_jobs(
         subject_id, job_id, generation, base_version_id, material_set_hash,
         added_material_count, total_material_count, queued_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subjectId,
      pending.jobId,
      pending.generation,
      pending.baseVersionId ?? null,
      pending.materialSetHash,
      pending.addedMaterialCount,
      pending.totalMaterialCount,
      pending.queuedAt,
    );
  if (pending.lease !== undefined) {
    database
      .prepare(
        `INSERT INTO job_leases(
           job_id, lease_id, lease_owner, acquired_at, expires_at,
           brief_contract_digest, source_grouping_version,
           prompt_version, draft_schema_version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        pending.jobId,
        pending.lease.id,
        pending.lease.owner,
        pending.lease.acquiredAt,
        pending.lease.expiresAt,
        pending.lease.contract.digest,
        pending.lease.contract.sourceGroupingVersion,
        pending.lease.contract.promptVersion,
        pending.lease.contract.draftSchemaVersion,
      );
  }
};

const pendingJobView = (
  subjectId: SubjectId,
  marker: PendingJobMarker,
  now: IsoDateTime,
): PendingJob => {
  const common = {
    id: marker.jobId,
    subjectId,
    generation: marker.generation,
    ...(marker.baseVersionId === undefined ? {} : { baseVersionId: marker.baseVersionId }),
    materialSetHash: marker.materialSetHash,
    addedMaterialCount: marker.addedMaterialCount,
    totalMaterialCount: marker.totalMaterialCount,
    queuedAt: marker.queuedAt,
  };
  return marker.lease !== undefined && now < marker.lease.expiresAt
    ? { ...common, state: "leased", leaseExpiresAt: marker.lease.expiresAt }
    : { ...common, state: "pending" };
};

const rawIdentity = (
  bytes: Uint8Array,
): { readonly rawId: RawId; readonly digest: ContentDigest } => {
  const hex = sha256Hex(bytes);
  return {
    rawId: rawIdSchema.parse(`raw_${hex}`),
    digest: contentDigestSchema.parse(`sha256_${hex}`),
  };
};

/**
 * Validates the trusted file loader's records for one file-ingest call.
 *
 * The loader may return MORE records than requested paths because one oversized file is
 * split into parts that each fit the material limit. The count therefore only has a lower
 * bound, while the wire limit for one result stays the upper bound; every record is still
 * checked below, and a split never loses or reorders the parts it reports.
 *
 * @param loaded - Records returned by the trusted loader.
 * @param expectedCount - Number of paths the caller supplied.
 * @returns The validated records, unchanged.
 */
const assertTrustedLoadedFiles = (
  loaded: readonly TrustedLoadedFile[],
  expectedCount: number,
): readonly TrustedLoadedFile[] => {
  if (loaded.length < expectedCount || loaded.length > WIRE_LIMITS.ingestMaterials) {
    throw storageCorrupt("The trusted file loader returned an invalid item count.");
  }
  const labels = new Set<string>();
  for (const item of loaded) {
    if (
      item.pathLabel.length === 0 ||
      item.pathLabel.includes("/") ||
      item.pathLabel.includes("\\") ||
      item.mediaType.length === 0 ||
      !(item.bytes instanceof Uint8Array)
    ) {
      throw storageCorrupt("The trusted file loader returned an invalid item.");
    }
    if (labels.has(item.pathLabel)) {
      throw storageCorrupt("The trusted file loader returned duplicate path labels.");
    }
    labels.add(item.pathLabel);
  }
  return loaded;
};

const ensureBlobAuthority = (
  database: DatabaseSync,
  digest: ContentDigest,
  published: BlobPutResult,
  existedBeforePublish: boolean,
): void => {
  let blobRow = queryOne(
    database,
    "SELECT byte_length FROM blobs WHERE digest = ?",
    [digest],
    "a blob authority row",
  );
  if (blobRow === undefined) {
    if (existedBeforePublish) {
      throw storageCorrupt("A referenced blob authority row disappeared before commit.");
    }
    database
      .prepare("INSERT INTO blobs(digest, byte_length) VALUES (?, ?)")
      .run(digest, published.byteLength);
    blobRow = queryOne(
      database,
      "SELECT byte_length FROM blobs WHERE digest = ?",
      [digest],
      "a newly inserted blob authority row",
    );
  }
  if (blobRow === undefined || integer(blobRow, "byte_length") !== published.byteLength) {
    throw storageCorrupt("A blob authority row conflicts with immutable bytes.");
  }
};

const insertAcceptedMaterial = (
  database: DatabaseSync,
  subjectId: SubjectId,
  material: PreparedMaterial,
): void => {
  database
    .prepare(
      `INSERT INTO materials(
         subject_id, material_id, kind, content_digest, provenance_digest,
         source_identity, identity_json, record_json, blob_digest, stored_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subjectId,
      material.record.id,
      material.record.kind,
      material.record.contentDigest,
      material.record.provenanceDigest,
      Buffer.from(material.record.sourceIdentity, "utf8"),
      identityJson(material.record),
      canonicalJson(material.record),
      material.record.contentDigest,
      material.record.storedAt,
    );
};

/** Atomic SQLite/WAL text ingest below the public EngineClient boundary. */
export class IngestService {
  readonly #dependencies: IngestServiceDependencies;

  /**
   * Creates the SQLite-backed ingest mutation.
   *
   * @param dependencies - SQLite, blob, identity, clock, and event seams.
   */
  constructor(dependencies: IngestServiceDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Performs one globally keyed atomic text ingest.
   *
   * @param rawInput - Untrusted method parameters parsed at this boundary.
   * @param rawActor - Trusted actor attached by the calling client composition.
   * @param rawMutation - Caller-owned RequestId retained across retries.
   * @returns The exact stored ingest result on first execution or replay.
   */
  async ingest(
    rawInput: IngestInput,
    rawActor: ActorContext,
    rawMutation: MutationContext,
  ): Promise<IngestResult> {
    const input = parseBoundary(
      () => engineMethodSchemas["materials.ingest"].params.parse(rawInput),
      "params",
    );
    const actor = parseBoundary(() => actorContextSchema.parse(rawActor) as ActorContext, "actor");
    const mutation = parseBoundary(
      () => mutationContextSchema.parse(rawMutation) as MutationContext,
      "requestId",
    );
    const canonicalTarget = canonicalizeIngestSubjectTarget(input.subject).target;
    const normalizedMaterials = input.materials.map(normalizeMaterial);
    if (
      normalizedMaterials.some(
        (material) =>
          material.derivation.kind === "host_extract" &&
          material.derivation.method === "computer_use_transcript",
      )
    ) {
      throw invalidInput(
        "Computer-use transcripts require a trusted private capture session.",
        "materials.derivation.method",
      );
    }
    const inputChecksum = computeMutationInputChecksum(
      "materials.ingest",
      { subject: canonicalTarget, materials: normalizedMaterials, enqueue: input.enqueue },
      actor,
    );
    const replay = this.#dependencies.store.read((database) =>
      replayCompletedMutation(database, {
        requestId: mutation.requestId,
        method: "materials.ingest",
        inputChecksum,
        actor,
      }),
    );
    if (replay !== undefined) return replay;

    const candidateSubjectId =
      canonicalTarget.kind === "existing"
        ? canonicalTarget.subjectId
        : this.#dependencies.ids.subjectId();
    const now = this.#dependencies.clock.now();
    const prepared = normalizedMaterials.map((material) =>
      prepareMaterial(material, candidateSubjectId, mutation.requestId, now),
    );
    const uniqueContent = new Map<ContentDigest, PreparedMaterial>();
    for (const material of prepared) {
      const previous = uniqueContent.get(material.record.contentDigest);
      if (previous !== undefined && previous.content !== material.content) {
        throw storageCorrupt("One content digest resolved to conflicting batch bytes.");
      }
      uniqueContent.set(material.record.contentDigest, material);
    }

    const outcome = await (async (): Promise<TransactionOutcome> => {
      const blobAccess = await this.#dependencies.blobs.acquireMutationAccess();
      try {
        const blobRowsBeforePublish = this.#dependencies.store.read((database) => {
          const existing = new Set<ContentDigest>();
          for (const digest of uniqueContent.keys()) {
            const row = queryOne(
              database,
              `SELECT
                 EXISTS(SELECT 1 FROM blobs WHERE digest = ?) AS blob_present,
                 EXISTS(SELECT 1 FROM materials WHERE blob_digest = ?) AS material_present`,
              [digest, digest],
              "pre-publish blob references",
            );
            if (row === undefined) {
              throw storageCorrupt("SQLite did not return a blob-reference snapshot.");
            }
            const blobPresent = sqliteBoolean(row, "blob_present");
            const materialPresent = sqliteBoolean(row, "material_present");
            if (materialPresent && !blobPresent) {
              throw storageCorrupt("A material references a missing blob authority row.");
            }
            if (blobPresent) existing.add(digest);
          }
          return existing;
        });
        const publishedBlobs = new Map<ContentDigest, BlobPutResult>();
        for (const material of uniqueContent.values()) {
          if (!blobRowsBeforePublish.has(material.record.contentDigest)) continue;
          const verified = await blobAccess.verify(material.record.contentDigest, material.content);
          if (verified === undefined) {
            throw storageCorrupt("A referenced content blob is missing from local storage.");
          }
          publishedBlobs.set(verified.digest, verified);
        }
        for (const material of uniqueContent.values()) {
          if (publishedBlobs.has(material.record.contentDigest)) continue;
          const published = await blobAccess.put(material.record.contentDigest, material.content);
          publishedBlobs.set(published.digest, published);
          await this.#dependencies.hooks?.afterBlobPut?.(material.record.contentDigest);
        }
        return this.#dependencies.store.write((database) => {
          const storedReplay = replayCompletedMutation(database, {
            requestId: mutation.requestId,
            method: "materials.ingest",
            inputChecksum,
            actor,
          });
          if (storedReplay !== undefined) {
            return { result: storedReplay, events: [], committed: false };
          }
          return this.#commit(
            database,
            input,
            actor,
            mutation,
            canonicalTarget,
            candidateSubjectId,
            prepared,
            blobRowsBeforePublish,
            publishedBlobs,
            inputChecksum,
            now,
          );
        });
      } finally {
        await blobAccess.release();
      }
    })();
    if (outcome.committed) {
      await this.#dependencies.hooks?.afterTransactionCommit?.(mutation.requestId);
      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
    }
    return outcome.result;
  }

  /**
   * Stores explicit local raw files and any deterministic parser outputs atomically.
   *
   * @param rawInput - Explicit file paths and create-or-existing subject target.
   * @param rawActor - Trusted actor bound by the Runtime session.
   * @param rawMutation - Caller-owned RequestId retained across retries.
   * @returns Stable per-path parsed/unparsed outcomes from the SQLite operation ledger.
   */
  async ingestFiles(
    rawInput: IngestFilesInput,
    rawActor: ActorContext,
    rawMutation: MutationContext,
  ): Promise<IngestFilesResult> {
    const input = parseBoundary(
      () => engineMethodSchemas["materials.ingestFiles"].params.parse(rawInput),
      "params",
    );
    const actor = parseBoundary(() => actorContextSchema.parse(rawActor) as ActorContext, "actor");
    const mutation = parseBoundary(
      () => mutationContextSchema.parse(rawMutation) as MutationContext,
      "requestId",
    );
    const target = canonicalizeIngestSubjectTarget(input.subject).target;
    const inputChecksum = computeMutationInputChecksum(
      "materials.ingestFiles",
      {
        subject: target,
        paths: input.paths,
        enqueue: input.enqueue,
        sensitivity: input.sensitivity ?? "private",
      },
      actor,
    );
    const replay = this.#dependencies.store.read((database) =>
      replayCompletedMutation(database, {
        requestId: mutation.requestId,
        method: "materials.ingestFiles",
        inputChecksum,
        actor,
      }),
    );
    if (replay !== undefined) return replay;
    if (this.#dependencies.fileLoader === undefined) {
      throw invalidInput("Local file ingest is unavailable in this Engine composition.");
    }

    const candidateSubjectId =
      target.kind === "existing" ? target.subjectId : this.#dependencies.ids.subjectId();
    const loaded = assertTrustedLoadedFiles(
      await this.#dependencies.fileLoader.load({
        paths: input.paths,
        subjectId: candidateSubjectId,
        requestId: mutation.requestId,
        sensitivity: input.sensitivity ?? "private",
      }),
      input.paths.length,
    );
    const now = this.#dependencies.clock.now();
    const preparedFiles: PreparedRawFile[] = loaded.map((file) => {
      const source = parseBoundary(
        () =>
          materialSourceInputSchema.parse({
            ...file.source,
            capturedAt: now,
          }) as MaterialSourceInput,
        "raw source",
      );
      if (source.title !== file.pathLabel) {
        throw storageCorrupt("The trusted file loader exposed an invalid source label.");
      }
      const identity = rawIdentity(file.bytes);
      const prepared =
        file.parsed === undefined
          ? undefined
          : prepareMaterial(
              parseBoundary(
                () =>
                  bindParsedMaterial(identity.rawId, {
                    ...file.parsed!,
                    source: {
                      ...file.parsed!.source,
                      capturedAt: now,
                    },
                  }),
                "parsed material",
              ),
              candidateSubjectId,
              mutation.requestId,
              now,
            );
      return {
        ...file,
        source,
        rawId: identity.rawId,
        blobDigest: identity.digest,
        ...(prepared === undefined ? {} : { prepared }),
      };
    });

    const values = new Map<ContentDigest, string | Uint8Array>();
    for (const file of preparedFiles) {
      const previousRaw = values.get(file.blobDigest);
      if (
        previousRaw !== undefined &&
        Buffer.compare(Buffer.from(previousRaw), Buffer.from(file.bytes)) !== 0
      ) {
        throw storageCorrupt("One raw digest resolved to conflicting batch bytes.");
      }
      values.set(file.blobDigest, file.bytes);
      if (file.prepared !== undefined) {
        const existing = values.get(file.prepared.record.contentDigest);
        if (
          existing !== undefined &&
          Buffer.compare(Buffer.from(existing), Buffer.from(file.prepared.content)) !== 0
        ) {
          throw storageCorrupt("One content digest resolved to conflicting batch bytes.");
        }
        values.set(file.prepared.record.contentDigest, file.prepared.content);
      }
    }

    const outcome = await (async (): Promise<FileTransactionOutcome> => {
      const blobAccess = await this.#dependencies.blobs.acquireMutationAccess();
      try {
        const existing = this.#dependencies.store.read((database) => {
          const digests = new Set<ContentDigest>();
          for (const digest of values.keys()) {
            const row = queryOne(
              database,
              "SELECT byte_length FROM blobs WHERE digest = ?",
              [digest],
              "pre-publish blob authority",
            );
            if (row !== undefined) digests.add(digest);
          }
          return digests;
        });
        const published = new Map<ContentDigest, BlobPutResult>();
        for (const [digest, value] of values) {
          const result = existing.has(digest)
            ? await blobAccess.verify(digest, value)
            : await blobAccess.put(digest, value);
          if (result === undefined) {
            throw storageCorrupt("A referenced content blob is missing from local storage.");
          }
          published.set(digest, result);
          if (!existing.has(digest)) await this.#dependencies.hooks?.afterBlobPut?.(digest);
        }
        return this.#dependencies.store.write((database) => {
          const storedReplay = replayCompletedMutation(database, {
            requestId: mutation.requestId,
            method: "materials.ingestFiles",
            inputChecksum,
            actor,
          });
          if (storedReplay !== undefined) {
            return { result: storedReplay, events: [], committed: false };
          }
          return this.#commitFiles(
            database,
            input,
            actor,
            mutation,
            target,
            candidateSubjectId,
            preparedFiles,
            existing,
            published,
            inputChecksum,
            now,
          );
        });
      } finally {
        await blobAccess.release();
      }
    })();
    if (outcome.committed) {
      await this.#dependencies.hooks?.afterTransactionCommit?.(mutation.requestId);
      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
    }
    return outcome.result;
  }

  #commitFiles(
    database: DatabaseSync,
    input: IngestFilesInput,
    actor: ActorContext,
    mutation: MutationContext,
    target: NormalizedIngestSubjectTarget,
    candidateSubjectId: SubjectId,
    files: readonly PreparedRawFile[],
    blobsBeforePublish: ReadonlySet<ContentDigest>,
    publishedBlobs: ReadonlyMap<ContentDigest, BlobPutResult>,
    inputChecksum: FactChecksum,
    now: IsoDateTime,
  ): FileTransactionOutcome {
    const created = target.kind === "create";
    const subject =
      target.kind === "existing"
        ? loadSubjectSummaryInTransaction(database, target.subjectId)
        : createSubjectIdentityInTransaction(
            database,
            target.input,
            this.#dependencies.ids,
            candidateSubjectId,
          );
    const previous = loadState(database, subject.id);
    const prepared = files.flatMap((file) => (file.prepared === undefined ? [] : [file.prepared]));
    const batch = classifyBatch(previous.rows, prepared, publishedBlobs);
    const derived =
      prepared.length === 0
        ? undefined
        : deriveIngestState({
            subjectId: subject.id,
            previous: previous.state,
            targetManifest: batch.targetManifest,
            ...(previous.baseline === undefined ? {} : { baseline: previous.baseline }),
            storedAtByMaterialId: batch.storedAtByMaterialId,
            enqueue: input.enqueue,
            now,
            nextJobId: () => this.#dependencies.ids.jobId(),
          });

    for (const [digest, published] of publishedBlobs) {
      ensureBlobAuthority(database, digest, published, blobsBeforePublish.has(digest));
    }
    for (const file of files) {
      const rawRow = queryOne(
        database,
        `SELECT blob_digest, byte_length, canonical_text_json
         FROM raw_materials
         WHERE raw_id = ?`,
        [file.rawId],
        "a raw material",
      );
      const published = publishedBlobs.get(file.blobDigest);
      if (published === undefined) throw storageCorrupt("A raw blob was not published.");
      const canonicalTextJson =
        file.prepared === undefined ? undefined : canonicalRawTextJson(file.prepared.record);
      if (rawRow === undefined) {
        database
          .prepare(
            `INSERT INTO raw_materials(
               raw_id, blob_digest, byte_length, canonical_text_json
             ) VALUES (?, ?, ?, ?)`,
          )
          .run(file.rawId, file.blobDigest, published.byteLength, canonicalTextJson ?? null);
      } else if (
        text(rawRow, "blob_digest") !== file.blobDigest ||
        integer(rawRow, "byte_length") !== published.byteLength
      ) {
        throw storageCorrupt("A raw id conflicts with its immutable blob.");
      } else if (canonicalTextJson !== undefined) {
        const existingCanonicalTextJson = nullableText(rawRow, "canonical_text_json");
        if (existingCanonicalTextJson === undefined) {
          database
            .prepare("UPDATE raw_materials SET canonical_text_json = ? WHERE raw_id = ?")
            .run(canonicalTextJson, file.rawId);
        } else if (existingCanonicalTextJson !== canonicalTextJson) {
          throw invalidInput(
            "The selected raw bytes already have a different canonical text extraction.",
            "paths",
          );
        }
      }
      database
        .prepare(
          `INSERT OR IGNORE INTO subject_raw_materials(
             subject_id, raw_id, media_type, source_json, stored_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(subject.id, file.rawId, file.mediaType, canonicalJson(file.source), now);
    }

    for (const material of batch.accepted) {
      const published = publishedBlobs.get(material.record.contentDigest);
      if (published === undefined) throw storageCorrupt("A material blob was not published.");
      insertAcceptedMaterial(database, subject.id, material);
    }
    if (derived !== undefined) {
      if (derived.state.materialSetHash === undefined) {
        throw storageCorrupt("A parsed file ingest is missing its material-set hash.");
      }
      database
        .prepare(
          `UPDATE subject_states
           SET generation = ?, material_set_hash = ?
           WHERE subject_id = ?`,
        )
        .run(derived.state.generation, derived.state.materialSetHash, subject.id);
      writePending(database, subject.id, derived.state.pending);
    }

    let parsedIndex = 0;
    const items = files.map((file) => {
      if (file.prepared === undefined) {
        return {
          kind: "unparsed" as const,
          pathLabel: file.pathLabel,
          rawId: file.rawId,
          mediaType: file.mediaType,
          warnings: file.warnings,
        };
      }
      const material = batch.items[parsedIndex++];
      if (material === undefined) throw storageCorrupt("A parsed file has no material outcome.");
      return {
        kind: "parsed" as const,
        pathLabel: file.pathLabel,
        material,
        warnings: file.warnings,
      };
    });
    const state = derived?.state ?? previous.state;
    const job =
      derived?.job ??
      (prepared.length === 0 && previous.state.pending !== undefined
        ? pendingJobView(subject.id, previous.state.pending, now)
        : undefined);
    const result = parseStored(
      () =>
        ingestFilesResultSchema.parse({
          subject: {
            ...subject,
            ...(state.currentVersionId === undefined
              ? {}
              : { currentVersionId: state.currentVersionId }),
          },
          created,
          items,
          generation: state.generation,
          ...(state.materialSetHash === undefined
            ? {}
            : { materialSetHash: state.materialSetHash }),
          ...(job === undefined ? {} : { job }),
        }),
      "file ingest result",
    ) as IngestFilesResult;
    insertCompletedOperationInTransaction(database, {
      requestId: mutation.requestId,
      method: "materials.ingestFiles",
      subjectId: subject.id,
      actor,
      inputChecksum,
      result,
      completedAt: now,
    });

    const events: EngineEvent[] = [];
    if (created) events.push({ kind: "subject.created", subjectId: subject.id, at: now });
    if (batch.accepted.length > 0) {
      events.push({ kind: "material.ingested", subjectId: subject.id, at: now });
    }
    if (derived?.pendingChanged === true) {
      events.push({ kind: "job.changed", subjectId: subject.id, at: now });
    }
    for (const event of events) {
      insertEventInTransaction(database, {
        eventId: this.#dependencies.ids.eventId(),
        event,
        actor,
        requestId: mutation.requestId,
      });
    }
    this.#dependencies.hooks?.beforeTransactionCommit?.(mutation.requestId);
    return { result, events, committed: true };
  }

  #commit(
    database: DatabaseSync,
    input: IngestInput,
    actor: ActorContext,
    mutation: MutationContext,
    target: NormalizedIngestSubjectTarget,
    candidateSubjectId: SubjectId,
    prepared: readonly PreparedMaterial[],
    blobRowsBeforePublish: ReadonlySet<ContentDigest>,
    publishedBlobs: ReadonlyMap<ContentDigest, BlobPutResult>,
    inputChecksum: FactChecksum,
    now: IsoDateTime,
  ): TransactionOutcome {
    const created = target.kind === "create";
    const subject =
      target.kind === "existing"
        ? loadSubjectSummaryInTransaction(database, target.subjectId)
        : createSubjectIdentityInTransaction(
            database,
            target.input,
            this.#dependencies.ids,
            candidateSubjectId,
          );
    const previous = loadState(database, subject.id);
    const batch = classifyBatch(previous.rows, prepared, publishedBlobs);
    const derived = deriveIngestState({
      subjectId: subject.id,
      previous: previous.state,
      targetManifest: batch.targetManifest,
      ...(previous.baseline === undefined ? {} : { baseline: previous.baseline }),
      storedAtByMaterialId: batch.storedAtByMaterialId,
      enqueue: input.enqueue,
      now,
      nextJobId: () => this.#dependencies.ids.jobId(),
    });
    if (derived.state.materialSetHash === undefined) {
      throw storageCorrupt("A non-empty ingest target is missing its material-set hash.");
    }

    for (const material of batch.accepted) {
      const published = publishedBlobs.get(material.record.contentDigest);
      if (published === undefined) throw storageCorrupt("A material blob was not published.");
      let blobRow = queryOne(
        database,
        "SELECT byte_length FROM blobs WHERE digest = ?",
        [material.record.contentDigest],
        "a blob authority row",
      );
      if (blobRow === undefined) {
        const dependent = queryOne(
          database,
          "SELECT 1 AS present FROM materials WHERE blob_digest = ? LIMIT 1",
          [material.record.contentDigest],
          "material references to a blob",
        );
        if (blobRowsBeforePublish.has(material.record.contentDigest) || dependent !== undefined) {
          throw storageCorrupt("A referenced blob authority row disappeared before commit.");
        }
        database
          .prepare(
            `INSERT INTO blobs(digest, byte_length)
             VALUES (?, ?)`,
          )
          .run(material.record.contentDigest, published.byteLength);
        blobRow = queryOne(
          database,
          "SELECT byte_length FROM blobs WHERE digest = ?",
          [material.record.contentDigest],
          "a newly inserted blob authority row",
        );
      }
      if (blobRow === undefined || integer(blobRow, "byte_length") !== published.byteLength) {
        throw storageCorrupt("A blob authority row conflicts with immutable bytes.");
      }
      insertAcceptedMaterial(database, subject.id, material);
    }

    database
      .prepare(
        `UPDATE subject_states
         SET generation = ?, material_set_hash = ?
         WHERE subject_id = ?`,
      )
      .run(derived.state.generation, derived.state.materialSetHash, subject.id);
    writePending(database, subject.id, derived.state.pending);

    const resultSubject: SubjectSummary = {
      ...subject,
      ...(derived.state.currentVersionId === undefined
        ? {}
        : { currentVersionId: derived.state.currentVersionId }),
    };
    const result: IngestResult =
      batch.accepted.length === 0
        ? {
            kind: "unchanged",
            subject: resultSubject,
            items: batch.items,
            materialSetHash: derived.state.materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          }
        : {
            kind: "ingested",
            subject: resultSubject,
            created,
            items: batch.items,
            materialSetHash: derived.state.materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          };
    const parsedResult = parseStored(
      () => ingestResultSchema.parse(result),
      "ingest result",
    ) as IngestResult;
    insertCompletedOperationInTransaction(database, {
      requestId: mutation.requestId,
      method: "materials.ingest",
      subjectId: subject.id,
      actor,
      inputChecksum,
      result: parsedResult,
      completedAt: now,
    });

    const events: EngineEvent[] = [];
    if (created) events.push({ kind: "subject.created", subjectId: subject.id, at: now });
    if (batch.accepted.length > 0) {
      events.push({ kind: "material.ingested", subjectId: subject.id, at: now });
    }
    if (derived.pendingChanged) {
      events.push({ kind: "job.changed", subjectId: subject.id, at: now });
    }
    for (const event of events) {
      insertEventInTransaction(database, {
        eventId: this.#dependencies.ids.eventId(),
        event,
        actor,
        requestId: mutation.requestId,
      });
    }
    this.#dependencies.hooks?.beforeTransactionCommit?.(mutation.requestId);
    return { result: parsedResult, events, committed: true };
  }
}
