import { describe, expect, it } from "vitest";

import { splitParsedText } from "./split-parsed-text.js";

const encoder = new TextEncoder();
const bytes = (text: string): number => encoder.encode(text).byteLength;
const maximumBytes = 1_048_576;

const expectReassembles = (text: string, parts: readonly string[]): void => {
  expect(parts.join("")).toBe(text);
  for (const part of parts) {
    expect(part.length).toBeGreaterThan(0);
    expect(bytes(part)).toBeLessThanOrEqual(maximumBytes);
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
      const parts = splitParsedText(text, maximumBytes);
      expectReassembles(text, parts);
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
    expectReassembles(doubled, doubledParts);
  });

  it("never cuts between a high and a low surrogate", () => {
    const text = `a${"😀".repeat(262_150)}\n`;
    const parts = splitParsedText(text, maximumBytes);
    expectReassembles(text, parts);
    for (const part of parts) expect(loneSurrogates(part)).toBe(0);
    // Round-tripping through UTF-8 must not introduce a replacement character.
    expect(parts.map((part) => new TextDecoder().decode(encoder.encode(part))).join("")).toBe(text);
    expect(parts.join("")).not.toContain("\uFFFD");
  });

  it("cuts a single over-long line quickly instead of rescanning every prefix", () => {
    const text = "x".repeat(3 * maximumBytes);
    const started = Date.now();
    const parts = splitParsedText(text, maximumBytes);
    const elapsed = Date.now() - started;
    expect(parts).toHaveLength(3);
    expect(parts.every((part) => bytes(part) === maximumBytes)).toBe(true);
    expectReassembles(text, parts);
    expect(elapsed).toBeLessThan(2_000);
  });

  it("does not start a part with a combining mark", () => {
    // 1 MiB of two-byte code points, then a base letter with a combining acute accent.
    const text = `${"\u00e9".repeat(maximumBytes / 2)}e\u0301 tail`;
    const parts = splitParsedText(text, maximumBytes);
    expectReassembles(text, parts);
    for (const part of parts) {
      const first = part.codePointAt(0) ?? 0;
      const isCombining = /^\p{M}$/u.test(String.fromCodePoint(first));
      expect(isCombining).toBe(false);
    }
  });

  it("still splits correctly when the limit is only a few bytes", () => {
    const text = "ab😀cd\u0301ef\ngh";
    const parts = splitParsedText(text, 4);
    for (const part of parts) expect(bytes(part)).toBeLessThanOrEqual(4);
    expect(parts.join("")).toBe(text);
  });

  it("returns no parts for empty text", () => {
    expect(splitParsedText("", maximumBytes)).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const text = `${"😀 line\n".repeat(90_000)}tail`;
    expect(splitParsedText(text, maximumBytes)).toEqual(splitParsedText(text, maximumBytes));
  });
});
