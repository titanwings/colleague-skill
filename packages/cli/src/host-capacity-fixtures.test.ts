import { createHash } from "node:crypto";

import { advertisedToolContractDigest } from "@distilly/mcp/internal/schema";
import { BUILTIN_HOSTS, distillyMcpTools, type ContentDigest } from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import codexEvidence from "./evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v2.json" with { type: "json" };
import hermesEvidence from "./evidence/host-capacity/hermes-agent-v0.9.0-cli-distilly-0.1.0-preview.1-v3.json" with { type: "json" };
import openClawEvidence from "./evidence/host-capacity/openclaw-2026.3.24-cli-distilly-0.1.0-preview.1-v3.json" with { type: "json" };
import {
  loadPreviewHostFixture,
  parsePreviewHostCapacityEvidence,
} from "./host-capacity-fixtures.js";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map((key) => [key, canonicalize(record[key])]),
  );
};

const descriptorDigest = (): string => {
  const descriptors = distillyMcpTools.map(
    ({ name, title, description, inputSchema, outputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    }),
  );
  return `sha256_${createHash("sha256")
    .update(JSON.stringify(canonicalize(descriptors)))
    .digest("hex")}`;
};

const PROBE_CONTRACT_DIGEST =
  "sha256_c7e2ae4afcdedd3d59e9ffd50ffca8c4d8c6449f82977fc167f171204497bd77";

const EXPECTED_FIXTURE_IDS = {
  [BUILTIN_HOSTS.codex]: "codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v2",
  [BUILTIN_HOSTS.openclaw]: "openclaw-2026.3.24-cli-distilly-0.1.0-preview.1-v3",
  [BUILTIN_HOSTS.hermes]: "hermes-agent-v0.9.0-cli-distilly-0.1.0-preview.1-v3",
} as const;

interface ProjectedEvidence {
  readonly fixtureId: string;
  readonly hostVersion: string;
  readonly releaseVersion: string;
  readonly canonicalSkillDigest: string;
  readonly schemaProfile: string;
  readonly advertisedToolContractDigest: string;
  readonly probeContractDigest: string;
}

const projectedEvidence = (value: unknown): ProjectedEvidence => value as ProjectedEvidence;

describe("immutable Preview host capacity evidence", () => {
  it("binds the real Codex observation to the current tool contract and release", () => {
    expect(descriptorDigest()).toBe(codexEvidence.toolContractDigest);
    expect(codexEvidence.fixtureId).toBe(EXPECTED_FIXTURE_IDS[BUILTIN_HOSTS.codex]);
    const preflight = loadPreviewHostFixture(
      BUILTIN_HOSTS.codex,
      codexEvidence.hostVersion,
      "cli",
      {
        releaseVersion: codexEvidence.releaseVersion,
        canonicalSkillDigest: codexEvidence.canonicalSkillDigest as ContentDigest,
      },
    );
    if (!preflight.ok) throw new TypeError("Expected the exact Codex evidence tuple to load.");
    expect(preflight.capacity).toEqual({
      // 16_384 is the conservative token estimate derived from 65_536 measured bytes.
      maximumInputTokens: 16_384,
      maximumToolResultBytes: 65_536,
      source: "binding_fixture",
    });
    expect(preflight.evidence).toMatchObject({
      fixtureId: codexEvidence.fixtureId,
      hostVersion: codexEvidence.hostVersion,
      canonicalSkillDigest: codexEvidence.canonicalSkillDigest,
    });
  });

  it("rejects a legacy record that declares a byte count as a token limit", () => {
    const legacy = {
      ...(codexEvidence as unknown as Record<string, unknown>),
      schemaVersion: 1,
      capacity: { maximumInputTokens: 65_536, maximumToolResultBytes: 65_536 },
    };
    expect(() => parsePreviewHostCapacityEvidence(legacy)).toThrow(
      /host capacity evidence record/u,
    );
  });

  it("rejects a record whose token budget is copied from its byte measurement", () => {
    const copied = {
      ...(codexEvidence as unknown as Record<string, unknown>),
      capacity: {
        boundKind: "verified_lower_bound",
        verifiedBriefingBytes: 65_536,
        estimatedInputTokens: 65_536,
        maximumToolResultBytes: 65_536,
        estimatedToolResultTokens: 16_384,
      },
    };
    expect(() => parsePreviewHostCapacityEvidence(copied)).toThrow(
      /host capacity evidence record/u,
    );
  });

  it("rejects a record that drops the explicit lower-bound declaration", () => {
    const unlabelled = {
      ...(codexEvidence as unknown as Record<string, unknown>),
      capacity: {
        verifiedBriefingBytes: 65_536,
        estimatedInputTokens: 16_384,
        maximumToolResultBytes: 65_536,
        estimatedToolResultTokens: 16_384,
      },
    };
    expect(() => parsePreviewHostCapacityEvidence(unlabelled)).toThrow(
      /host capacity evidence record/u,
    );
  });

  it("fails closed for an exact tuple without a real evidence record", () => {
    expect(() =>
      loadPreviewHostFixture(BUILTIN_HOSTS.claudeCode, "2.1.221 (Claude Code)", "cli", {
        releaseVersion: "0.1.0-preview.1",
        canonicalSkillDigest:
          "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9" as ContentDigest,
      }),
    ).toThrow(/No verified capacity fixture/u);
  });

  it.each([
    [BUILTIN_HOSTS.openclaw, openClawEvidence, 65_536],
    [BUILTIN_HOSTS.hermes, hermesEvidence, 49_752],
  ] as const)("loads the exact real %s capacity fixture", (host, rawEvidence, bytes) => {
    const evidence = projectedEvidence(rawEvidence);
    const schemaProfile = host === BUILTIN_HOSTS.openclaw ? "openclaw" : "hermes";
    expect(evidence.fixtureId).toBe(EXPECTED_FIXTURE_IDS[host]);
    expect(evidence.schemaProfile).toBe(host);
    expect(evidence.advertisedToolContractDigest).toBe(advertisedToolContractDigest(schemaProfile));
    expect(evidence.probeContractDigest).toBe(PROBE_CONTRACT_DIGEST);
    const preflight = loadPreviewHostFixture(host, evidence.hostVersion, "cli", {
      releaseVersion: evidence.releaseVersion,
      canonicalSkillDigest: evidence.canonicalSkillDigest as ContentDigest,
    });
    if (!preflight.ok) throw new TypeError(`Expected the exact ${host} evidence tuple to load.`);
    expect(preflight.capacity).toEqual({
      maximumInputTokens: Math.max(1, Math.floor(bytes / 4)),
      maximumToolResultBytes: bytes,
      source: "binding_fixture",
    });
    expect(preflight.evidence).toMatchObject({
      fixtureId: evidence.fixtureId,
      host,
      hostVersion: evidence.hostVersion,
      canonicalSkillDigest: evidence.canonicalSkillDigest,
    });
  });

  it.each([
    [BUILTIN_HOSTS.openclaw, "OpenClaw 2026.3.25 (unrecorded)"],
    [BUILTIN_HOSTS.hermes, "Hermes Agent v0.9.1 (unrecorded)"],
  ] as const)("fails closed for an unrecorded %s version", (host, hostVersion) => {
    expect(() =>
      loadPreviewHostFixture(host, hostVersion, "cli", {
        releaseVersion: "0.1.0-preview.1",
        canonicalSkillDigest:
          "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9" as ContentDigest,
      }),
    ).toThrow(/No verified capacity fixture/u);
  });

  it("rejects mutable evidence payloads instead of widening a fixture", () => {
    const evidence = hermesEvidence as Record<string, unknown>;
    expect(() =>
      parsePreviewHostCapacityEvidence({ ...evidence, apiKey: "must-not-be-stored" }),
    ).toThrow(/unsupported fields/u);

    expect(() =>
      parsePreviewHostCapacityEvidence({
        ...evidence,
        capacity: {
          ...(evidence.capacity as Record<string, unknown>),
          maximumToolResultBytes: 49_753,
        },
      }),
    ).toThrow(/invalid/u);

    expect(() =>
      parsePreviewHostCapacityEvidence({
        ...evidence,
        observed: {
          ...(evidence.observed as Record<string, unknown>),
          normalizedTranscriptDigest: "sha256_" + "0".repeat(64),
        },
      }),
    ).toThrow(/invalid/u);
  });
});
