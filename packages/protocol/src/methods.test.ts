import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  CoreEngineClient,
  CoreMethodName,
  EngineAdministrationClient,
  EngineClient,
  RuntimeOwnedMethodName,
} from "./engine-client.js";
import type { ContentDigest, FacetPath, HostName } from "./ids.js";
import { hostPreflightSchema } from "./schemas/hosts.js";
import type {
  EmptyResult,
  EngineMethodMap,
  Method,
  MutationMethodName,
  QueryMethodName,
} from "./methods.js";
import type { BriefCapacity, MutationContext } from "./values.js";
import type { Claim, ClaimDraft } from "./values/claims.js";
import type {
  BundleExportInput,
  BundleExportResult,
  BundleImportInput,
  BundleImportResult,
  BundleInspectInput,
  BundleInspection,
  CapabilityAvailability,
  CapturedPrivateTranscript,
  DoctorInput,
  DoctorSnapshot,
  ExportRef,
  HostCapabilities,
  HostEnvironment,
  HostExportInput,
  HostPreflight,
  HostPreflightEvidence,
  InstallInput,
  InstallRef,
  PrivateUiCaptureActionAbortReason,
  PrivateUiCaptureActionResult,
  PrivateUiCaptureAuditStop,
  PrivateUiCaptureAuthorization,
  PrivateUiCaptureGrantStatus,
  PrivateUiCaptureGuardStopReason,
  PrivateUiCaptureIngestResult,
  PrivateUiCaptureRange,
  PrivateUiCaptureRefusalReason,
  PrivateUiCaptureScope,
  PrivateUiCaptureStopReason,
  SystemBackupInput,
  SystemBackupResult,
  SystemRestoreInput,
  SystemRestoreResult,
  UninstallInput,
} from "./values/hosts.js";
import type {
  BriefInput,
  HostDistillBriefing,
  JobLease,
  PendingFilter,
  PendingJob,
  RedistillInput,
  ReleaseLeaseInput,
  RenewLeaseInput,
} from "./values/jobs.js";
import type {
  GetMaterialInput,
  IngestFilesInput,
  IngestFilesResult,
  IngestInput,
  IngestResult,
  IngestSubjectTarget,
  MaterialInput,
  MaterialPage,
  MaterialQuery,
  MaterialView,
} from "./values/materials.js";
import type {
  CorrectInput,
  CorrectionDraft,
  GetProfileInput,
  LibraryPage,
  LibraryQuery,
  Profile,
  ProfileDiff,
  RebuildResult,
} from "./values/profiles.js";
import type {
  CreateSubjectInput,
  PurgeResult,
  PurgeSubjectInput,
  ResolveSubjectInput,
  ResolveSubjectResult,
  SubjectPage,
  SubjectQuery,
  SubjectRef,
  SubjectStatus,
  SubjectSummary,
} from "./values/subjects.js";
import type {
  CommitInput,
  CommitResult,
  DiffInput,
  LineageInput,
  LineagePage,
  ReviewActionInput,
  ReviewItem,
  ReviewPage,
  ReviewQuery,
  ReviewReason,
  RollbackInput,
  VersionPage,
  VersionQuery,
  VersionSummary,
} from "./values/versions.js";

type ExpectedMethodName =
  | "subjects.create"
  | "subjects.list"
  | "subjects.resolve"
  | "subjects.archive"
  | "subjects.purge"
  | "materials.ingest"
  | "materials.ingestFiles"
  | "materials.list"
  | "materials.get"
  | "distill.pending"
  | "distill.brief"
  | "distill.renew"
  | "distill.release"
  | "distill.commit"
  | "distill.redistill"
  | "profiles.get"
  | "profiles.prompt"
  | "profiles.status"
  | "profiles.correct"
  | "versions.list"
  | "versions.diff"
  | "versions.promote"
  | "versions.reject"
  | "versions.rollback"
  | "versions.lineage"
  | "hosts.install"
  | "hosts.uninstall"
  | "hosts.export"
  | "library.list"
  | "library.rebuild"
  | "reviews.list"
  | "bundles.inspect"
  | "bundles.import"
  | "bundles.export"
  | "system.doctor";

type ExpectedMutationMethodName =
  | "subjects.create"
  | "subjects.archive"
  | "subjects.purge"
  | "materials.ingest"
  | "materials.ingestFiles"
  | "distill.brief"
  | "distill.renew"
  | "distill.release"
  | "distill.commit"
  | "distill.redistill"
  | "profiles.correct"
  | "versions.promote"
  | "versions.reject"
  | "versions.rollback"
  | "hosts.install"
  | "hosts.uninstall"
  | "hosts.export"
  | "library.rebuild"
  | "bundles.import"
  | "bundles.export";

type ExpectedRuntimeOwnedMethodName =
  "hosts.install" | "hosts.uninstall" | "hosts.export" | "system.doctor";

type ExpectedCaptureGuardStopReason =
  | "user_cancelled"
  | "authorization_expired"
  | "idle_timeout"
  | "screen_locked"
  | "account_changed"
  | "thread_changed"
  | "window_changed"
  | "scope_exceeded"
  | "isolation_lost"
  | "controller_failed"
  | "host_shutdown";

type ExpectedCaptureRefusalReason =
  | "user_declined"
  | "scope_unsupported"
  | "isolation_unavailable"
  | "data_policy_unknown"
  | "authority_not_attested";

type ExpectedEngineMethodMap = Readonly<{
  readonly "subjects.create": Method<CreateSubjectInput, SubjectSummary>;
  readonly "subjects.list": Method<SubjectQuery, SubjectPage>;
  readonly "subjects.resolve": Method<ResolveSubjectInput, ResolveSubjectResult>;
  readonly "subjects.archive": Method<SubjectRef, EmptyResult>;
  readonly "subjects.purge": Method<PurgeSubjectInput, PurgeResult>;
  readonly "materials.ingest": Method<IngestInput, IngestResult>;
  readonly "materials.ingestFiles": Method<IngestFilesInput, IngestFilesResult>;
  readonly "materials.list": Method<MaterialQuery, MaterialPage>;
  readonly "materials.get": Method<GetMaterialInput, MaterialView>;
  readonly "distill.pending": Method<PendingFilter, readonly PendingJob[]>;
  readonly "distill.brief": Method<BriefInput, HostDistillBriefing>;
  readonly "distill.renew": Method<RenewLeaseInput, JobLease>;
  readonly "distill.release": Method<ReleaseLeaseInput, EmptyResult>;
  readonly "distill.commit": Method<CommitInput, CommitResult>;
  readonly "distill.redistill": Method<RedistillInput, PendingJob>;
  readonly "profiles.get": Method<GetProfileInput, Profile>;
  readonly "profiles.prompt": Method<GetProfileInput, string>;
  readonly "profiles.status": Method<SubjectRef, SubjectStatus>;
  readonly "profiles.correct": Method<CorrectInput, CommitResult>;
  readonly "versions.list": Method<VersionQuery, VersionPage>;
  readonly "versions.diff": Method<DiffInput, ProfileDiff>;
  readonly "versions.promote": Method<ReviewActionInput, VersionSummary>;
  readonly "versions.reject": Method<ReviewActionInput, VersionSummary>;
  readonly "versions.rollback": Method<RollbackInput, VersionSummary>;
  readonly "versions.lineage": Method<LineageInput, LineagePage>;
  readonly "hosts.install": Method<InstallInput, InstallRef>;
  readonly "hosts.uninstall": Method<UninstallInput, EmptyResult>;
  readonly "hosts.export": Method<HostExportInput, ExportRef>;
  readonly "library.list": Method<LibraryQuery, LibraryPage>;
  readonly "library.rebuild": Method<Record<string, never>, RebuildResult>;
  readonly "reviews.list": Method<ReviewQuery, ReviewPage>;
  readonly "bundles.inspect": Method<BundleInspectInput, BundleInspection>;
  readonly "bundles.import": Method<BundleImportInput, BundleImportResult>;
  readonly "bundles.export": Method<BundleExportInput, BundleExportResult>;
  readonly "system.doctor": Method<DoctorInput, DoctorSnapshot>;
}>;

describe("engine method contracts", () => {
  it("keeps the complete method-name set exact", () => {
    expectTypeOf<EmptyResult>().toEqualTypeOf<null>();
    expectTypeOf<keyof EngineMethodMap>().toEqualTypeOf<ExpectedMethodName>();
    expectTypeOf<EngineMethodMap>().toEqualTypeOf<ExpectedEngineMethodMap>();
  });

  it("keeps mutation and query methods disjoint and exhaustive", () => {
    expectTypeOf<MutationMethodName>().toEqualTypeOf<ExpectedMutationMethodName>();
    expectTypeOf<QueryMethodName>().toEqualTypeOf<
      Exclude<ExpectedMethodName, ExpectedMutationMethodName>
    >();
    expectTypeOf<Extract<MutationMethodName, QueryMethodName>>().toEqualTypeOf<never>();
  });

  it("keeps runtime-owned methods out of the core client", () => {
    expectTypeOf<RuntimeOwnedMethodName>().toEqualTypeOf<ExpectedRuntimeOwnedMethodName>();
    expectTypeOf<CoreMethodName>().toEqualTypeOf<
      Exclude<ExpectedMethodName, ExpectedRuntimeOwnedMethodName>
    >();
  });

  it("keeps root administration separate from EngineMethodMap", () => {
    expectTypeOf<EngineAdministrationClient["backup"]>().toEqualTypeOf<
      (input: SystemBackupInput) => Promise<SystemBackupResult>
    >();
    expectTypeOf<EngineAdministrationClient["restore"]>().toEqualTypeOf<
      (input: SystemRestoreInput) => Promise<SystemRestoreResult>
    >();
    expectTypeOf<Extract<"backup" | "restore", keyof EngineMethodMap>>().toEqualTypeOf<never>();
  });

  it("uses branded facet paths across public claim and review values", () => {
    expectTypeOf<Claim["facet"]>().toEqualTypeOf<FacetPath>();
    expectTypeOf<ClaimDraft["facet"]>().toEqualTypeOf<FacetPath>();
    expectTypeOf<CorrectionDraft["facet"]>().toEqualTypeOf<FacetPath | undefined>();
    expectTypeOf<ProfileDiff["changedFacets"]>().toEqualTypeOf<readonly FacetPath[]>();
    expectTypeOf<
      Extract<ReviewReason, { readonly code: "coverage_decreased" }>["facets"]
    >().toEqualTypeOf<readonly FacetPath[]>();
  });
});

it("binds a floor budget to an unverified host version only", () => {
  const base = {
    host: "codex" as const,
    hostVersion: "codex-cli 9.9.9",
    environment: "cli" as const,
    releaseVersion: "0.1.0-preview.1",
    wireMajor: 3 as const,
    canonicalSkillDigest:
      "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9" as const,
  };
  const capabilities = {
    webResearch: "unknown",
    localFileRead: "available",
    vision: "unknown",
    documentTextExtraction: "unknown",
    imageOcr: "unknown",
    audioTranscription: "unknown",
    videoCaptions: "unknown",
    privateUiCapture: "unavailable",
    windowScopedCapture: "unknown",
    captureDataPolicy: "unknown",
    structuredToolCalls: true,
    lifecycleHooks: [],
    subruns: false,
    subrunsInheritMcp: false,
    opensLoopbackUrls: false,
  } as const;
  const floorCapacity = {
    maximumInputTokens: 12_438,
    maximumToolResultBytes: 49_752,
    source: "conservative_floor" as const,
  };
  const unverified = hostPreflightSchema.safeParse({
    ok: true,
    capabilities,
    capacity: floorCapacity,
    evidence: { kind: "unverified_host_version", ...base, floorSourceFixtureId: "fixture-v3" },
    warnings: ["No capacity fixture is recorded for codex codex-cli 9.9.9."],
  });
  expect(unverified.success).toBe(true);
  // A measured fixture may not report a floor budget, and vice versa.
  const mismatched = hostPreflightSchema.safeParse({
    ok: true,
    capabilities,
    capacity: floorCapacity,
    evidence: { kind: "binding_fixture", ...base, fixtureId: "fixture-v3" },
    warnings: [],
  });
  expect(mismatched.success).toBe(false);
});

describe("host and private capture value contracts", () => {
  it("keeps capability probes explicit", () => {
    expectTypeOf<CapabilityAvailability>().toEqualTypeOf<"available" | "unavailable" | "unknown">();
    expectTypeOf<keyof HostCapabilities>().toEqualTypeOf<
      | "webResearch"
      | "localFileRead"
      | "vision"
      | "documentTextExtraction"
      | "imageOcr"
      | "audioTranscription"
      | "videoCaptions"
      | "privateUiCapture"
      | "windowScopedCapture"
      | "captureDataPolicy"
      | "structuredToolCalls"
      | "lifecycleHooks"
      | "subruns"
      | "subrunsInheritMcp"
      | "opensLoopbackUrls"
      | "maxContextTokens"
      | "maxToolResultBytes"
    >();
    expectTypeOf<HostPreflight["capabilities"]>().toEqualTypeOf<HostCapabilities>();
    expectTypeOf<HostPreflightEvidence["kind"]>().toEqualTypeOf<
      "host_handshake" | "binding_fixture" | "unverified_host_version"
    >();
    expectTypeOf<HostPreflightEvidence["host"]>().toEqualTypeOf<HostName>();
    expectTypeOf<HostPreflightEvidence["environment"]>().toEqualTypeOf<HostEnvironment>();
    expectTypeOf<HostPreflightEvidence["canonicalSkillDigest"]>().toEqualTypeOf<ContentDigest>();

    type SuccessfulPreflight = Extract<HostPreflight, { readonly ok: true }>;
    type FailedPreflight = Extract<HostPreflight, { readonly ok: false }>;
    expectTypeOf<keyof SuccessfulPreflight>().toEqualTypeOf<
      "ok" | "capabilities" | "capacity" | "evidence" | "warnings"
    >();
    expectTypeOf<SuccessfulPreflight["capacity"]>().toEqualTypeOf<BriefCapacity>();
    expectTypeOf<SuccessfulPreflight["evidence"]>().toEqualTypeOf<HostPreflightEvidence>();
    expectTypeOf<keyof FailedPreflight>().toEqualTypeOf<
      "ok" | "capabilities" | "error" | "warnings"
    >();
    expectTypeOf<FailedPreflight["error"]["code"]>().toEqualTypeOf<"host_unsupported">();
    expectTypeOf<FailedPreflight["error"]["retryable"]>().toEqualTypeOf<false>();
  });

  it("keeps capture scope and authorization serializable", () => {
    expectTypeOf<PrivateUiCaptureRange["kind"]>().toEqualTypeOf<"time" | "visible_message_range">();
    expectTypeOf<PrivateUiCaptureScope["subject"]>().toEqualTypeOf<IngestSubjectTarget>();
    expectTypeOf<PrivateUiCaptureAuthorization["conversationLocator"]["kind"]>().toEqualTypeOf<
      "stable" | "subject_fallback"
    >();
    expectTypeOf<CapturedPrivateTranscript["materials"]>().toEqualTypeOf<
      readonly MaterialInput[]
    >();
  });

  it("keeps stop, refusal, and action outcomes closed", () => {
    expectTypeOf<PrivateUiCaptureGuardStopReason>().toEqualTypeOf<ExpectedCaptureGuardStopReason>();
    expectTypeOf<PrivateUiCaptureActionAbortReason>().toEqualTypeOf<
      ExpectedCaptureGuardStopReason | "coordinator_aborted"
    >();
    expectTypeOf<PrivateUiCaptureStopReason>().toEqualTypeOf<
      | ExpectedCaptureGuardStopReason
      | "coordinator_aborted"
      | "ingest_rejected"
      | "process_terminated"
    >();
    expectTypeOf<PrivateUiCaptureAuditStop>().toEqualTypeOf<
      "completed" | PrivateUiCaptureStopReason
    >();
    expectTypeOf<PrivateUiCaptureGrantStatus["kind"]>().toEqualTypeOf<"active" | "revoked">();
    expectTypeOf<PrivateUiCaptureRefusalReason>().toEqualTypeOf<ExpectedCaptureRefusalReason>();
    expectTypeOf<PrivateUiCaptureActionResult["kind"]>().toEqualTypeOf<
      "ingested" | "refused" | "aborted" | "failed"
    >();
    expectTypeOf<
      Extract<PrivateUiCaptureIngestResult, { readonly kind: "ingested" }>["job"]
    >().toEqualTypeOf<PendingJob>();
    expectTypeOf<
      Extract<PrivateUiCaptureIngestResult, { readonly kind: "unchanged" }>["job"]
    >().toEqualTypeOf<PendingJob | undefined>();
    expectTypeOf<
      Extract<PrivateUiCaptureActionResult, { readonly kind: "ingested" }>["result"]
    >().toEqualTypeOf<PrivateUiCaptureIngestResult>();
  });
});

describe("review value contracts", () => {
  it("keeps suspended and review projections nonempty", () => {
    expectTypeOf<Extract<CommitResult, { readonly kind: "suspended" }>["reasons"]>().toEqualTypeOf<
      readonly [ReviewReason, ...ReviewReason[]]
    >();
    expectTypeOf<ReviewItem["reasons"]>().toEqualTypeOf<
      readonly [ReviewReason, ...ReviewReason[]]
    >();
  });
});

const verifyClientCalls = (
  client: EngineClient,
  core: CoreEngineClient,
  create: CreateSubjectInput,
  query: SubjectQuery,
  context: MutationContext,
): void => {
  expectTypeOf(client.call("subjects.list", query)).toEqualTypeOf<
    Promise<EngineMethodMap["subjects.list"]["result"]>
  >();
  expectTypeOf(client.call("subjects.create", create, context)).toEqualTypeOf<
    Promise<EngineMethodMap["subjects.create"]["result"]>
  >();
  void core.call("subjects.list", query);
  void core.call("subjects.create", create, context);

  // @ts-expect-error -- mutation calls require an idempotency context.
  void client.call("subjects.create", create);
  // @ts-expect-error -- query calls cannot accept a mutation context.
  void client.call("subjects.list", query, context);
  // @ts-expect-error -- host methods are composed outside the engine core.
  void core.call("hosts.install", {});
};

void verifyClientCalls;
