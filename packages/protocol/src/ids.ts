/** Compile-time brand used to keep unrelated wire strings distinct. */
declare const brand: unique symbol;

/** Adds a nominal purpose to an otherwise structural value. */
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type SubjectId = Branded<`subject_${string}`, "SubjectId">;
export type SpaceId = Branded<`space_${string}`, "SpaceId">;
export type MaterialId = Branded<`mat_${string}`, "MaterialId">;
export type RawId = Branded<`raw_${string}`, "RawId">;
export type FactChecksum = Branded<`fact_sha256_${string}`, "FactChecksum">;
export type ContentDigest = Branded<`sha256_${string}`, "ContentDigest">;
export type ProvenanceDigest = Branded<`provenance_sha256_${string}`, "ProvenanceDigest">;
export type MaterialSetHash = Branded<`set_sha256_${string}`, "MaterialSetHash">;
export type VersionId = Branded<`version_${string}`, "VersionId">;
export type JobId = Branded<`job_${string}`, "JobId">;
export type LeaseId = Branded<`lease_${string}`, "LeaseId">;
export type LeaseOwnerId = Branded<`lease_owner_${string}`, "LeaseOwnerId">;
export type ClaimId = Branded<`claim_${string}`, "ClaimId">;
export type RelationId = Branded<`relation_${string}`, "RelationId">;
export type RequestId = Branded<`req_${string}`, "RequestId">;
export type EventId = Branded<`event_${string}`, "EventId">;
export type IsoDateTime = Branded<string, "IsoDateTime">;
export type HostName = Branded<string, "HostName">;
export type FacetPath = Branded<string, "FacetPath">;
export type SourceGroupKey = Branded<`sg_${string}`, "SourceGroupKey">;
export type CaptureAuditRef = Branded<`capture_${string}`, "CaptureAuditRef">;
export type CaptureScopeDigest = Branded<`capture_scope_${string}`, "CaptureScopeDigest">;
export type ConversationSourceKey = Branded<`conversation_${string}`, "ConversationSourceKey">;
export type BriefContractDigest = Branded<`brief_contract_${string}`, "BriefContractDigest">;
export type BriefMaterialRef = Branded<`m${string}`, "BriefMaterialRef">;

/** Reserved identity of the one built-in real-people space. */
export const BUILTIN_PEOPLE_SPACE_ID = "space_00000000000000000000000000000001" as SpaceId;

/** Built-in host names without weakening HostName to a closed provider union. */
export const BUILTIN_HOSTS = {
  codex: "codex" as HostName,
  claudeCode: "claude-code" as HostName,
  openclaw: "openclaw" as HostName,
  hermes: "hermes" as HostName,
  dsh: "dsh" as HostName,
} as const;
