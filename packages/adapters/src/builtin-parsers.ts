import { DistillyError } from "@distilly/protocol";

import { parseEmailMessages } from "./email-parser.js";

import type {
  MaterialParser,
  ParsedMaterial,
  ParsedMaterialDraft,
  ParserTextExtraction,
  RawMaterial,
} from "./contracts.js";
import { ParserRegistry } from "./parser-registry.js";

const encoder = new TextEncoder();

const invalidInput = (message: string, fieldPath?: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message,
    retryable: false,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });

const decodeUtf8 = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidInput("Local material must contain valid UTF-8 bytes.", "bytes");
  }
};

const isBlank = (content: string): boolean => content.replace(/[\s\u0085]/gu, "").length === 0;

const validateOutput = (content: string, maximumOutputBytes: number): void => {
  if (!Number.isSafeInteger(maximumOutputBytes) || maximumOutputBytes <= 0) {
    throw invalidInput("maximumOutputBytes must be a positive safe integer.", "maximumOutputBytes");
  }
  if (isBlank(content)) {
    throw invalidInput("Local material did not contain meaningful text.", "material.content");
  }
  const outputBytes = encoder.encode(content).byteLength;
  if (outputBytes > maximumOutputBytes) {
    throw new DistillyError({
      code: "context_too_large",
      message: "Parsed material exceeds the configured output byte limit.",
      retryable: false,
      fieldPath: "material.content",
      remediation: "Narrow the selected file, conversation, or time range and try again.",
      details: { maximumOutputBytes, outputBytes },
    });
  }
};

const draft = (
  input: RawMaterial,
  content: string,
  kind: ParsedMaterialDraft["kind"],
  extraction: ParserTextExtraction,
  maximumOutputBytes: number,
): ParsedMaterial => {
  validateOutput(content, maximumOutputBytes);
  return {
    material: {
      clientRef: input.clientRef,
      kind,
      content,
      source: input.source,
      extraction,
    },
    warnings: [],
  };
};

const documentParser = (
  id: string,
  mediaType: string,
  transform: (text: string) => string,
): MaterialParser => ({
  id,
  accepts: Object.freeze([mediaType]),
  parse(input, context) {
    return Promise.resolve().then(() => {
      if (input.mediaType !== mediaType) {
        throw invalidInput(`Parser ${id} does not accept ${input.mediaType}.`, "mediaType");
      }
      return draft(
        input,
        transform(decodeUtf8(input.bytes)),
        "document",
        { method: "document_text", producer: id },
        context.maximumOutputBytes,
      );
    });
  },
});

const emailParser = (id: string, mediaType: string, mbox: boolean): MaterialParser => ({
  id,
  accepts: Object.freeze([mediaType]),
  parse(input, context) {
    return Promise.resolve().then(() => {
      if (input.mediaType !== mediaType) {
        throw invalidInput(`Parser ${id} does not accept ${input.mediaType}.`, "mediaType");
      }
      // Parse the bytes directly: decoding the container first would double-decode
      // any 8-bit part whose declared charset is not UTF-8.
      const parsed = parseEmailMessages(input.bytes, mbox);
      const rendered = parsed.messages.map((message) => message.body).join("\n\n---\n\n");
      const warnings: string[] = [];
      if (parsed.skippedAttachments > 0) {
        warnings.push(
          `${parsed.skippedAttachments} non-text part(s) were not included as evidence.`,
        );
      }
      if (parsed.undecodableParts > 0) {
        warnings.push(`${parsed.undecodableParts} part(s) could not be decoded as text.`);
      }
      if (parsed.unrecognizedSeparatorLines > 0) {
        warnings.push(
          `${parsed.unrecognizedSeparatorLines} line(s) begin with "From " without being a recognized mbox separator; later messages may be merged.`,
        );
      }
      const result = draft(
        input,
        rendered,
        "document",
        { method: "document_text", producer: id },
        context.maximumOutputBytes,
      );
      return { ...result, warnings };
    });
  },
});

const compareUtf8 = (left: string, right: string): number => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
};

const stableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJson);
  if (typeof value !== "object" || value === null) return value;
  const object = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(object)
      .sort(compareUtf8)
      .map((key) => [key, stableJson(object[key])]),
  );
};

const parseJson = (text: string): string => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalidInput("JSON material must contain one valid JSON value.", "bytes");
  }
  return JSON.stringify(stableJson(value), null, 2);
};

const TIMING_LINE =
  /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}(?:\s+.*)?$/u;
const VTT_BLOCK_METADATA = /^(?:NOTE(?:\s|$)|STYLE\s*$|REGION\s*$)/u;

const stripCueMarkup = (line: string): string =>
  line
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/gu, "")
    .replace(/<\/?(?:b|c(?:\.[^ >]+)*|i|lang(?:\s+[^>]+)?|ruby|rt|u|v(?:\s+[^>]+)?)>/giu, "")
    .trim();

const parseSubtitle = (text: string): string => {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const blocks = normalized.split(/\n[\t ]*\n+/u);
  const output: string[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const lines = blocks[blockIndex]!.split("\n");
    if (blockIndex === 0 && lines[0]?.trim().startsWith("WEBVTT")) continue;
    const first = lines.find((line) => line.trim().length > 0)?.trim() ?? "";
    if (VTT_BLOCK_METADATA.test(first)) continue;
    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingIndex < 0) continue;

    for (const line of lines.slice(timingIndex + 1)) {
      const cleaned = stripCueMarkup(line);
      if (cleaned.length === 0 || cleaned === output.at(-1)) continue;
      output.push(cleaned);
    }
  }
  return output.join("\n");
};

const subtitleParser = (id: string, mediaType: string): MaterialParser => ({
  id,
  accepts: Object.freeze([mediaType]),
  parse(input, context) {
    return Promise.resolve().then(() => {
      if (input.mediaType !== mediaType) {
        throw invalidInput(`Parser ${id} does not accept ${input.mediaType}.`, "mediaType");
      }
      return draft(
        input,
        parseSubtitle(decodeUtf8(input.bytes)),
        "transcript",
        { method: "embedded_caption", producer: id },
        context.maximumOutputBytes,
      );
    });
  },
});

/**
 * Creates the deterministic local parser registry shipped in the first Preview.
 *
 * @returns A fresh registry containing only the reviewed local parser set.
 */
export const createBuiltinParserRegistry = (): ParserRegistry => {
  const registry = new ParserRegistry();
  for (const parser of [
    emailParser("distilly-eml", "message/rfc822", false),
    emailParser("distilly-mbox", "application/mbox", true),
    documentParser("distilly-json", "application/json", parseJson),
    subtitleParser("distilly-srt", "application/x-subrip"),
    documentParser("distilly-markdown", "text/markdown", (text) => text),
    documentParser("distilly-text", "text/plain", (text) => text),
    subtitleParser("distilly-vtt", "text/vtt"),
  ]) {
    registry.register(parser);
  }
  return registry;
};
