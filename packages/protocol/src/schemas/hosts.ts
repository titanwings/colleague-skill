import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  httpUrlSchema,
  jsonObjectSchema,
  labelStringSchema,
  reasonStringSchema,
  safeNonNegativeIntegerSchema,
  safePositiveIntegerSchema,
  uriStringSchema,
} from "./common.js";
import { briefCapacitySchema } from "./context.js";
import {
  contentDigestSchema,
  hostNameSchema,
  isoDateTimeSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import { ingestResultSchema, ingestSubjectTargetSchema, materialInputSchema } from "./materials.js";
import { subjectSummarySchema } from "./subjects.js";
import { reviewRefSchema, suspendedVersionSummarySchema } from "./versions.js";
import { distillyWireErrorSchema } from "./wire.js";

export const capabilityAvailabilitySchema = z.enum(["available", "unavailable", "unknown"]);

const lifecycleHookOrder = {
  session_start: 0,
  session_end: 1,
  command: 2,
} as const;

const lifecycleHooksSchema = z
  .array(z.enum(["session_start", "session_end", "command"]))
  .max(WIRE_LIMITS.smallArrayItems)
  .refine(
    (hooks) =>
      hooks.every(
        (hook, index) =>
          index === 0 || lifecycleHookOrder[hooks[index - 1]!] < lifecycleHookOrder[hook],
      ),
    { message: "lifecycle hooks must be unique and in canonical order" },
  );

export const hostCapabilitiesSchema = z
  .strictObject({
    webResearch: capabilityAvailabilitySchema,
    localFileRead: capabilityAvailabilitySchema,
    vision: capabilityAvailabilitySchema,
    documentTextExtraction: capabilityAvailabilitySchema,
    imageOcr: capabilityAvailabilitySchema,
    audioTranscription: capabilityAvailabilitySchema,
    videoCaptions: capabilityAvailabilitySchema,
    privateUiCapture: capabilityAvailabilitySchema,
    windowScopedCapture: capabilityAvailabilitySchema,
    captureDataPolicy: z.enum(["known", "unknown"]),
    structuredToolCalls: z.boolean(),
    lifecycleHooks: lifecycleHooksSchema,
    subruns: z.boolean(),
    subrunsInheritMcp: z.boolean(),
    opensLoopbackUrls: z.boolean(),
    maxContextTokens: safePositiveIntegerSchema.optional(),
    maxToolResultBytes: safePositiveIntegerSchema.optional(),
  })
  .superRefine((capabilities, context) => {
    if (
      capabilities.privateUiCapture === "available" &&
      capabilities.windowScopedCapture !== "available"
    ) {
      context.addIssue({
        code: "custom",
        path: ["windowScopedCapture"],
        message: "private UI capture requires window-scoped capture",
      });
    }
    if (
      capabilities.privateUiCapture === "available" &&
      capabilities.captureDataPolicy !== "known"
    ) {
      context.addIssue({
        code: "custom",
        path: ["captureDataPolicy"],
        message: "private UI capture requires a known capture data policy",
      });
    }
    if (capabilities.subrunsInheritMcp && !capabilities.subruns) {
      context.addIssue({
        code: "custom",
        path: ["subrunsInheritMcp"],
        message: "MCP inheritance requires subrun support",
      });
    }
  });

export const hostPreflightEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("host_handshake"),
    host: hostNameSchema,
    hostVersion: labelStringSchema,
    environment: z.enum(["desktop", "cli", "ci"]),
    releaseVersion: labelStringSchema,
    wireMajor: z.literal(3),
    canonicalSkillDigest: contentDigestSchema,
  }),
  z.strictObject({
    kind: z.literal("binding_fixture"),
    fixtureId: labelStringSchema,
    host: hostNameSchema,
    hostVersion: labelStringSchema,
    environment: z.enum(["desktop", "cli", "ci"]),
    releaseVersion: labelStringSchema,
    wireMajor: z.literal(3),
    canonicalSkillDigest: contentDigestSchema,
  }),
  z.strictObject({
    // An unrecorded host version runs on a floor budget copied from the smallest verified
    // fixture; this kind keeps that state visible to every reader of the preflight.
    kind: z.literal("unverified_host_version"),
    host: hostNameSchema,
    hostVersion: labelStringSchema,
    environment: z.enum(["desktop", "cli", "ci"]),
    releaseVersion: labelStringSchema,
    wireMajor: z.literal(3),
    canonicalSkillDigest: contentDigestSchema,
    floorSourceFixtureId: labelStringSchema,
  }),
]);

const hostUnsupportedWireErrorSchema = z.strictObject({
  code: z.literal("host_unsupported"),
  message: reasonStringSchema,
  retryable: z.literal(false),
  fieldPath: labelStringSchema.optional(),
  remediation: reasonStringSchema.optional(),
  details: jsonObjectSchema.optional(),
});

export const hostPreflightSchema = z
  .discriminatedUnion("ok", [
    z.strictObject({
      ok: z.literal(true),
      capabilities: hostCapabilitiesSchema,
      capacity: briefCapacitySchema,
      evidence: hostPreflightEvidenceSchema,
      warnings: z.array(reasonStringSchema).max(WIRE_LIMITS.smallArrayItems),
    }),
    z.strictObject({
      ok: z.literal(false),
      capabilities: hostCapabilitiesSchema,
      error: hostUnsupportedWireErrorSchema,
      warnings: z.array(reasonStringSchema).max(WIRE_LIMITS.smallArrayItems),
    }),
  ])
  .superRefine((preflight, context) => {
    if (!preflight.ok) return;
    if (!preflight.capabilities.structuredToolCalls) {
      context.addIssue({
        code: "custom",
        path: ["capabilities", "structuredToolCalls"],
        message: "a successful preflight requires structured tool calls",
      });
    }
    // The capacity source must name the same authority as the evidence: a floor budget
    // may only come from an unverified host version, and a measurement may not.
    const expectedSource =
      preflight.evidence.kind === "unverified_host_version"
        ? "conservative_floor"
        : preflight.evidence.kind;
    if (preflight.capacity.source !== expectedSource) {
      context.addIssue({
        code: "custom",
        path: ["capacity", "source"],
        message: "capacity source must match preflight evidence",
      });
    }
  });

export const privateUiCaptureRangeSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      kind: z.literal("time"),
      from: isoDateTimeSchema,
      to: isoDateTimeSchema,
    })
    .refine((range) => range.to >= range.from, {
      path: ["to"],
      message: "to must not precede from",
    }),
  z.strictObject({
    kind: z.literal("visible_message_range"),
    startLabel: labelStringSchema,
    endLabel: labelStringSchema,
  }),
]);

export const privateUiCaptureScopeSchema = z.strictObject({
  subject: ingestSubjectTargetSchema,
  application: labelStringSchema,
  accountLabel: labelStringSchema,
  threadLabel: labelStringSchema,
  range: privateUiCaptureRangeSchema,
  textOnly: z.literal(true),
  purpose: z.literal("profile_distillation"),
});

export const privateUiCaptureAuthorizationSchema = z.strictObject({
  expiresAt: isoDateTimeSchema,
  authorityAttested: z.literal(true),
  hostProcessingDisclosed: z.literal(true),
  isolation: z.enum(["window", "region"]),
  dataPolicyUri: httpUrlSchema,
  dataPolicyVersion: labelStringSchema,
  retentionNoticeVersion: labelStringSchema,
  conversationLocator: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("stable"),
      applicationId: labelStringSchema,
      accountLocator: labelStringSchema,
      threadLocator: labelStringSchema,
    }),
    z.strictObject({ kind: z.literal("subject_fallback") }),
  ]),
});

export const privateUiCaptureGuardStopReasonSchema = z.enum([
  "user_cancelled",
  "authorization_expired",
  "idle_timeout",
  "screen_locked",
  "account_changed",
  "thread_changed",
  "window_changed",
  "scope_exceeded",
  "isolation_lost",
  "controller_failed",
  "host_shutdown",
]);

export const privateUiCaptureActionAbortReasonSchema = z.union([
  privateUiCaptureGuardStopReasonSchema,
  z.literal("coordinator_aborted"),
]);

export const privateUiCaptureStopReasonSchema = z.union([
  privateUiCaptureActionAbortReasonSchema,
  z.enum(["ingest_rejected", "process_terminated"]),
]);

export const privateUiCaptureAuditStopSchema = z.union([
  z.literal("completed"),
  privateUiCaptureStopReasonSchema,
]);

export const privateUiCaptureGrantStatusSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("active"),
    boundaryRefusalCount: safeNonNegativeIntegerSchema,
  }),
  z.strictObject({
    kind: z.literal("revoked"),
    reason: privateUiCaptureGuardStopReasonSchema,
    boundaryRefusalCount: safeNonNegativeIntegerSchema,
  }),
]);

export const privateUiCaptureRefusalReasonSchema = z.enum([
  "user_declined",
  "scope_unsupported",
  "isolation_unavailable",
  "data_policy_unknown",
  "authority_not_attested",
]);

export const privateUiCaptureRefusedSchema = z.strictObject({
  kind: z.literal("refused"),
  reason: privateUiCaptureRefusalReasonSchema,
});

const capturedPrivateMaterialSchema = materialInputSchema.superRefine((material, context) => {
  const requireLiteral = (valid: boolean, path: readonly (string | number)[], message: string) => {
    if (!valid) context.addIssue({ code: "custom", path: [...path], message });
  };

  requireLiteral(material.kind === "transcript", ["kind"], "private capture requires transcript");
  requireLiteral(
    material.source.medium === "conversation",
    ["source", "medium"],
    "private capture requires conversation medium",
  );
  requireLiteral(
    material.source.access === "private",
    ["source", "access"],
    "private capture requires private source access",
  );
  requireLiteral(
    material.source.role === "personal_communication",
    ["source", "role"],
    "private capture requires personal communication role",
  );
  requireLiteral(
    material.derivation.kind === "host_extract" &&
      material.derivation.method === "computer_use_transcript",
    ["derivation"],
    "private capture requires a computer-use transcript",
  );
  requireLiteral(
    material.sensitivity === "private",
    ["sensitivity"],
    "private capture requires private sensitivity",
  );

  for (const field of ["uri", "artifact", "representationOf", "title"] as const) {
    requireLiteral(
      material.source[field] === undefined,
      ["source", field],
      `private capture forbids source ${field}`,
    );
  }
});

export const capturedPrivateTranscriptSchema = z.strictObject({
  materials: z.array(capturedPrivateMaterialSchema).min(1).max(WIRE_LIMITS.ingestMaterials),
});

export const privateUiCaptureIngestResultSchema = ingestResultSchema.superRefine(
  (result, context) => {
    if (result.kind === "ingested" && result.job === undefined) {
      context.addIssue({
        code: "custom",
        path: ["job"],
        message: "a changed private capture requires a pending job",
      });
    }
  },
);

export const privateUiCaptureActionResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ingested"), result: privateUiCaptureIngestResultSchema }),
  privateUiCaptureRefusedSchema,
  z.strictObject({
    kind: z.literal("aborted"),
    reason: privateUiCaptureActionAbortReasonSchema,
  }),
  z.strictObject({ kind: z.literal("failed"), error: distillyWireErrorSchema }),
]);

export const installOptionsSchema = z.strictObject({
  versionId: versionIdSchema.optional(),
  destination: uriStringSchema.optional(),
});

export const installInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  host: hostNameSchema,
  options: installOptionsSchema.optional(),
});

export const installRefSchema = z.strictObject({
  id: labelStringSchema,
  host: hostNameSchema,
  subjectId: subjectIdSchema,
  versionId: versionIdSchema,
  path: uriStringSchema,
  contentDigest: contentDigestSchema,
  installedAt: isoDateTimeSchema,
});

export const uninstallInputSchema = z.strictObject({
  install: installRefSchema,
});

export const exportOptionsSchema = z.strictObject({
  destination: uriStringSchema,
  versionId: versionIdSchema.optional(),
  overwrite: z.boolean().optional(),
});

export const hostExportInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  host: hostNameSchema,
  options: exportOptionsSchema,
});

export const exportRefSchema = z.strictObject({
  host: hostNameSchema,
  subjectId: subjectIdSchema,
  versionId: versionIdSchema,
  path: uriStringSchema,
  contentDigest: contentDigestSchema,
});

export const extensionStatusSchema = z.strictObject({
  id: labelStringSchema,
  kind: z.enum(["host", "adapter", "parser"]),
  ok: z.boolean(),
  version: labelStringSchema.optional(),
  warnings: z.array(reasonStringSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const doctorInputSchema = z.strictObject({
  host: hostNameSchema.optional(),
});

export const doctorSnapshotSchema = z.strictObject({
  runtime: z.strictObject({
    productVersion: labelStringSchema,
    wireVersion: labelStringSchema,
    promptVersion: labelStringSchema,
  }),
  storage: z.strictObject({
    rootLabel: labelStringSchema,
    writable: z.boolean(),
    schemaSupported: z.boolean(),
    projectionsDirty: z.boolean(),
    pendingBlobGcCount: safeNonNegativeIntegerSchema,
  }),
  panel: z.strictObject({
    loopbackOnly: z.boolean(),
    authentication: z.enum(["enabled", "unavailable"]),
  }),
  extensions: z.array(extensionStatusSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const systemBackupInputSchema = z.strictObject({
  destination: uriStringSchema,
  overwrite: z.boolean().optional(),
});

export const systemBackupResultSchema = z.strictObject({
  path: uriStringSchema,
  manifestDigest: contentDigestSchema,
  createdAt: isoDateTimeSchema,
});

export const systemRestoreInputSchema = z.strictObject({
  source: uriStringSchema,
  confirmation: contentDigestSchema,
});

export const systemRestoreResultSchema = z.strictObject({
  manifestDigest: contentDigestSchema,
  restoredAt: isoDateTimeSchema,
  previousRootPath: uriStringSchema,
});

export const bundleInspectInputSchema = z.strictObject({
  path: uriStringSchema,
});

export const bundleInspectionSchema = z.strictObject({
  displayName: labelStringSchema,
  claimCount: safeNonNegativeIntegerSchema,
  evidenceExcerptCount: safeNonNegativeIntegerSchema,
  license: labelStringSchema,
  signature: z.enum(["valid", "missing", "invalid"]),
  warnings: z.array(reasonStringSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const bundleImportInputSchema = z.strictObject({
  path: uriStringSchema,
  spaceId: spaceIdSchema.optional(),
  confirmation: labelStringSchema,
});

export const bundleImportResultSchema = z.strictObject({
  subject: subjectSummarySchema,
  candidate: suspendedVersionSummarySchema,
  review: reviewRefSchema,
});

export const bundleExportInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  versionId: versionIdSchema.optional(),
  destination: uriStringSchema,
  provenancePolicy: z.enum(["none", "citations_and_quotes"]),
});

export const bundleExportResultSchema = z.strictObject({
  path: uriStringSchema,
  contentDigest: contentDigestSchema,
});
