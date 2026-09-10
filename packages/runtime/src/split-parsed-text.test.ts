import { describe, expect, it } from "vitest";

import { splitParsedText } from "./split-parsed-text.js";

const encoder = new TextEncoder();
const bytes = (text: string): number => encoder.encode(text).byteLength;
const maximumBytes = 1_048_576;

/**
 * Mirrors the engine's frozen material-text-v1 canonicalization so parts can be checked.
 *
 * @param text - Text to canonicalize.
 * @returns Canonical text.
 */
const canonicalize = (text: string): string =>
  text
    .replace(/\r\n?/gu, "\n")
    .normalize("NFC")
    .replace(/[ \t]+(?=\n|$)/gu, "");

const expectPartsOfCanonicalText = (text: string, parts: readonly string[]): void => {
  const canonical = canonicalize(text);
  expect(parts.join("")).toBe(canonical);
  for (const part of parts) {
    expect(part.length).toBeGreaterThan(0);
    expect(bytes(part)).toBeLessThanOrEqual(maximumBytes);
    // A part is stored unchanged only when it already equals its own canonical form.
    expect(canonicalize(part)).toBe(part);
  }
};

const loneSurrogates = (text: string): number => {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0xd800 || code > 0xdfff) continue;
    if (code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        continue;
      }
    }
    count += 1;
  }
  return count;
};

describe("parsed text splitting", () => {
  it("keeps every part within the limit and loses nothing for a size sweep", () => {
    const line = `${"a".repeat(63)}\n`;
    for (const size of [
      maximumBytes - 1,
      maximumBytes,
      maximumBytes + 1,
      2 * maximumBytes,
      3 * maximumBytes,
      2.5 * maximumBytes,
    ]) {
      const text = line.repeat(Math.ceil(size / line.length)).slice(0, size);
      expectPartsOfCanonicalText(text, splitParsedText(text, maximumBytes));
    }
  });

  it("does not emit an empty trailing part for an exact multiple of the limit", () => {
    // 64-byte lines: 1 MiB is an exact multiple of 64, which previously produced a third
    // empty part and made the whole ingest call fail its minimum-length check.
    const line = `${"a".repeat(63)}\n`;
    const text = line.repeat(maximumBytes / line.length);
    expect(bytes(text)).toBe(maximumBytes);
    const parts = splitParsedText(text, maximumBytes);
    expect(parts).toEqual([text]);
    expect(parts.some((part) => part.length === 0)).toBe(false);

    const doubled = text.repeat(2);
    const doubledParts = splitParsedText(doubled, maximumBytes);
    expect(doubledParts).toHaveLength(2);
    expectPartsOfCanonicalText(doubled, doubledParts);
  });

  it("never cuts between a high and a low surrogate", () => {
    const text = `a${"😀".repeat(262_150)}\n`;
    const parts = splitParsedText(text, maximumBytes);
    expectPartsOfCanonicalText(text, parts);
    for (const part of parts) expect(loneSurrogates(part)).toBe(0);
    // Round-tripping through UTF-8 must not introduce a replacement character.
    expect(parts.map((part) => new TextDecoder().decode(encoder.encode(part))).join("")).toBe(
      canonicalize(text),
    );
    expect(parts.join("")).not.toContain("\uFFFD");
  });

  it("terminates when a combining mark cannot be kept with the code point before it", () => {
    // These shapes previously looped forever: the mark back-off walked the cut back to the
    // start of an empty part, so nothing was ever pushed and the cursor never advanced.
    for (const text of ["a\u0301\u0301", "\u6f22\u0301", "\u0301", "\u0301\u0301\n"]) {
      const started = Date.now();
      const parts = splitParsedText(text, 4);
      expect(Date.now() - started).toBeLessThan(1_000);
      for (const part of parts) expect(bytes(part)).toBeLessThanOrEqual(4);
      expect(parts.join("")).toBe(canonicalize(text));
    }

    const long = `a${"\u0301".repeat(600_000)}`;
    const started = Date.now();
    const parts = splitParsedText(long, maximumBytes);
    expect(Date.now() - started).toBeLessThan(5_000);
    expectPartsOfCanonicalText(long, parts);
  });

  it("cuts a single over-long line in linear time", () => {
    const timings: number[] = [];
    for (const mebibytes of [1, 2, 4, 8]) {
      const text = "x".repeat(mebibytes * maximumBytes);
      const started = Date.now();
      const parts = splitParsedText(text, maximumBytes);
      timings.push(Date.now() - started);
      expect(parts).toHaveLength(mebibytes);
      expect(parts.every((part) => bytes(part) === maximumBytes)).toBe(true);
      expect(parts.join("")).toBe(text);
    }
    // Linear growth means doubling the input roughly doubles the work; the previous
    // implementation re-scanned the whole remaining line for each part.
    const [one, , four, eight] = timings as [number, number, number, number];
    expect(eight).toBeLessThan(Math.max(1_500, one * 16 + 500));
    expect(four).toBeLessThan(Math.max(1_000, one * 8 + 300));
  });

  it("does not start a part with a combining mark even at a line boundary", () => {
    // Fill one part to 64 bytes below the limit, then begin the next line with a mark.
    const filler = `${"a".repeat(63)}\n`.repeat(16_383);
    const text = `${filler}\u0301${"b".repeat(99)}\n`;
    const parts = splitParsedText(text, maximumBytes);
    expectPartsOfCanonicalText(text, parts);
    for (const part of parts) {
      const first = part.codePointAt(0) ?? 0;
      expect(/^\p{M}$/u.test(String.fromCodePoint(first))).toBe(false);
    }
  });

  it("does not end a part with spaces or tabs the engine would strip", () => {
    const text = `${"a".repeat(maximumBytes - 8)}   tail after spaces\n`;
    const parts = splitParsedText(text, maximumBytes);
    expectPartsOfCanonicalText(text, parts);
    for (const part of parts) expect(/[ \t]$/u.test(part)).toBe(false);
  });

  it("canonicalizes before splitting, so CRLF and NFC-expanding text stay legal", () => {
    const crlf = `line one\r\nline two\r\n${"x".repeat(maximumBytes)}\r\n`;
    const crlfParts = splitParsedText(crlf, maximumBytes);
    expectPartsOfCanonicalText(crlf, crlfParts);
    expect(crlfParts.join("")).not.toContain("\r");

    // U+0958 has a canonical decomposition and is a composition exclusion, so NFC turns each
    // code point into three bytes. Splitting the raw text would produce parts that the engine
    // then refuses for exceeding the limit.
    const expanding = "\u0958".repeat(400_000);
    const expandingParts = splitParsedText(expanding, maximumBytes);
    expectPartsOfCanonicalText(expanding, expandingParts);
    expect(expandingParts.length).toBeGreaterThan(1);
    for (const part of expandingParts) expect(bytes(part)).toBeLessThanOrEqual(maximumBytes);
  });

  it("still splits correctly when the limit is only a few bytes", () => {
    const text = "ab😀cd\u0301ef\ngh";
    const parts = splitParsedText(text, 4);
    for (const part of parts) expect(bytes(part)).toBeLessThanOrEqual(4);
    expect(parts.join("")).toBe(canonicalize(text));
  });

  it("returns no parts for empty text", () => {
    expect(splitParsedText("", maximumBytes)).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const text = `${"😀 line\n".repeat(90_000)}tail`;
    expect(splitParsedText(text, maximumBytes)).toEqual(splitParsedText(text, maximumBytes));
  });
});
