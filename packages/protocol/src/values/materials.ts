import type {
  CaptureAuditRef,
  ContentDigest,
  ConversationSourceKey,
  IsoDateTime,
  MaterialId,
  MaterialSetHash,
  ProvenanceDigest,
  RawId,
  SourceGroupKey,
  SubjectId,
  VersionId,
} from "../ids.js";
import type { FactEnvelope } from "./facts.js";
import type { PendingJob } from "./jobs.js";
import type { CreateSubjectInput, SubjectRef, SubjectSummary } from "./subjects.js";

export type IngestSubjectTarget =
  | { readonly kind: "existing"; readonly subjectId: SubjectId }
  | { readonly kind: "create"; readonly input: CreateSubjectInput };

export type SourceMedium =
  | "article"
  | "webpage"
  | "post"
  | "video"
  | "audio"
  | "image"
  | "document"
  | "conversation"
  | "other";

export type SourceRole =
  | "first_party_expression"
  | "interview"
  | "editorial_reporting"
  | "reference"
  | "personal_communication";

export type SourceAccess = "public" | "restricted" | "private";

export type ArtifactLocator =
  | {
      readonly provider: string;
      readonly externalId: string;
      readonly canonicalUri?: string;
    }
  | {
      readonly provider: string;
      readonly externalId?: string;
      readonly canonicalUri: string;
    };

export type HostExtractionMethod =
  | "document_text"
  | "ocr"
  | "embedded_caption"
  | "automatic_caption"
  | "transcription"
  | "computer_use_transcript";

export type TextDerivationInput =
  | { readonly kind: "native_text" }
  | {
      readonly kind: "host_extract";
      readonly method: HostExtractionMethod;
      readonly producer: string;
      readonly producerVersion?: string;
      readonly language?: string;
    };

/** Traceable source metadata accepted at the ingest boundary. */
export interface MaterialSourceInput {
  readonly uri?: string;
  readonly title?: string;
  readonly medium: SourceMedium;
  readonly access: SourceAccess;
  readonly role?: SourceRole;
  readonly artifact?: ArtifactLocator;
  readonly representationOf?: ArtifactLocator;
  readonly capturedAt: IsoDateTime;
  readonly occurredAt?: IsoDateTime;
  readonly publishedAt?: IsoDateTime;
  readonly language?: string;
  readonly authors?: readonly string[];
}

/** Normalized text material submitted by a trusted caller or model tool. */
export interface MaterialInput {
  readonly clientRef: string;
  readonly kind: "web" | "document" | "message" | "email" | "transcript" | "derived_text";
  readonly content: string;
  readonly source: MaterialSourceInput;
  readonly derivation: TextDerivationInput;
  readonly participants?: readonly string[];
  readonly sensitivity?: "private" | "shareable";
  readonly flags?: readonly "suspicious_source"[];
}

/** Per-item outcome from a text-material ingest. */
export interface IngestItemResult {
  readonly clientRef: string;
  readonly kind: "accepted" | "duplicate";
  readonly materialId: MaterialId;
  readonly contentDigest: ContentDigest;
}

export type IngestResult =
  | {
      readonly kind: "ingested";
      readonly subject: SubjectSummary;
      readonly created: boolean;
      readonly items: readonly IngestItemResult[];
      readonly materialSetHash: MaterialSetHash;
      readonly generation: number;
      readonly job?: PendingJob;
    }
  | {
      readonly kind: "unchanged";
      readonly subject: SubjectSummary;
      readonly items: readonly IngestItemResult[];
      readonly materialSetHash: MaterialSetHash;
      readonly generation: number;
      readonly job?: PendingJob;
    };

/** Engine input for atomic create-or-existing material ingest. */
export interface IngestInput {
  readonly subject: IngestSubjectTarget;
  readonly materials: readonly MaterialInput[];
  readonly enqueue: "auto" | "now";
}

/** Engine input for raw file storage and parser dispatch. */
export interface IngestFilesInput {
  readonly subject: IngestSubjectTarget;
  readonly paths: readonly string[];
  readonly enqueue: "auto" | "now";
  readonly sensitivity?: "private" | "shareable";
}

export type FileIngestItemResult =
  | {
      readonly kind: "parsed";
      readonly pathLabel: string;
      readonly material: IngestItemResult;
      /**
       * Parser observations about a file that was accepted, such as skipped attachments, an
       * ambiguous separator, or a split into parts. A parsed file is not the same as a file
       * parsed completely, and these were previously computed and dropped.
       */
      readonly warnings: readonly string[];
    }
  | {
      readonly kind: "unparsed";
      readonly pathLabel: string;
      readonly rawId: RawId;
      readonly mediaType: string;
      readonly warnings: readonly string[];
    };

/** Aggregate result from an engine-owned file ingest transaction. */
export interface IngestFilesResult {
  readonly subject: SubjectSummary;
  readonly created: boolean;
  readonly items: readonly FileIngestItemResult[];
  readonly generation: number;
  readonly materialSetHash?: MaterialSetHash;
  readonly job?: PendingJob;
}

/** Stored source metadata with normalized required authors. */
export interface MaterialSource extends MaterialSourceInput {
  readonly authors: readonly string[];
}

export type ParserExtractionMethod = Exclude<HostExtractionMethod, "computer_use_transcript">;

export type TextDerivation =
  | { readonly kind: "native_text" }
  | {
      readonly kind: "host_extract";
      readonly method: HostExtractionMethod;
      readonly producer: string;
      readonly producerVersion?: string;
      readonly language?: string;
    }
  | {
      readonly kind: "raw_extract";
      readonly rawId: RawId;
      readonly method: ParserExtractionMethod;
      readonly producer: string;
      readonly producerVersion?: string;
      readonly language?: string;
    };

export type CorrectionProvenance =
  | { readonly kind: "direct_user" }
  | {
      readonly kind: "relayed";
      readonly actorKind: "host" | "sdk" | "executor" | "system";
      readonly actorId: string;
    };

/** Immutable material fact returned by material read methods. */
export interface MaterialRecord extends FactEnvelope<1> {
  readonly id: MaterialId;
  readonly subjectId: SubjectId;
  readonly kind: MaterialInput["kind"] | "correction";
  readonly contentDigest: ContentDigest;
  readonly provenanceDigest: ProvenanceDigest;
  readonly sourceIdentity: string;
  readonly source: MaterialSource;
  readonly derivation: TextDerivation;
  readonly participants: readonly string[];
  readonly sensitivity: "private" | "shareable";
  readonly correctionProvenance?: CorrectionProvenance;
  readonly captureAuditRef?: CaptureAuditRef;
  readonly conversationSourceKey?: ConversationSourceKey;
  readonly flags: readonly "suspicious_source"[];
  readonly storedAt: IsoDateTime;
}

export type SourceGroupBasis =
  | "same_raw"
  | "same_private_conversation"
  | "representation_of"
  | "provider_artifact"
  | "canonical_uri"
  | "exact_republication"
  | "unknown";

export type SourceDiversityStatus = "eligible" | "ineligible" | "unknown";

export type SourceGroupCaution =
  | "access_conflict"
  | "private_source"
  | "restricted_source"
  | "correction"
  | "insufficient_public_proof";

/** Engine-derived grouping and diversity classification for one material. */
export interface SourceGroup {
  readonly key: SourceGroupKey;
  readonly bases: readonly SourceGroupBasis[];
  readonly diversityStatus: SourceDiversityStatus;
  readonly cautions: readonly SourceGroupCaution[];
}

/** Versioned source-group derivation over one material set. */
export interface SourceGroupingSnapshot {
  readonly sourceGroupingVersion: string;
  readonly groups: ReadonlyMap<MaterialId, SourceGroup>;
}

/** Material list filters scoped to one subject or historical version. */
export interface MaterialQuery extends SubjectRef {
  readonly kind?: MaterialRecord["kind"];
  readonly atVersionId?: VersionId;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Algorithm and generation context used to derive a source group. */
export interface SourceGroupingContext {
  readonly algorithmVersion: string;
  readonly generation: number;
  readonly versionId?: VersionId;
}

/** Material list read model without full content. */
export interface MaterialSummary {
  readonly record: MaterialRecord;
  readonly contentScalarCount: number;
  readonly rawAvailable: boolean;
  readonly inCurrentGeneration: boolean;
  readonly sourceGroup: SourceGroup;
  readonly grouping: SourceGroupingContext;
}

/** Cursor page of material summaries. */
export interface MaterialPage {
  readonly items: readonly MaterialSummary[];
  readonly nextCursor?: string;
}

/** Exact material lookup within a subject and optional historical version. */
export interface GetMaterialInput {
  readonly subjectId: SubjectId;
  readonly materialId: MaterialId;
  readonly atVersionId?: VersionId;
}

/** Full material content and engine-derived grouping read model. */
export interface MaterialView {
  readonly record: MaterialRecord;
  readonly content: string;
  readonly rawAvailable: boolean;
  readonly inCurrentGeneration: boolean;
  readonly sourceGroup: SourceGroup;
  readonly grouping: SourceGroupingContext;
}
