import {
  BUILTIN_HOSTS,
  contentDigestSchema,
  isoDateTimeSchema,
  type ContentDigest,
  type HostCapabilities,
  type HostEnvironment,
  type HostName,
  type HostPreflight,
} from "@distilly/protocol";
import { advertisedToolContractDigest, type McpSchemaProfile } from "@distilly/mcp/internal/schema";

import codexCapacityEvidence from "./evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v2.json" with { type: "json" };
import hermesCapacityEvidence from "./evidence/host-capacity/hermes-agent-v0.9.0-cli-distilly-0.1.0-preview.1-v3.json" with { type: "json" };
import openClawCapacityEvidence from "./evidence/host-capacity/openclaw-2026.3.24-cli-distilly-0.1.0-preview.1-v3.json" with { type: "json" };

interface PreviewReleaseTuple {
  readonly releaseVersion: string;
  readonly canonicalSkillDigest: ContentDigest;
}

/**
 * Conservative bytes-per-token divisor used to derive a token budget from a measured
 * byte budget. It must match the probe generator so a record cannot claim a token
 * limit that its own byte measurement does not support.
 */
const BYTES_PER_TOKEN = 4;

interface PreviewCapacityFixture {
  readonly schemaVersion: 2;
  readonly fixtureId: string;
  readonly host: HostName;
  readonly hostVersion: string;
  readonly environment: HostEnvironment;
  readonly releaseVersion: string;
  readonly wireMajor: 3;
  readonly canonicalSkillDigest: ContentDigest;
  readonly toolContractDigest: ContentDigest;
  /** Digest of the host-advertised schema projection, when one is used. */
  readonly schemaProfile?: McpSchemaProfile;
  readonly advertisedToolContractDigest?: ContentDigest;
  readonly probeContractDigest?: ContentDigest;
  readonly serializer: "structured-content-plus-json-text-v1";
  readonly capacity: {
    /** Declares that the numbers below are a verified lower bound, not a measured maximum. */
    readonly boundKind: "verified_lower_bound";
    /** Bytes the probe payload actually carried, as recorded by a real host session. */
    readonly verifiedBriefingBytes: number;
    /** Token budget derived from those bytes; never a copy of the byte count. */
    readonly estimatedInputTokens: number;
    readonly maximumToolResultBytes: number;
    readonly estimatedToolResultTokens: number;
  };
  readonly observed: {
    readonly briefingBytes: number;
    readonly toolResultBytes: number;
    readonly structuredTextDeepEqual: true;
    readonly modelObservedBothTailMarkers: true;
    readonly normalizedTranscriptDigest: ContentDigest;
  };
  readonly verifiedAt: string;
}

const PREVIEW_CAPABILITIES = Object.freeze({
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
} as const satisfies HostCapabilities);

const PREVIEW_RELEASE = "0.1.0-preview.1";
const PREVIEW_SKILL_DIGEST =
  "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9" as ContentDigest;
const TOOL_CONTRACT_DIGEST =
  "sha256_a5ef4303fa29360416008448f12dd4b01f325143633e7fa2298c2094f73a6eda" as ContentDigest;
const PROBE_CONTRACT_DIGEST =
  "sha256_c7e2ae4afcdedd3d59e9ffd50ffca8c4d8c6449f82977fc167f171204497bd77" as ContentDigest;

interface PreviewFixtureIdentity {
  readonly fixtureId: string;
  readonly hostVersion: string;
  readonly verifiedBriefingBytes: number;
  readonly estimatedInputTokens: number;
  readonly maximumToolResultBytes: number;
  readonly estimatedToolResultTokens: number;
  readonly normalizedTranscriptDigest: ContentDigest;
}

/**
 * The preview ships only these exact, independently verified host builds.
 * Keep this registry literal: deriving it from the evidence file would let a
 * modified evidence record redefine the host/version tuple it is meant to
 * authenticate.
 *
 * @param host - Host identifier to resolve.
 * @returns The immutable fixture identity, when this host has a fixture.
 */
const expectedFixtureIdentityForHost = (host: unknown): PreviewFixtureIdentity | undefined => {
  switch (host) {
    case BUILTIN_HOSTS.codex:
      return {
        fixtureId: `codex-cli-0.146.0-cli-distilly-${PREVIEW_RELEASE}-v2`,
        hostVersion: "codex-cli 0.146.0",
        verifiedBriefingBytes: 65_536,
        estimatedInputTokens: 16_384,
        maximumToolResultBytes: 65_536,
        estimatedToolResultTokens: 16_384,
        normalizedTranscriptDigest:
          "sha256_0affeceaaaec7d0475f74f7ae94854fc66faf201e25e940164bd16c65ad42dbc" as ContentDigest,
      };
    case BUILTIN_HOSTS.openclaw:
      return {
        fixtureId: `openclaw-2026.3.24-cli-distilly-${PREVIEW_RELEASE}-v3`,
        hostVersion: "OpenClaw 2026.3.24 (af6f32f)",
        verifiedBriefingBytes: 65_536,
        estimatedInputTokens: 16_384,
        maximumToolResultBytes: 65_536,
        estimatedToolResultTokens: 16_384,
        normalizedTranscriptDigest:
          "sha256_1df1f1c1835c5992400f4b044c59351f3fa71b72754eb7d239d1bbad3440f37b" as ContentDigest,
      };
    case BUILTIN_HOSTS.hermes:
      return {
        fixtureId: `hermes-agent-v0.9.0-cli-distilly-${PREVIEW_RELEASE}-v3`,
        hostVersion: "Hermes Agent v0.9.0 (2026.4.13)",
        verifiedBriefingBytes: 49_752,
        estimatedInputTokens: 12_438,
        maximumToolResultBytes: 49_752,
        estimatedToolResultTokens: 12_438,
        normalizedTranscriptDigest:
          "sha256_f0824c66221b2ad522de74c393d661bff98ba2324480985d0ec1974fef60fec5" as ContentDigest,
      };
    default:
      return undefined;
  }
};

const schemaProfileForHost = (host: unknown): McpSchemaProfile | undefined => {
  if (host === BUILTIN_HOSTS.openclaw) return "openclaw";
  if (host === BUILTIN_HOSTS.hermes) return "hermes";
  return undefined;
};

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
};

/**
 * Validates one checked-in host-capacity evidence record without trusting its
 * claimed host, version, capacity, or transcript digest.
 *
 * This remains an internal seam for fixture tests; the public CLI surface only
 * exposes the resulting HostPreflight through its binding composition.
 *
 * @param value - Unknown JSON value to validate.
 * @returns The validated immutable fixture projection.
 */
export const parsePreviewHostCapacityEvidence = (value: unknown): PreviewCapacityFixture => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The host capacity evidence record is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(record, [
      "schemaVersion",
      "fixtureId",
      "host",
      "hostVersion",
      "environment",
      "releaseVersion",
      "wireMajor",
      "canonicalSkillDigest",
      "toolContractDigest",
      "schemaProfile",
      "advertisedToolContractDigest",
      "probeContractDigest",
      "serializer",
      "capacity",
      "observed",
      "verifiedAt",
    ])
  ) {
    throw new TypeError("The host capacity evidence record contains unsupported fields.");
  }
  const capacity =
    record.capacity !== null &&
    typeof record.capacity === "object" &&
    !Array.isArray(record.capacity)
      ? (record.capacity as Record<string, unknown>)
      : undefined;
  const observed =
    record.observed !== null &&
    typeof record.observed === "object" &&
    !Array.isArray(record.observed)
      ? (record.observed as Record<string, unknown>)
      : undefined;
  if (
    (capacity !== undefined &&
      !hasOnlyKeys(capacity, [
        "boundKind",
        "verifiedBriefingBytes",
        "estimatedInputTokens",
        "maximumToolResultBytes",
        "estimatedToolResultTokens",
      ])) ||
    (observed !== undefined &&
      !hasOnlyKeys(observed, [
        "briefingBytes",
        "toolResultBytes",
        "structuredTextDeepEqual",
        "modelObservedBothTailMarkers",
        "normalizedTranscriptDigest",
      ]))
  ) {
    throw new TypeError("The host capacity evidence record contains unsupported fields.");
  }
  const host = record.host;
  const schemaProfile = schemaProfileForHost(host);
  const expectedIdentity = expectedFixtureIdentityForHost(host);
  const fixtureIdentityMatches =
    expectedIdentity !== undefined &&
    record.fixtureId === expectedIdentity.fixtureId &&
    record.hostVersion === expectedIdentity.hostVersion;
  const canonicalSkillDigest = contentDigestSchema.safeParse(record.canonicalSkillDigest);
  const toolContractDigest = contentDigestSchema.safeParse(record.toolContractDigest);
  const projectedDigest = contentDigestSchema.safeParse(record.advertisedToolContractDigest);
  const probeDigest = contentDigestSchema.safeParse(record.probeContractDigest);
  const transcriptDigest = contentDigestSchema.safeParse(observed?.normalizedTranscriptDigest);
  const capacityMatches =
    expectedIdentity !== undefined &&
    capacity !== undefined &&
    capacity.boundKind === "verified_lower_bound" &&
    capacity.verifiedBriefingBytes === expectedIdentity.verifiedBriefingBytes &&
    capacity.estimatedInputTokens === expectedIdentity.estimatedInputTokens &&
    capacity.maximumToolResultBytes === expectedIdentity.maximumToolResultBytes &&
    capacity.estimatedToolResultTokens === expectedIdentity.estimatedToolResultTokens;
  // A token budget must be derived from the measured bytes, never copied from them: the
  // original record did exactly that and overstated every host's budget by this factor.
  const tokensAreDerived =
    capacity !== undefined &&
    isPositiveSafeInteger(capacity.verifiedBriefingBytes) &&
    capacity.estimatedInputTokens ===
      Math.max(1, Math.floor(capacity.verifiedBriefingBytes / BYTES_PER_TOKEN)) &&
    isPositiveSafeInteger(capacity.maximumToolResultBytes) &&
    capacity.estimatedToolResultTokens ===
      Math.max(1, Math.floor(capacity.maximumToolResultBytes / BYTES_PER_TOKEN));
  const transcriptMatches =
    expectedIdentity !== undefined &&
    transcriptDigest.success &&
    transcriptDigest.data === expectedIdentity.normalizedTranscriptDigest;
  const projectionMatches =
    schemaProfile === undefined
      ? record.schemaProfile === undefined &&
        record.advertisedToolContractDigest === undefined &&
        record.probeContractDigest === undefined
      : record.schemaProfile === schemaProfile &&
        projectedDigest.success &&
        projectedDigest.data === advertisedToolContractDigest(schemaProfile) &&
        probeDigest.success &&
        probeDigest.data === PROBE_CONTRACT_DIGEST;
  if (
    record.schemaVersion !== 2 ||
    typeof record.fixtureId !== "string" ||
    !fixtureIdentityMatches ||
    ![
      BUILTIN_HOSTS.codex,
      BUILTIN_HOSTS.claudeCode,
      BUILTIN_HOSTS.openclaw,
      BUILTIN_HOSTS.hermes,
    ].includes(host as HostName) ||
    typeof record.hostVersion !== "string" ||
    record.environment !== "cli" ||
    record.releaseVersion !== PREVIEW_RELEASE ||
    record.wireMajor !== 3 ||
    !canonicalSkillDigest.success ||
    canonicalSkillDigest.data !== PREVIEW_SKILL_DIGEST ||
    !toolContractDigest.success ||
    toolContractDigest.data !== TOOL_CONTRACT_DIGEST ||
    !projectionMatches ||
    record.serializer !== "structured-content-plus-json-text-v1" ||
    capacity === undefined ||
    !isPositiveSafeInteger(capacity.verifiedBriefingBytes) ||
    !isPositiveSafeInteger(capacity.estimatedInputTokens) ||
    !isPositiveSafeInteger(capacity.maximumToolResultBytes) ||
    !isPositiveSafeInteger(capacity.estimatedToolResultTokens) ||
    !tokensAreDerived ||
    !capacityMatches ||
    observed === undefined ||
    observed.briefingBytes !== capacity.verifiedBriefingBytes ||
    observed.toolResultBytes !== capacity.maximumToolResultBytes ||
    observed.structuredTextDeepEqual !== true ||
    observed.modelObservedBothTailMarkers !== true ||
    !transcriptDigest.success ||
    !transcriptMatches ||
    !isoDateTimeSchema.safeParse(record.verifiedAt).success
  ) {
    throw new TypeError("The host capacity evidence record is invalid.");
  }
  return {
    schemaVersion: 2,
    fixtureId: record.fixtureId,
    host: host as HostName,
    hostVersion: record.hostVersion,
    environment: "cli",
    releaseVersion: PREVIEW_RELEASE,
    wireMajor: 3,
    canonicalSkillDigest: canonicalSkillDigest.data,
    toolContractDigest: toolContractDigest.data,
    ...(schemaProfile === undefined ? {} : { schemaProfile }),
    ...(schemaProfile === undefined || !projectedDigest.success
      ? {}
      : { advertisedToolContractDigest: projectedDigest.data }),
    ...(schemaProfile === undefined || !probeDigest.success
      ? {}
      : { probeContractDigest: probeDigest.data }),
    serializer: "structured-content-plus-json-text-v1",
    capacity: {
      boundKind: "verified_lower_bound",
      verifiedBriefingBytes: capacity.verifiedBriefingBytes,
      estimatedInputTokens: capacity.estimatedInputTokens,
      maximumToolResultBytes: capacity.maximumToolResultBytes,
      estimatedToolResultTokens: capacity.estimatedToolResultTokens,
    },
    observed: {
      briefingBytes: observed.briefingBytes,
      toolResultBytes: observed.toolResultBytes,
      structuredTextDeepEqual: true,
      modelObservedBothTailMarkers: true,
      normalizedTranscriptDigest: transcriptDigest.data,
    },
    verifiedAt: record.verifiedAt as string,
  };
};

const FIXTURES: readonly PreviewCapacityFixture[] = Object.freeze([
  Object.freeze(parsePreviewHostCapacityEvidence(codexCapacityEvidence)),
  Object.freeze(parsePreviewHostCapacityEvidence(openClawCapacityEvidence)),
  Object.freeze(parsePreviewHostCapacityEvidence(hermesCapacityEvidence)),
]);

/**
 * Loads one immutable exact-version net-capacity fixture.
 *
 * @param host - Host selected by the owned plugin command.
 * @param hostVersion - Exact version observed from the installed executable.
 * @param environment - Exact host surface represented by the fixture.
 * @param release - Active release and canonical Skill digest.
 * @returns A trusted preflight payload for the capability binding.
 */
export const loadPreviewHostFixture = (
  host: HostName,
  hostVersion: string,
  environment: HostEnvironment,
  release: PreviewReleaseTuple,
): HostPreflight => {
  const fixture = FIXTURES.find(
    (candidate) =>
      candidate.host === host &&
      candidate.hostVersion === hostVersion &&
      candidate.environment === environment &&
      candidate.releaseVersion === release.releaseVersion &&
      candidate.canonicalSkillDigest === release.canonicalSkillDigest &&
      candidate.schemaProfile === schemaProfileForHost(host) &&
      (candidate.schemaProfile === undefined ||
        candidate.advertisedToolContractDigest ===
          advertisedToolContractDigest(candidate.schemaProfile)) &&
      (candidate.schemaProfile === undefined ||
        candidate.probeContractDigest === PROBE_CONTRACT_DIGEST),
  );
  if (fixture === undefined) {
    throw new Error("No verified capacity fixture matches this host version and release.");
  }
  return {
    ok: true,
    capabilities: PREVIEW_CAPABILITIES,
    capacity: {
      // The runtime budget is the derived token estimate, not the measured byte count.
      maximumInputTokens: fixture.capacity.estimatedInputTokens,
      maximumToolResultBytes: fixture.capacity.maximumToolResultBytes,
      source: "binding_fixture",
    },
    evidence: {
      kind: "binding_fixture",
      fixtureId: fixture.fixtureId,
      host: fixture.host,
      hostVersion: fixture.hostVersion,
      environment: fixture.environment,
      releaseVersion: fixture.releaseVersion,
      wireMajor: fixture.wireMajor,
      canonicalSkillDigest: fixture.canonicalSkillDigest,
    },
    warnings: [],
  };
};
