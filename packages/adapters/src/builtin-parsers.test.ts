import type { IsoDateTime, RequestId, SubjectId } from "@distilly/protocol";
import { DistillyError } from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import type { ParseContext, RawMaterial } from "./contracts.js";
import { createBuiltinParserRegistry } from "./builtin-parsers.js";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const context = (maximumOutputBytes = 1_048_576): ParseContext => ({
  subjectId: "sub_fixture" as SubjectId,
  requestId: "req_fixture" as RequestId,
  maximumOutputBytes,
});

const raw = (mediaType: string, value: Uint8Array | string): RawMaterial => ({
  clientRef: "file-1",
  mediaType,
  bytes: typeof value === "string" ? bytes(value) : value,
  source: {
    uri: "file:///tmp/fixture",
    title: "fixture",
    medium: "document",
    access: "private",
    capturedAt: "2026-08-31T00:00:00.000Z" as IsoDateTime,
  },
});

const parse = async (mediaType: string, value: Uint8Array | string, limit?: number) => {
  const parser = createBuiltinParserRegistry().select(mediaType);
  if (parser === undefined) throw new Error(`missing parser for ${mediaType}`);
  return parser.parse(raw(mediaType, value), context(limit));
};

describe("builtin local material parsers", () => {
  it("passes through UTF-8 text and Markdown provenance without adding raw derivation", async () => {
    const text = await parse("text/plain", "\ufeffhello\r\nworld");
    const markdown = await parse("text/markdown", "# Heading\n\nBody");

    expect(text).toEqual({
      material: {
        clientRef: "file-1",
        kind: "document",
        content: "hello\r\nworld",
        source: raw("text/plain", "ignored").source,
        extraction: { method: "document_text", producer: "distilly-text" },
      },
      warnings: [],
    });
    expect(markdown.material).toMatchObject({
      clientRef: "file-1",
      kind: "document",
      content: "# Heading\n\nBody",
      extraction: { method: "document_text", producer: "distilly-markdown" },
    });
    expect(markdown.material).not.toHaveProperty("derivation");
  });

  it("validates JSON and renders recursively sorted stable text", async () => {
    const first = await parse("application/json", '{"z":1,"a":{"y":2,"x":3}}');
    const second = await parse("application/json", '{ "a": { "x": 3, "y": 2 }, "z": 1 }');

    expect(first.material?.content).toBe('{\n  "a": {\n    "x": 3,\n    "y": 2\n  },\n  "z": 1\n}');
    expect(second.material?.content).toBe(first.material?.content);
    await expect(parse("application/json", "{not-json}")).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "bytes",
      retryable: false,
    });
  });

  it("cleans SRT indexes, timestamps, markup, and adjacent repeated text", async () => {
    const parsed = await parse(
      "application/x-subrip",
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "<i>Hello</i>",
        "",
        "2",
        "00:00:02,100 --> 00:00:03,000 X1:0 X2:10",
        "Hello",
        "World",
        "",
      ].join("\r\n"),
    );

    expect(parsed.material).toMatchObject({
      kind: "transcript",
      content: "Hello\nWorld",
      extraction: { method: "embedded_caption", producer: "distilly-srt" },
    });
  });

  it("cleans WEBVTT headers, cue identifiers, metadata blocks, tags, and cue timestamps", async () => {
    const parsed = await parse(
      "text/vtt",
      [
        "\ufeffWEBVTT - fixture",
        "Kind: captions",
        "Language: en",
        "",
        "NOTE generated metadata",
        "not dialogue",
        "",
        "cue-1",
        "00:01.000 --> 00:02.000 align:start",
        "<v Alice>Hello <00:01.500><b>there</b>",
        "",
        "cue-2",
        "00:02.000 --> 00:03.000",
        "Hello there",
        "<c.notice>Again</c>",
      ].join("\n"),
    );

    expect(parsed.material).toMatchObject({
      kind: "transcript",
      content: "Hello there\nAgain",
      extraction: { method: "embedded_caption", producer: "distilly-vtt" },
    });
  });

  it("rejects malformed UTF-8, whitespace-only output, parser mismatch, and bad limits", async () => {
    await expect(parse("text/plain", new Uint8Array([0xc3, 0x28]))).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "bytes",
    });
    await expect(parse("text/plain", " \n\u0085\t")).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "material.content",
    });
    await expect(parse("text/plain", "x", 0)).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "maximumOutputBytes",
    });

    const parser = createBuiltinParserRegistry().select("text/plain");
    if (parser === undefined) throw new Error("missing text parser");
    await expect(parser.parse(raw("text/markdown", "x"), context())).rejects.toMatchObject({
      code: "invalid_input",
      fieldPath: "mediaType",
    });
  });

  it("accepts an exact UTF-8 byte limit and rejects one byte over without truncation", async () => {
    await expect(parse("text/plain", "é", 2)).resolves.toMatchObject({
      material: { content: "é" },
    });
    const over = parse("text/plain", "é", 1);
    await expect(over).rejects.toBeInstanceOf(DistillyError);
    await expect(over).rejects.toMatchObject({
      code: "context_too_large",
      retryable: false,
      details: { maximumOutputBytes: 1, outputBytes: 2 },
    });
  });

  it("exposes only the reviewed Preview media types through a fresh registry", () => {
    const first = createBuiltinParserRegistry();
    const second = createBuiltinParserRegistry();

    expect(first).not.toBe(second);
    expect(
      first
        .list()
        .flatMap(({ accepts }) => accepts)
        .sort(),
    ).toEqual([
      "application/json",
      "application/mbox",
      "application/x-subrip",
      "message/rfc822",
      "text/markdown",
      "text/plain",
      "text/vtt",
    ]);
  });
});
