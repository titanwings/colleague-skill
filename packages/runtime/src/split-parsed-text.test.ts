import { canonicalizeMaterialText } from "@distilly/engine/preview";
import { describe, expect, it } from "vitest";

import { splitParsedText } from "./split-parsed-text.js";

const encoder = new TextEncoder();
const bytes = (text: string): number => encoder.encode(text).byteLength;
const maximumBytes = 1_048_576;

/** The engine's own canonicalization, so a test cannot drift from what is stored. */
const canonicalize = canonicalizeMaterialText;

const expectPartsOfCanonicalText = (text: string, parts: readonly string[]): void => {
  const canonical = canonicalize(text);
  const joined = parts.join("");
  // Compare lengths first: a failing byte-equality assertion on a megabyte string makes the
  // test runner print a megabyte diff, which reads as a hang instead of a failure.
  expect(joined.length).toBe(canonical.length);
  expect(joined === canonical).toBe(true);
  for (const part of parts) {
    expect(part.length).toBeGreaterThan(0);
    expect(bytes(part)).toBeLessThanOrEqual(maximumBytes);
    // A part is stored unchanged only when it already equals its own canonical form.
    expect(canonicalize(part) === part).toBe(true);
    // The engine refuses a material that is only whitespace, so no part may be.
    expect(/[^\p{White_Space}]/u.test(part)).toBe(true);
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
    expect(parts.length).toBe(1);
    expect(parts[0] === text).toBe(true);

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
    const roundTripped = parts
      .map((part) => new TextDecoder().decode(encoder.encode(part)))
      .join("");
    expect(roundTripped.length).toBe(canonicalize(text).length);
    expect(roundTripped === canonicalize(text)).toBe(true);
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
      expect(parts.join("") === canonicalize(text)).toBe(true);
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
      expect(parts.join("") === text).toBe(true);
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
    expect(parts.join("") === canonicalize(text)).toBe(true);
  });

  it("terminates and stays byte-exact on long runs of spaces or tabs", () => {
    // These shapes hung or silently dropped bytes before: the canonicalization regular
    // expression backtracked over the whole run, and a bounded cut back-off left spaces at a
    // part end that the engine then stripped.
    for (const filler of [" ".repeat(2_000), "\t".repeat(32_000), " ".repeat(700_000)]) {
      const text = `a${filler}b`;
      const started = Date.now();
      const parts = splitParsedText(text, maximumBytes);
      expect(Date.now() - started).toBeLessThan(2_000);
      expectPartsOfCanonicalText(text, parts);
    }

    const atCut = `${"a".repeat(maximumBytes - 36)}${" ".repeat(40)}b`;
    const parts = splitParsedText(atCut, maximumBytes);
    expectPartsOfCanonicalText(atCut, parts);
    expect(parts.join("") === atCut).toBe(true);

    const tabsAtCut = `${"a".repeat(maximumBytes - 36)}${"\t".repeat(40)}b`;
    const tabParts = splitParsedText(tabsAtCut, maximumBytes);
    expectPartsOfCanonicalText(tabsAtCut, tabParts);
    expect(tabParts.join("") === tabsAtCut).toBe(true);
  });

  it("refuses a whitespace run no legal part could hold instead of failing the call", () => {
    for (const text of [
      `a${" ".repeat(maximumBytes + 24)}b`,
      `a${"\u00a0".repeat(1_200_000)}b`,
      "\n".repeat(maximumBytes + 1),
    ]) {
      expect(() => splitParsedText(text, maximumBytes)).toThrowError(
        /whitespace at least as long as one material/u,
      );
    }
  });

  it("never separates a combining mark from the base it modifies", () => {
    const filler = `${"a".repeat(63)}\n`.repeat(16_383);
    const text = `${filler}\u0301${"b".repeat(99)}\n`;
    const parts = splitParsedText(text, maximumBytes);
    expectPartsOfCanonicalText(text, parts);
    for (let index = 1; index < parts.length; index += 1) {
      const first = parts[index]?.codePointAt(0) ?? 0;
      if (!/^\p{M}$/u.test(String.fromCodePoint(first))) continue;
      // A part may begin with a mark only when the mark run continues from the part before it.
      const previous = parts[index - 1] ?? "";
      const last = previous.codePointAt(previous.length - 1) ?? 0;
      expect(/^\p{M}$/u.test(String.fromCodePoint(last))).toBe(true);
    }
  });

  it("never leaves a part that is only whitespace", () => {
    // A trailing newline, a blank line between two full parts, or a run that ends on a cut used
    // to produce a whitespace-only part, which made the engine refuse the whole ingest call.
    const full = "a".repeat(maximumBytes);
    const trailing = splitParsedText(`${full}\n`, maximumBytes);
    expect(trailing).toHaveLength(2);
    expectPartsOfCanonicalText(`${full}\n`, trailing);

    const blank = splitParsedText(
      `${"a".repeat(524_288)}\n${"b".repeat(524_288)}\n\n${"c".repeat(10)}`,
      maximumBytes,
    );
    expectPartsOfCanonicalText(
      `${"a".repeat(524_288)}\n${"b".repeat(524_288)}\n\n${"c".repeat(10)}`,
      blank,
    );

    const tiny = splitParsedText("aaaa\n", 4);
    expect(tiny).toHaveLength(2);
    for (const part of tiny) expect(/[^\p{White_Space}]/u.test(part)).toBe(true);
    expect(tiny.join("")).toBe("aaaa\n");
  });

  it("refuses a whitespace run as long as one material instead of emitting a blank part", () => {
    // A run of exactly the limit cannot be cut into parts that all carry content, and the
    // engine refuses a whitespace-only material, so the file is refused with one warning.
    expect(() => splitParsedText(`a${" ".repeat(maximumBytes)}b`, maximumBytes)).toThrowError(
      /whitespace at least as long as one material/u,
    );
    expect(() => splitParsedText("a    b", 4)).toThrowError(/whitespace at least as long/u);
    expect(() => splitParsedText("a\u00a0\u00a0", 4)).toThrowError(/whitespace at least as long/u);
    // Text that canonicalization turns into nothing is not a refusal: the loader keeps the raw
    // file with a warning, which is covered by the runtime test below.
    expect(splitParsedText(" ".repeat(64), 32)).toEqual([]);
    expect(() => splitParsedText("\n".repeat(32), 32)).toThrowError(/whitespace at least as long/u);
  });

  it("returns no parts for empty text", () => {
    expect(splitParsedText("", maximumBytes)).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const text = `${"😀 line\n".repeat(90_000)}tail`;
    expect(splitParsedText(text, maximumBytes)).toEqual(splitParsedText(text, maximumBytes));
  });
});
