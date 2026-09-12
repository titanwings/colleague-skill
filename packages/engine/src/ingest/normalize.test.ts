import { describe, expect, it } from "vitest";

import type {
  CaptureAuditRef,
  ConversationSourceKey,
  IsoDateTime,
  MaterialInput,
  RequestId,
  SubjectId,
} from "@distilly/protocol";

import {
  DistillyError,
  FACT_LIMITS,
  WIRE_LIMITS,
  engineMethodSchemas,
  materialRecordSchema,
} from "@distilly/protocol";

import {
  deriveSourceIdentity,
  normalizeMaterial,
  normalizeMaterialTextV1,
  prepareMaterial,
} from "./normalize.js";
import type { EngineOwnedMaterialProvenance } from "./normalize.js";

const REQUEST_ID = "req_11111111111111111111111111111111" as RequestId;
const SUBJECT_ID = "subject_22222222222222222222222222222222" as SubjectId;
const NOW = "2026-08-20T10:00:00.000Z" as IsoDateTime;

const material = (overrides: Partial<MaterialInput> = {}): MaterialInput => ({
  clientRef: "source-1",
  kind: "document",
  content: "Alpha",
  source: {
    medium: "document",
    access: "public",
    capturedAt: NOW,
    artifact: { provider: "Example", externalId: "article-1" },
  },
  derivation: { kind: "native_text" },
  ...overrides,
});

const parseBoundaryMaterial = (input: MaterialInput): MaterialInput =>
  engineMethodSchemas["materials.ingest"].params.parse({
    subject: { kind: "existing", subjectId: SUBJECT_ID },
    materials: [input],
    enqueue: "auto",
  }).materials[0]!;

describe("material normalization v1", () => {
  it("normalizes line endings, NFC, and line-end ASCII space without changing final LF", () => {
    expect(normalizeMaterialTextV1("Cafe\u0301 \t\r\nSecond\t\rThird  ")).toBe(
      "Café\nSecond\nThird",
    );
    expect(normalizeMaterialTextV1("One  \n")).toBe("One\n");
    expect(normalizeMaterialTextV1("One  ")).toBe("One");
    expect(() => normalizeMaterialTextV1(" \t\r\n\u00a0")).toThrowError(DistillyError);
    expect(() => normalizeMaterialTextV1("\u0085")).toThrowError(DistillyError);
    expect(normalizeMaterialTextV1("\ufeff")).toBe("\ufeff");
  });

  it("canonicalizes a long run of spaces or tabs in linear time", { timeout: 30_000 }, () => {
    // The previous regular expression retried the whole run at every position, so a single
    // megabyte of spaces took minutes and made the whole ingest call appear to hang.
    for (const filler of [" ".repeat(700_000), "\t".repeat(200_000), "\u00a0".repeat(500_000)]) {
      const text = `a${filler}b`;
      const started = Date.now();
      const normalized = normalizeMaterialTextV1(text);
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(normalized === text).toBe(true);
    }
    const trailing = `${"a".repeat(500_000)}${" ".repeat(300_000)}`;
    expect(normalizeMaterialTextV1(trailing)).toBe("a".repeat(500_000));
  });

  it("reapplies content and provenance byte bounds after NFC expansion", () => {
    const expandingLabel = `${"x".repeat(WIRE_LIMITS.labelBytes - 2)}\u0344`;
    const expandingContent = `${"x".repeat(WIRE_LIMITS.materialContentBytes - 2)}\u0344`;
    expect(Buffer.byteLength(expandingLabel, "utf8")).toBe(WIRE_LIMITS.labelBytes);
    expect(Buffer.byteLength(expandingContent, "utf8")).toBe(WIRE_LIMITS.materialContentBytes);

    const labelInput = parseBoundaryMaterial(
      material({
        source: {
          medium: "document",
          access: "public",
          capturedAt: NOW,
          title: expandingLabel,
        },
      }),
    );
    expect(() => normalizeMaterial(labelInput)).toThrowError(
      expect.objectContaining({ code: "invalid_input", fieldPath: "source.title" }),
    );

    const contentInput = parseBoundaryMaterial(material({ content: expandingContent }));
    expect(() => normalizeMaterial(contentInput)).toThrowError(
      expect.objectContaining({ code: "invalid_input", fieldPath: "materials.content" }),
    );
    expect(normalizeMaterialTextV1("x".repeat(WIRE_LIMITS.materialContentBytes))).toHaveLength(
      WIRE_LIMITS.materialContentBytes,
    );
  });

  it("rejects a wire-valid URI when WHATWG canonicalization expands past its byte limit", () => {
    const prefix = "https://example.com/";
    const uri = prefix + "é".repeat((WIRE_LIMITS.uriBytes - prefix.length) / 2);
    expect(Buffer.byteLength(uri, "utf8")).toBe(WIRE_LIMITS.uriBytes);
    const input = parseBoundaryMaterial(
      material({
        kind: "web",
        source: { uri, medium: "webpage", access: "public", capturedAt: NOW },
      }),
    );
    expect(() => normalizeMaterial(input)).toThrowError(
      expect.objectContaining({ code: "invalid_input", fieldPath: "source.uri" }),
    );
  });

  it("normalizes provenance defaults and stable string arrays", () => {
    const normalized = normalizeMaterial(
      material({
        source: {
          uri: "HTTPS://Example.COM:443/a/../story#part",
          title: "Cafe\u0301",
          medium: "article",
          access: "public",
          capturedAt: NOW,
          authors: ["Zoë", "Ada", "Ada"],
          artifact: {
            provider: "Publisher",
            externalId: "id\u0301",
            canonicalUri: "https://EXAMPLE.com:443/canonical#x",
          },
        },
        participants: ["B", "A", "B"],
        flags: ["suspicious_source", "suspicious_source"],
      }),
    );

    expect(normalized).toMatchObject({
      clientRef: "source-1",
      source: {
        uri: "https://example.com/story",
        title: "Café",
        authors: ["Ada", "Zoë"],
        artifact: {
          provider: "publisher",
          externalId: "id́",
          canonicalUri: "https://example.com/canonical",
        },
      },
      participants: ["A", "B"],
      sensitivity: "private",
      flags: ["suspicious_source"],
    });
  });

  it("uses the frozen source identity priority", () => {
    const withUri = normalizeMaterial(
      material({
        source: {
          uri: "https://example.com/retrieval",
          medium: "article",
          access: "public",
          capturedAt: NOW,
          artifact: {
            provider: "publisher",
            externalId: "external",
            canonicalUri: "https://example.com/artifact",
          },
        },
      }),
    );
    expect(deriveSourceIdentity(withUri, REQUEST_ID)).toBe(
      "source-uri-v1\0https://example.com/retrieval",
    );

    const external = normalizeMaterial(material());
    expect(deriveSourceIdentity(external, REQUEST_ID)).toBe(
      "artifact-external-v1\0example\0article-1",
    );

    const artifactUri = normalizeMaterial(
      material({
        source: {
          medium: "document",
          access: "public",
          capturedAt: NOW,
          artifact: { provider: "example", canonicalUri: "https://example.com/item" },
        },
      }),
    );
    expect(deriveSourceIdentity(artifactUri, REQUEST_ID)).toBe(
      "artifact-uri-v1\0https://example.com/item",
    );

    const fallback = normalizeMaterial(
      material({ source: { medium: "document", access: "private", capturedAt: NOW } }),
    );
    expect(deriveSourceIdentity(fallback, REQUEST_ID)).toBe(
      `client-ref-v1\0${REQUEST_ID}\0document\0source-1`,
    );
    expect(() =>
      deriveSourceIdentity(
        {
          ...fallback,
          source: { ...fallback.source, uri: "https://example.com/\0escape" },
        },
        REQUEST_ID,
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));
  });

  it("keeps the source identity fact bound independent from the public URI bound", () => {
    const uriPrefix = "https://example.com/";
    const uri = uriPrefix + "x".repeat(WIRE_LIMITS.uriBytes - uriPrefix.length);
    const normalized = normalizeMaterial(
      material({
        source: {
          medium: "document",
          access: "public",
          capturedAt: NOW,
          artifact: { provider: "example", canonicalUri: uri },
        },
      }),
    );
    const sourceIdentity = deriveSourceIdentity(normalized, REQUEST_ID);
    expect(Buffer.byteLength(sourceIdentity, "utf8")).toBe(FACT_LIMITS.sourceIdentityBytes);
    const prepared = prepareMaterial(normalized, SUBJECT_ID, REQUEST_ID, NOW);
    expect(() => materialRecordSchema.parse(prepared.record)).not.toThrow();
    expect(() =>
      materialRecordSchema.parse({
        ...prepared.record,
        sourceIdentity: `${sourceIdentity}x`,
      }),
    ).toThrow();
  });

  it("keeps title and capturedAt outside material identity but includes safety provenance", () => {
    const first = prepareMaterial(normalizeMaterial(material()), SUBJECT_ID, REQUEST_ID, NOW);
    const displayOnly = prepareMaterial(
      normalizeMaterial(
        material({
          source: {
            medium: "document",
            access: "public",
            capturedAt: "2026-08-20T11:00:00.000Z" as IsoDateTime,
            title: "Different title",
            artifact: { provider: "example", externalId: "article-1" },
          },
        }),
      ),
      SUBJECT_ID,
      REQUEST_ID,
      NOW,
    );
    const privateCopy = prepareMaterial(
      normalizeMaterial(
        material({
          source: {
            medium: "document",
            access: "private",
            capturedAt: NOW,
            artifact: { provider: "example", externalId: "article-1" },
          },
        }),
      ),
      SUBJECT_ID,
      REQUEST_ID,
      NOW,
    );

    expect(displayOnly.record.id).toBe(first.record.id);
    expect(displayOnly.record.provenanceDigest).toBe(first.record.provenanceDigest);
    expect(privateCopy.record.id).not.toBe(first.record.id);
    expect(privateCopy.record.provenanceDigest).not.toBe(first.record.provenanceDigest);
  });

  it("requires capture audit and conversation stamps as an engine-owned pair", () => {
    const normalized = normalizeMaterial(material());
    expect(() =>
      prepareMaterial(normalized, SUBJECT_ID, REQUEST_ID, NOW, {
        captureAuditRef: "capture_11111111111111111111111111111111" as CaptureAuditRef,
      } as unknown as EngineOwnedMaterialProvenance),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));

    expect(
      prepareMaterial(normalized, SUBJECT_ID, REQUEST_ID, NOW, {
        captureAuditRef: "capture_11111111111111111111111111111111" as CaptureAuditRef,
        conversationSourceKey: `conversation_${"2".repeat(64)}` as ConversationSourceKey,
      }).record,
    ).toMatchObject({
      captureAuditRef: "capture_11111111111111111111111111111111",
      conversationSourceKey: `conversation_${"2".repeat(64)}`,
    });
  });
});
