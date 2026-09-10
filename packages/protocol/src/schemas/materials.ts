import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  compareUtf8,
  cursorStringSchema,
  labelStringSchema,
  listLimitSchema,
  materialContentSchema,
  httpUrlSchema,
  safeNonNegativeIntegerSchema,
  sourceIdentityStringSchema,
  uriStringSchema,
} from "./common.js";
import {
  captureAuditRefSchema,
  contentDigestSchema,
  conversationSourceKeySchema,
  factChecksumSchema,
  isoDateTimeSchema,
  materialIdSchema,
  materialSetHashSchema,
  provenanceDigestSchema,
  rawIdSchema,
  sourceGroupKeySchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import { pendingJobSchema } from "./jobs.js";
import { createSubjectInputSchema, subjectSummarySchema } from "./subjects.js";

export const artifactLocatorSchema = z.union([
  z.strictObject({
    provider: labelStringSchema,
    externalId: labelStringSchema,
    canonicalUri: httpUrlSchema.optional(),
  }),
  z.strictObject({
    provider: labelStringSchema,
    externalId: labelStringSchema.optional(),
    canonicalUri: httpUrlSchema,
  }),
]);

export const sourceMediumSchema = z.enum([
  "article",
  "webpage",
  "post",
  "video",
  "audio",
  "image",
  "document",
  "conversation",
  "other",
]);

export const sourceRoleSchema = z.enum([
  "first_party_expression",
  "interview",
  "editorial_reporting",
  "reference",
  "personal_communication",
]);

export const sourceAccessSchema = z.enum(["public", "restricted", "private"]);

export const hostExtractionMethodSchema = z.enum([
  "document_text",
  "ocr",
  "embedded_caption",
  "automatic_caption",
  "transcription",
  "computer_use_transcript",
]);

export const parserExtractionMethodSchema = z.enum([
  "document_text",
  "ocr",
  "embedded_caption",
  "automatic_caption",
  "transcription",
]);

export const textDerivationInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("native_text") }),
  z.strictObject({
    kind: z.literal("host_extract"),
    method: hostExtractionMethodSchema,
    producer: labelStringSchema,
    producerVersion: labelStringSchema.optional(),
    language: labelStringSchema.optional(),
  }),
]);

export const textDerivationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("native_text") }),
  z.strictObject({
    kind: z.literal("host_extract"),
    method: hostExtractionMethodSchema,
    producer: labelStringSchema,
    producerVersion: labelStringSchema.optional(),
    language: labelStringSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("raw_extract"),
    rawId: rawIdSchema,
    method: parserExtractionMethodSchema,
    producer: labelStringSchema,
    producerVersion: labelStringSchema.optional(),
    language: labelStringSchema.optional(),
  }),
]);

export const materialSourceInputSchema = z.strictObject({
  uri: httpUrlSchema.optional(),
  title: labelStringSchema.optional(),
  medium: sourceMediumSchema,
  access: sourceAccessSchema,
  role: sourceRoleSchema.optional(),
  artifact: artifactLocatorSchema.optional(),
  representationOf: artifactLocatorSchema.optional(),
  capturedAt: isoDateTimeSchema,
  occurredAt: isoDateTimeSchema.optional(),
  publishedAt: isoDateTimeSchema.optional(),
  language: labelStringSchema.optional(),
  authors: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems).optional(),
});

export const materialSourceSchema = z.strictObject({
  ...materialSourceInputSchema.shape,
  authors: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const materialInputSchema = z
  .strictObject({
    clientRef: labelStringSchema,
    kind: z.enum(["web", "document", "message", "email", "transcript", "derived_text"]),
    content: materialContentSchema,
    source: materialSourceInputSchema,
    derivation: textDerivationInputSchema,
    participants: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems).optional(),
    sensitivity: z.enum(["private", "shareable"]).optional(),
    flags: z.array(z.literal("suspicious_source")).max(WIRE_LIMITS.smallArrayItems).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.kind === "web" &&
      (value.source.uri === undefined || !/^https?:\/\//i.test(value.source.uri))
    ) {
      context.addIssue({
        code: "custom",
        path: ["source", "uri"],
        message: "web materials require an absolute http(s) URI",
      });
    }
  });

export const ingestSubjectTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("existing"), subjectId: subjectIdSchema }),
  z.strictObject({ kind: z.literal("create"), input: createSubjectInputSchema }),
]);

export const ingestItemResultSchema = z.strictObject({
  clientRef: labelStringSchema,
  kind: z.enum(["accepted", "duplicate"]),
  materialId: materialIdSchema,
  contentDigest: contentDigestSchema,
});

const pendingJobSchemaReference = z.lazy(() => pendingJobSchema);

export const ingestResultSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("ingested"),
      subject: subjectSummarySchema,
      created: z.boolean(),
      items: z.array(ingestItemResultSchema).min(1).max(WIRE_LIMITS.ingestMaterials),
      materialSetHash: materialSetHashSchema,
      generation: safeNonNegativeIntegerSchema,
      job: pendingJobSchemaReference.optional(),
    }),
    z.strictObject({
      kind: z.literal("unchanged"),
      subject: subjectSummarySchema,
      items: z.array(ingestItemResultSchema).min(1).max(WIRE_LIMITS.ingestMaterials),
      materialSetHash: materialSetHashSchema,
      generation: safeNonNegativeIntegerSchema,
      job: pendingJobSchemaReference.optional(),
    }),
  ])
  .superRefine((result, context) => {
    const acceptedItems = result.items.filter((item) => item.kind === "accepted");
    if (result.kind === "ingested" && acceptedItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "an ingested result requires at least one accepted material",
      });
    }
    if (result.kind === "unchanged" && acceptedItems.length !== 0) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "an unchanged result can contain only duplicate materials",
      });
    }
    if (result.job !== undefined) {
      if (result.job.subjectId !== result.subject.id) {
        context.addIssue({
          code: "custom",
          path: ["job", "subjectId"],
          message: "an ingest job must belong to the result subject",
        });
      }
      if (result.job.generation !== result.generation) {
        context.addIssue({
          code: "custom",
          path: ["job", "generation"],
          message: "an ingest job must match the result generation",
        });
      }
      if (result.job.materialSetHash !== result.materialSetHash) {
        context.addIssue({
          code: "custom",
          path: ["job", "materialSetHash"],
          message: "an ingest job must match the result material-set hash",
        });
      }
    }
  });

export const ingestInputSchema = z.strictObject({
  subject: ingestSubjectTargetSchema,
  materials: z.array(materialInputSchema).min(1).max(WIRE_LIMITS.ingestMaterials),
  enqueue: z.enum(["auto", "now"]),
});

export const ingestFilesInputSchema = z.strictObject({
  subject: ingestSubjectTargetSchema,
  paths: z.array(uriStringSchema).min(1).max(WIRE_LIMITS.ingestMaterials),
  enqueue: z.enum(["auto", "now"]),
  sensitivity: z.enum(["private", "shareable"]).optional(),
});

export const fileIngestItemResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("parsed"),
    pathLabel: uriStringSchema,
    material: ingestItemResultSchema,
    // Parser observations such as skipped attachments or ambiguous separators must reach
    // the caller: a parsed file is not the same as a file parsed completely.
    warnings: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    kind: z.literal("unparsed"),
    pathLabel: uriStringSchema,
    rawId: rawIdSchema,
    mediaType: labelStringSchema,
    warnings: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
]);

export const ingestFilesResultSchema = z.strictObject({
  subject: subjectSummarySchema,
  created: z.boolean(),
  items: z.array(fileIngestItemResultSchema).max(WIRE_LIMITS.ingestMaterials),
  generation: safeNonNegativeIntegerSchema,
  materialSetHash: materialSetHashSchema.optional(),
  job: pendingJobSchemaReference.optional(),
});

export const correctionProvenanceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("direct_user") }),
  z.strictObject({
    kind: z.literal("relayed"),
    actorKind: z.enum(["host", "sdk", "executor", "system"]),
    actorId: labelStringSchema,
  }),
]);

export const materialRecordKindSchema = z.enum([
  "web",
  "document",
  "message",
  "email",
  "transcript",
  "derived_text",
  "correction",
]);

export const materialRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    checksum: factChecksumSchema,
    id: materialIdSchema,
    subjectId: subjectIdSchema,
    kind: materialRecordKindSchema,
    contentDigest: contentDigestSchema,
    provenanceDigest: provenanceDigestSchema,
    sourceIdentity: sourceIdentityStringSchema,
    source: materialSourceSchema,
    derivation: textDerivationSchema,
    participants: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
    sensitivity: z.enum(["private", "shareable"]),
    correctionProvenance: correctionProvenanceSchema.optional(),
    captureAuditRef: captureAuditRefSchema.optional(),
    conversationSourceKey: conversationSourceKeySchema.optional(),
    flags: z.array(z.literal("suspicious_source")).max(WIRE_LIMITS.smallArrayItems),
    storedAt: isoDateTimeSchema,
  })
  .superRefine((record, context) => {
    const isCorrection = record.kind === "correction";
    if (isCorrection !== (record.correctionProvenance !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["correctionProvenance"],
        message: "correction provenance exists if and only if kind is correction",
      });
    }

    const hasAuditRef = record.captureAuditRef !== undefined;
    const hasConversationKey = record.conversationSourceKey !== undefined;
    if (hasAuditRef !== hasConversationKey) {
      context.addIssue({
        code: "custom",
        path: hasAuditRef ? ["conversationSourceKey"] : ["captureAuditRef"],
        message: "private capture stamps must be stored together",
      });
    }

    if (hasAuditRef && hasConversationKey) {
      const captureShapeIsValid =
        record.kind === "transcript" &&
        record.source.medium === "conversation" &&
        record.source.access === "private" &&
        record.source.role === "personal_communication" &&
        record.derivation.kind === "host_extract" &&
        record.derivation.method === "computer_use_transcript" &&
        record.sensitivity === "private" &&
        record.source.uri === undefined &&
        record.source.artifact === undefined &&
        record.source.representationOf === undefined;
      if (!captureShapeIsValid) {
        context.addIssue({
          code: "custom",
          path: ["captureAuditRef"],
          message: "private capture stamps require a private conversation transcript record",
        });
      }
    }
  });

export const sourceGroupBasisSchema = z.enum([
  "same_raw",
  "same_private_conversation",
  "representation_of",
  "provider_artifact",
  "canonical_uri",
  "exact_republication",
  "unknown",
]);

export const sourceDiversityStatusSchema = z.enum(["eligible", "ineligible", "unknown"]);

export const sourceGroupCautionSchema = z.enum([
  "access_conflict",
  "private_source",
  "restricted_source",
  "correction",
  "insufficient_public_proof",
]);

export const sourceGroupSchema = z.strictObject({
  key: sourceGroupKeySchema,
  bases: z.array(sourceGroupBasisSchema).max(WIRE_LIMITS.smallArrayItems),
  diversityStatus: sourceDiversityStatusSchema,
  cautions: z.array(sourceGroupCautionSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const materialQuerySchema = z.strictObject({
  subjectId: subjectIdSchema,
  kind: materialRecordKindSchema.optional(),
  atVersionId: versionIdSchema.optional(),
  cursor: cursorStringSchema.optional(),
  limit: listLimitSchema.optional(),
});

export const sourceGroupingContextSchema = z.strictObject({
  algorithmVersion: labelStringSchema,
  generation: safeNonNegativeIntegerSchema,
  versionId: versionIdSchema.optional(),
});

export const materialSummarySchema = z.strictObject({
  record: materialRecordSchema,
  contentScalarCount: safeNonNegativeIntegerSchema,
  rawAvailable: z.boolean(),
  inCurrentGeneration: z.boolean(),
  sourceGroup: sourceGroupSchema,
  grouping: sourceGroupingContextSchema,
});

export const materialPageSchema = z
  .strictObject({
    items: z.array(materialSummarySchema).max(WIRE_LIMITS.listLimit),
    nextCursor: cursorStringSchema.optional(),
  })
  .superRefine((page, context) => {
    for (let index = 1; index < page.items.length; index += 1) {
      const previous = page.items[index - 1];
      const current = page.items[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        compareUtf8(previous.record.id, current.record.id) >= 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "record", "id"],
          message: "material items must be strictly ordered by MaterialId",
        });
      }
    }
  });

export const getMaterialInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  materialId: materialIdSchema,
  atVersionId: versionIdSchema.optional(),
});

export const materialViewSchema = z.strictObject({
  record: materialRecordSchema,
  content: materialContentSchema,
  rawAvailable: z.boolean(),
  inCurrentGeneration: z.boolean(),
  sourceGroup: sourceGroupSchema,
  grouping: sourceGroupingContextSchema,
});
