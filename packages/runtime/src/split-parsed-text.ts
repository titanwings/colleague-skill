import { canonicalizeMaterialText } from "@distilly/engine/preview";
import { DistillyError } from "@distilly/protocol";

/**
 * Splits one oversized parsed text into parts that each fit the local material byte limit.
 *
 * The text is first canonicalized by the engine's own material-text-v1 rule (CRLF and CR to
 * LF, NFC, and no spaces or tabs before a line end), so a stored part equals the slice that
 * produced it and a mid-line cut cannot create a seam the engine would rewrite. Parts are then
 * consecutive slices of that canonical text: joining them with an empty string reproduces it,
 * no byte is added or dropped, and no part is empty.
 *
 * A cut prefers a line boundary. Only a single line that cannot fit in one part is cut inside
 * the line, at a Unicode code point boundary, never between a high and a low surrogate, never
 * between a base character and its combining marks, and never inside a run of spaces or tabs.
 * The scan is linear in the text length, including for one line larger than the limit.
 *
 * @param text - Rendered material text.
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 * @returns One or more part texts, in order; no parts for empty text.
 * @throws DistillyError when the text contains a whitespace run no legal part could hold.
 */
export const splitParsedText = (text: string, maximumBytes: number): readonly string[] => {
  if (maximumBytes < 4) throw new Error("A part must be able to hold one code point.");
  const canonical = canonicalizeMaterialText(text);
  assertNoOversizedWhitespaceRun(canonical, maximumBytes);
  const parts: string[] = [];
  let partStart = 0;
  let partBytes = 0;
  let cursor = 0;
  const push = (end: number): void => {
    parts.push(canonical.slice(partStart, end));
    partStart = end;
    partBytes = 0;
  };
  while (cursor < canonical.length) {
    const newline = canonical.indexOf("\n", cursor);
    const lineEnd = newline === -1 ? canonical.length : newline + 1;
    const lineBytes = utf8BytesIn(canonical, cursor, lineEnd);
    if (lineBytes <= maximumBytes) {
      if (partBytes + lineBytes > maximumBytes) {
        // Close this part on the line boundary, taking any combining marks that begin this
        // line with it so the next part cannot start with a detached mark. The rest of the
        // line then starts the next part, where it fits because this line fits in one part.
        const extended = extendOverMarks(canonical, cursor, partBytes, maximumBytes);
        push(extended);
        cursor = extended;
        continue;
      }
      partBytes += lineBytes;
      cursor = lineEnd;
      continue;
    }
    // One line is larger than a whole part: fill the rest of this part, then chunk the line.
    if (partBytes > 0) push(cursor);
    let index = cursor;
    while (index < lineEnd) {
      let end = index;
      let bytes = 0;
      while (end < lineEnd) {
        const codePoint = canonical.codePointAt(end) ?? 0;
        const width = utf8Width(codePoint);
        if (bytes + width > maximumBytes) break;
        bytes += width;
        end += codePoint > 0xffff ? 2 : 1;
      }
      if (end === index) throw new Error("A part must be able to hold one code point.");
      const cut = trimCut(canonical, index, end);
      parts.push(canonical.slice(index, cut));
      index = cut;
    }
    partStart = index;
    cursor = index;
    partBytes = 0;
  }
  if (partBytes > 0) parts.push(canonical.slice(partStart));
  return withoutWhitespaceOnlyParts(canonical, parts, maximumBytes);
};

/**
 * Repairs parts that would be refused as whitespace-only material.
 *
 * A trailing newline, a blank line between two full parts, or a run that ends exactly on a cut
 * can leave a part made only of whitespace, and the engine refuses that material outright. Each
 * such part takes the next non-whitespace code point when the byte ceiling allows it, the last
 * part may take bytes back from the part before it, and text where neither is possible is
 * refused as one file.
 *
 * @param text - Canonical text the parts were cut from.
 * @param parts - Parts produced by the cut.
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 * @returns Parts that each contain at least one non-whitespace code point.
 */
const withoutWhitespaceOnlyParts = (
  text: string,
  parts: readonly string[],
  maximumBytes: number,
): readonly string[] => {
  const ranges: { start: number; end: number }[] = [];
  let offset = 0;
  for (const part of parts) {
    ranges.push({ start: offset, end: offset + part.length });
    offset += part.length;
  }
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (range === undefined) continue;
    if (!isWhitespaceOnly(text, range.start, range.end)) continue;
    // Take the next part's code points until this part holds something that is not whitespace.
    while (index + 1 < ranges.length && isWhitespaceOnly(text, range.start, range.end)) {
      const next = ranges[index + 1];
      if (next === undefined) break;
      const codePoint = text.codePointAt(next.start) ?? 0;
      const grown = range.end + (codePoint > 0xffff ? 2 : 1);
      if (utf8BytesIn(text, range.start, grown) > maximumBytes) break;
      range.end = grown;
      next.start = grown;
      if (next.start >= next.end) ranges.splice(index + 1, 1);
    }
    // The final part can instead take bytes back from the part before it.
    while (
      index === ranges.length - 1 &&
      isWhitespaceOnly(text, range.start, range.end) &&
      index > 0
    ) {
      const previous = ranges[index - 1];
      if (previous === undefined || previous.end - previous.start <= 1) break;
      const codePointStart = previousCodePointStart(text, previous.end, previous.start);
      if (codePointStart <= previous.start) break;
      range.start = codePointStart;
      previous.end = codePointStart;
    }
    if (isWhitespaceOnly(text, range.start, range.end)) {
      throw unusableWhitespace(maximumBytes, utf8BytesIn(text, range.start, range.end));
    }
  }
  return ranges.map((range) => text.slice(range.start, range.end));
};

/**
 * Reports whether a slice of the canonical text holds no non-whitespace code point.
 *
 * @param text - Canonical text.
 * @param start - First UTF-16 index of the slice.
 * @param end - Exclusive end of the slice.
 * @returns True when every code point in the slice is whitespace.
 */
const isWhitespaceOnly = (text: string, start: number, end: number): boolean => {
  let index = start;
  while (index < end) {
    const codePoint = text.codePointAt(index) ?? 0;
    if (!isEngineWhitespace(codePoint)) return false;
    index += codePoint > 0xffff ? 2 : 1;
  }
  return true;
};

/** Matches one combining mark, which must not be separated from the base it modifies. */
const COMBINING_MARK = /^\p{M}$/u;

/**
 * Reports whether one code point is whitespace the engine would reject a part for.
 *
 * @param code - UTF-16 code unit or code point value.
 * @returns True for the Unicode White_Space set.
 */
const isEngineWhitespace = (code: number): boolean =>
  (code >= 0x09 && code <= 0x0d) ||
  code === 0x20 ||
  code === 0x85 ||
  code === 0xa0 ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x202f ||
  code === 0x205f ||
  code === 0x3000;

/**
 * Reports whether one code point is the horizontal whitespace the engine strips at a part end.
 *
 * @param code - UTF-16 code unit or code point value.
 * @returns True for space or tab.
 */
const isHorizontalWhitespace = (code: number): boolean => code === 0x20 || code === 0x09;

/**
 * Refuses text whose whitespace run is longer than any legal part could hold.
 *
 * A part made only of whitespace is rejected by the engine, so a run longer than the limit
 * cannot be split into legal materials at all. Refusing here lets the caller keep the raw file
 * and warn, instead of failing the whole ingest call with a bare canonicalization error.
 *
 * @param text - Canonical text.
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 */
const assertNoOversizedWhitespaceRun = (text: string, maximumBytes: number): void => {
  if (text.length === 0) return;
  let runBytes = 0;
  let index = 0;
  let hasContent = false;
  while (index < text.length) {
    const codePoint = text.codePointAt(index) ?? 0;
    if (isEngineWhitespace(codePoint)) {
      runBytes += utf8Width(codePoint);
      // A run of exactly one material can only be cut into whitespace-only parts, which the
      // engine refuses, so it is refused here as one file instead of failing the whole call.
      if (runBytes >= maximumBytes) {
        throw unusableWhitespace(maximumBytes, runBytes);
      }
    } else {
      hasContent = true;
      runBytes = 0;
    }
    index += codePoint > 0xffff ? 2 : 1;
  }
  if (!hasContent) throw unusableWhitespace(maximumBytes, runBytes);
};

/**
 * Builds the typed refusal for text that cannot become legal parts.
 *
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 * @param whitespaceRunBytes - Bytes in the run that made the text unusable.
 * @returns The error the loader turns into a per-file warning.
 */
const unusableWhitespace = (maximumBytes: number, whitespaceRunBytes: number): DistillyError =>
  new DistillyError({
    code: "context_too_large",
    message:
      "Parsed text contains a run of whitespace at least as long as one material, which cannot be split into legal parts.",
    retryable: false,
    fieldPath: "material.content",
    remediation: "Narrow the selected file and try again.",
    details: { maximumBytes, whitespaceRunBytes },
  });

/**
 * Moves a line-boundary cut forward over combining marks that begin the next line.
 *
 * @param text - Canonical text.
 * @param cursor - Index of the next line's first code point.
 * @param usedBytes - Bytes already in the closing part.
 * @param maximumBytes - Part byte ceiling.
 * @returns Index the closing part should end at.
 */
const extendOverMarks = (
  text: string,
  cursor: number,
  usedBytes: number,
  maximumBytes: number,
): number => {
  let end = cursor;
  let bytes = usedBytes;
  while (end < text.length) {
    const codePoint = text.codePointAt(end) ?? 0;
    if (!COMBINING_MARK.test(String.fromCodePoint(codePoint))) break;
    const width = utf8Width(codePoint);
    if (bytes + width > maximumBytes) break;
    bytes += width;
    end += codePoint > 0xffff ? 2 : 1;
  }
  return end;
};

/**
 * Chooses where a mid-line cut ends so the stored part equals the slice.
 *
 * The cut moves back while it would separate a base character from its combining marks or
 * leave spaces or tabs at the end of the part, which the engine would strip. It always keeps
 * at least one code point, so the scan advances even for pathological input; a whitespace run
 * longer than a part is refused before splitting rather than silently trimmed.
 *
 * @param text - Canonical text.
 * @param start - First index of the part.
 * @param end - Largest index that fits the byte ceiling.
 * @returns The chosen end index.
 */
const trimCut = (text: string, start: number, end: number): number => {
  let cut = end;
  while (cut > start) {
    const after = text.codePointAt(cut);
    const previousStart = previousCodePointStart(text, cut, start);
    const previous = text.codePointAt(previousStart) ?? 0;
    const detachesMark =
      after !== undefined &&
      COMBINING_MARK.test(String.fromCodePoint(after)) &&
      !COMBINING_MARK.test(String.fromCodePoint(previous));
    if (!detachesMark && !isHorizontalWhitespace(previous)) break;
    cut = previousStart;
  }
  return cut === start ? end : cut;
};

/**
 * Measures the UTF-8 byte width of one code point.
 *
 * A lone surrogate counts as its three-byte replacement character, which is what TextEncoder
 * writes for it.
 *
 * @param codePoint - Code point value from the source text.
 * @returns UTF-8 byte width, between one and four.
 */
const utf8Width = (codePoint: number): number => {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

/**
 * Counts the UTF-8 bytes of a slice without allocating a buffer.
 *
 * @param text - Source text.
 * @param start - First UTF-16 index of the slice.
 * @param end - Exclusive end of the slice.
 * @returns Exact UTF-8 byte length, matching TextEncoder.
 */
const utf8BytesIn = (text: string, start: number, end: number): number => {
  let bytes = 0;
  let index = start;
  while (index < end) {
    const codePoint = text.codePointAt(index) ?? 0;
    bytes += utf8Width(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes;
};

/**
 * Finds the start of the code point that ends at one index.
 *
 * @param text - Source text.
 * @param index - Exclusive end of the code point.
 * @param floor - Lowest index the search may return.
 * @returns UTF-16 index where that code point starts.
 */
const previousCodePointStart = (text: string, index: number, floor: number): number => {
  const previous = text.charCodeAt(index - 1);
  if (previous >= 0xdc00 && previous <= 0xdfff && index - 2 >= floor) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return index - 2;
  }
  return index - 1;
};
