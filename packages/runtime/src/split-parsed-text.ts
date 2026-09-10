/**
 * Splits one oversized parsed text into parts that each fit the local material byte limit.
 *
 * The split is byte-exact and deterministic: the parts are consecutive slices of the source,
 * so joining them with an empty string reproduces the source exactly, no byte is added or
 * dropped, and no part is empty. Cuts prefer a line boundary; only a single line that cannot
 * fit in one part is cut inside the line, at a Unicode code point boundary, never between a
 * high and a low surrogate and never immediately before a combining mark.
 *
 * @param text - Rendered material text.
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 * @returns One or more part texts, in order; no parts for empty text.
 */
export const splitParsedText = (text: string, maximumBytes: number): readonly string[] => {
  if (maximumBytes < 4) throw new Error("A part must be able to hold one code point.");
  const parts: string[] = [];
  let partStart = 0;
  let partBytes = 0;
  let cursor = 0;
  const pushPart = (end: number): void => {
    parts.push(text.slice(partStart, end));
    partStart = end;
    partBytes = 0;
  };
  while (cursor < text.length) {
    const newline = text.indexOf("\n", cursor);
    // A line keeps its own newline, so a cut after it loses nothing.
    const lineEnd = newline === -1 ? text.length : newline + 1;
    const lineBytes = utf8BytesIn(text, cursor, lineEnd);
    if (partBytes + lineBytes <= maximumBytes) {
      partBytes += lineBytes;
      cursor = lineEnd;
      continue;
    }
    if (lineBytes > maximumBytes) {
      // One line is larger than a whole part: fill the rest of this part by code point.
      let end = cursor;
      let bytes = partBytes;
      while (end < lineEnd) {
        const codePoint = text.codePointAt(end) ?? 0;
        const width = utf8Width(codePoint);
        if (bytes + width > maximumBytes) break;
        bytes += width;
        end += codePoint > 0xffff ? 2 : 1;
      }
      // A part must not begin with a combining mark, or the mark renders detached.
      while (end > cursor && end < lineEnd) {
        const next = text.codePointAt(end) ?? 0;
        if (!COMBINING_MARK.test(String.fromCodePoint(next))) break;
        const previousStart = previousCodePointStart(text, end, cursor);
        bytes -= utf8Width(text.codePointAt(previousStart) ?? 0);
        end = previousStart;
      }
      if (end > cursor) {
        cursor = end;
        partBytes = bytes;
      }
      // A part that is already full is flushed and the line continues in the next part.
      if (partBytes > 0) pushPart(cursor);
      continue;
    }
    // The line fits in an empty part, so this part ends here and the line starts the next one.
    pushPart(cursor);
  }
  if (partBytes > 0) parts.push(text.slice(partStart));
  return parts;
};

/** Matches one combining mark, which must not be the first code point of a part. */
const COMBINING_MARK = /^\p{M}$/u;

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
