import type {
  ArtifactLocator,
  CaptureAuditRef,
  ConversationSourceKey,
  IsoDateTime,
  MaterialInput,
  MaterialRecord,
  MaterialSource,
  RawId,
  RequestId,
  SubjectId,
  TextDerivation,
} from "@distilly/protocol";
import { FACT_LIMITS, WIRE_LIMITS, materialInputSchema } from "@distilly/protocol";

import { digestContent, digestProvenance, deriveMaterialId } from "../facts/digests.js";
import { sealFact } from "../facts/checksum.js";
import { invalidInput } from "../internal-errors.js";
import { canonicalizeHttpUrl } from "../subject/identity.js";
import { enforceCanonicalUtf8Limit } from "../utf8-boundary.js";

const PROVIDER_GRAMMAR = /^[a-z][a-z0-9._-]*$/;

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const normalizedString = (value: string, fieldPath: string): string => {
  const normalized = value.normalize("NFC");
  if (normalized.length === 0)
    throw invalidInput("A normalized string cannot be empty.", fieldPath);
  if (normalized.includes("\0")) {
    throw invalidInput("Material provenance cannot contain U+0000.", fieldPath);
  }
  return enforceCanonicalUtf8Limit(normalized, WIRE_LIMITS.labelBytes, fieldPath);
};

const normalizeStringSet = (
  values: readonly string[] | undefined,
  fieldPath: string,
): readonly string[] => {
  const normalized = new Set((values ?? []).map((value) => normalizedString(value, fieldPath)));
  return [...normalized].sort(compareUtf8);
};

const normalizeProvider = (value: string, fieldPath: string): string => {
  const normalized = normalizedString(value, fieldPath).toLowerCase();
  if (!PROVIDER_GRAMMAR.test(normalized)) {
    throw invalidInput("Artifact providers must be lowercase ASCII identifiers.", fieldPath);
  }
  return normalized;
};

const normalizeArtifact = (
  locator: ArtifactLocator | undefined,
  fieldPath: string,
): ArtifactLocator | undefined => {
  if (locator === undefined) return undefined;
  const provider = normalizeProvider(locator.provider, `${fieldPath}.provider`);
  const externalId =
    locator.externalId === undefined
      ? undefined
      : normalizedString(locator.externalId, `${fieldPath}.externalId`);
  const canonicalUri =
    locator.canonicalUri === undefined
      ? undefined
      : canonicalizeHttpUrl(locator.canonicalUri, `${fieldPath}.canonicalUri`);
  if (externalId === undefined && canonicalUri === undefined) {
    throw invalidInput("An artifact locator requires an external id or canonical URI.", fieldPath);
  }
  return {
    provider,
    ...(externalId === undefined ? {} : { externalId }),
    ...(canonicalUri === undefined ? {} : { canonicalUri }),
  } as ArtifactLocator;
};

/**
 * Applies the frozen material-text-v1 byte normalization.
 *
 * @param value - Raw material body.
 * @param maximumBytes - Canonical UTF-8 byte ceiling for this field.
 * @param fieldPath - Public field path used in typed validation errors.
 * @returns The canonical material body.
 */
const normalizeTextV1 = (value: string, maximumBytes: number, fieldPath: string): string => {
  const normalized = canonicalizeMaterialText(value);
  if (!/[^\p{White_Space}]/u.test(normalized)) {
    throw invalidInput("Canonical text cannot be whitespace-only.", fieldPath);
  }
  return enforceCanonicalUtf8Limit(normalized, maximumBytes, fieldPath);
};

/**
 * Applies the frozen material-text-v1 canonicalization without any size or content check.
 *
 * The trailing-whitespace rule is implemented as a single forward scan rather than a
 * back-tracking regular expression: `/[ \t]+(?=\n|$)/` retries the whole run at every
 * position of a long run, which made a file with a megabyte of spaces take minutes. Splitting
 * a large parsed text needs exactly this canonical form (so a part is stored unchanged), and
 * it must be linear for the same reason.
 *
 * @param value - Raw material text.
 * @returns Canonical text: CRLF and CR to LF, NFC, and no spaces or tabs before a line end.
 */
export const canonicalizeMaterialText = (value: string): string => {
  const lineEnded = value.includes("\r") ? value.replace(/\r\n?/g, "\n") : value;
  const composed = lineEnded.normalize("NFC");
  return stripTrailingHorizontalWhitespace(composed);
};

/**
 * Removes spaces and tabs that sit immediately before a newline or the end of the text.
 *
 * @param text - Text already converted to LF line endings and NFC.
 * @returns Text without trailing horizontal whitespace.
 */
const stripTrailingHorizontalWhitespace = (text: string): string => {
  const pieces: string[] = [];
  let copyFrom = 0;
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code !== 0x20 && code !== 0x09) {
      index += 1;
      continue;
    }
    let runEnd = index;
    while (runEnd < text.length) {
      const runCode = text.charCodeAt(runEnd);
      if (runCode !== 0x20 && runCode !== 0x09) break;
      runEnd += 1;
    }
    const next = runEnd < text.length ? text.charCodeAt(runEnd) : -1;
    if (next === 0x0a || next === -1) {
      pieces.push(text.slice(copyFrom, index));
      copyFrom = runEnd;
    }
    index = runEnd;
  }
  return pieces.length === 0 ? text : `${pieces.join("")}${text.slice(copyFrom)}`;
};

/**
 * Applies the frozen material-text-v1 byte normalization to ordinary material content.
 * @param value - Raw ordinary material body.
 * @returns Canonical ordinary material body.
 */
export const normalizeMaterialTextV1 = (value: string): string =>
  normalizeTextV1(value, WIRE_LIMITS.materialContentBytes, "materials.content");

/**
 * Applies material-text-v1 while retaining the narrower correction wire bound and field path.
 * @param value - Raw correction body.
 * @returns Canonical correction body.
 */
export const normalizeCorrectionTextV1 = (value: string): string =>
  normalizeTextV1(value, WIRE_LIMITS.correctionTextBytes, "correction.text");

const normalizeDerivation = (input: MaterialInput["derivation"]): TextDerivation => {
  if (input.kind === "native_text") return { kind: "native_text" };
  return {
    kind: "host_extract",
    method: input.method,
    producer: normalizedString(input.producer, "derivation.producer"),
    ...(input.producerVersion === undefined
      ? {}
      : {
          producerVersion: normalizedString(input.producerVersion, "derivation.producerVersion"),
        }),
    ...(input.language === undefined
      ? {}
      : { language: normalizedString(input.language, "derivation.language") }),
  };
};

/** Parser extraction metadata accepted only through the trusted file-loader seam. */
interface TrustedParserExtraction {
  readonly method: Extract<TextDerivation, { readonly kind: "raw_extract" }>["method"];
  readonly producer: string;
  readonly producerVersion?: string;
  readonly language?: string;
}

/** Parser draft that has not yet been bound to an engine-owned RawId. */
export interface TrustedParsedMaterialDraft extends Omit<MaterialInput, "derivation"> {
  readonly extraction: TrustedParserExtraction;
}

/**
 * Re-validates a parser draft through the public MaterialInput boundary, then replaces its
 * temporary host extraction with the engine-owned raw derivation root.
 *
 * @param rawId - Engine-owned identity of the successfully persisted raw bytes.
 * @param draft - Trusted parser output that still requires material validation.
 * @returns Canonical material fields rooted in the raw identity.
 */
export const bindParsedMaterial = (
  rawId: RawId,
  draft: TrustedParsedMaterialDraft,
): NormalizedMaterial => {
  const { extraction, ...material } = draft;
  const parsed = normalizeMaterial(
    materialInputSchema.parse({
      ...material,
      derivation: { kind: "host_extract", ...extraction },
    }) as MaterialInput,
  );
  return {
    ...parsed,
    derivation: { kind: "raw_extract", rawId, ...extraction },
  };
};

const normalizeSource = (input: MaterialInput["source"]): MaterialSource => ({
  ...(input.uri === undefined ? {} : { uri: canonicalizeHttpUrl(input.uri, "source.uri") }),
  ...(input.title === undefined ? {} : { title: normalizedString(input.title, "source.title") }),
  medium: input.medium,
  access: input.access,
  ...(input.role === undefined ? {} : { role: input.role }),
  ...(input.artifact === undefined
    ? {}
    : { artifact: normalizeArtifact(input.artifact, "source.artifact")! }),
  ...(input.representationOf === undefined
    ? {}
    : {
        representationOf: normalizeArtifact(input.representationOf, "source.representationOf")!,
      }),
  capturedAt: input.capturedAt,
  ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
  ...(input.publishedAt === undefined ? {} : { publishedAt: input.publishedAt }),
  ...(input.language === undefined
    ? {}
    : { language: normalizedString(input.language, "source.language") }),
  authors: normalizeStringSet(input.authors, "source.authors"),
});

/** Complete normalized material before engine-owned ids and timestamps are attached. */
export interface NormalizedMaterial extends Omit<
  MaterialInput,
  "content" | "source" | "derivation" | "participants" | "sensitivity" | "flags"
> {
  readonly content: string;
  readonly source: MaterialSource;
  readonly derivation: TextDerivation;
  readonly participants: readonly string[];
  readonly sensitivity: "private" | "shareable";
  readonly flags: readonly "suspicious_source"[];
}

/**
 * Normalizes one already schema-valid public material input.
 *
 * @param input - Boundary-validated material input.
 * @returns The canonical material fields used for identity derivation.
 */
export const normalizeMaterial = (input: MaterialInput): NormalizedMaterial => ({
  clientRef: normalizedString(input.clientRef, "clientRef"),
  kind: input.kind,
  content: normalizeMaterialTextV1(input.content),
  source: normalizeSource(input.source),
  derivation: normalizeDerivation(input.derivation),
  participants: normalizeStringSet(input.participants, "participants"),
  sensitivity: input.sensitivity ?? "private",
  flags: [...new Set(input.flags ?? [])].sort(compareUtf8),
});

/**
 * Derives the first available namespaced source identity for MaterialId.
 *
 * @param input - Canonical material provenance.
 * @param requestId - Stable mutation id used only by the fallback namespace.
 * @returns The namespaced material source identity.
 */
export const deriveSourceIdentity = (input: NormalizedMaterial, requestId: RequestId): string => {
  const safe = (value: string, fieldPath: string): string => {
    if (value.includes("\0")) {
      throw invalidInput("Source identity components cannot contain U+0000.", fieldPath);
    }
    return value;
  };
  let sourceIdentity: string;
  if (input.source.uri !== undefined) {
    sourceIdentity = `source-uri-v1\0${safe(input.source.uri, "source.uri")}`;
  } else if (input.source.artifact?.externalId !== undefined) {
    sourceIdentity = `artifact-external-v1\0${safe(
      input.source.artifact.provider,
      "source.artifact.provider",
    )}\0${safe(input.source.artifact.externalId, "source.artifact.externalId")}`;
  } else if (input.source.artifact?.canonicalUri !== undefined) {
    sourceIdentity = `artifact-uri-v1\0${safe(
      input.source.artifact.canonicalUri,
      "source.artifact.canonicalUri",
    )}`;
  } else {
    sourceIdentity = `client-ref-v1\0${safe(requestId, "requestId")}\0${safe(
      input.kind,
      "kind",
    )}\0${safe(input.clientRef, "clientRef")}`;
  }
  return enforceCanonicalUtf8Limit(
    sourceIdentity,
    FACT_LIMITS.sourceIdentityBytes,
    "sourceIdentity",
  );
};

/** Sealed material record paired with its normalized immutable body. */
export interface PreparedMaterial {
  readonly record: MaterialRecord;
  readonly content: string;
  readonly clientRef: string;
}

/** Trusted capture stamps unavailable at the public material boundary. */
export type EngineOwnedMaterialProvenance =
  | {
      readonly captureAuditRef?: never;
      readonly conversationSourceKey?: never;
    }
  | {
      readonly captureAuditRef: CaptureAuditRef;
      readonly conversationSourceKey: ConversationSourceKey;
    };

/**
 * Computes every deterministic material identity and seals its immutable record.
 *
 * @param input - Canonical material fields.
 * @param subjectId - Engine-owned subject identity.
 * @param requestId - Stable mutation identity used by fallback sources.
 * @param storedAt - Trusted storage timestamp.
 * @param engineOwned - Optional trusted capture stamps.
 * @returns The immutable record, body, and caller correlation ref.
 */
export const prepareMaterial = (
  input: NormalizedMaterial,
  subjectId: SubjectId,
  requestId: RequestId,
  storedAt: IsoDateTime,
  engineOwned: EngineOwnedMaterialProvenance = {},
): PreparedMaterial => {
  if (
    (engineOwned.captureAuditRef === undefined) !==
    (engineOwned.conversationSourceKey === undefined)
  ) {
    throw invalidInput("Private capture provenance requires both trusted stamps.");
  }
  const contentDigest = digestContent(input.content);
  const provenanceDigest = digestProvenance({ ...input, ...engineOwned });
  const sourceIdentity = deriveSourceIdentity(input, requestId);
  const id = deriveMaterialId(sourceIdentity, provenanceDigest, contentDigest);
  const record = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id,
    subjectId,
    kind: input.kind,
    contentDigest,
    provenanceDigest,
    sourceIdentity,
    source: input.source,
    derivation: input.derivation,
    participants: input.participants,
    sensitivity: input.sensitivity,
    ...(engineOwned.captureAuditRef === undefined
      ? {}
      : { captureAuditRef: engineOwned.captureAuditRef }),
    ...(engineOwned.conversationSourceKey === undefined
      ? {}
      : { conversationSourceKey: engineOwned.conversationSourceKey }),
    flags: input.flags,
    storedAt,
  });
  return { record, content: input.content, clientRef: input.clientRef };
};
