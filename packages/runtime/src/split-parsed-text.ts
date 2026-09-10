/**
 * Splits one oversized parsed text into parts that each fit the local material byte limit.
 *
 * The text is first canonicalized exactly the way the engine canonicalizes stored material
 * (CRLF/CR to LF, NFC, trailing spaces and tabs before a line end removed), so a part is stored
 * unchanged and a mid-line cut cannot create a seam the engine would rewrite. Parts are then
 * consecutive slices of that canonical text: joining them with an empty string reproduces it,
 * no byte is added or dropped, and no part is empty.
 *
 * A cut prefers a line boundary. Only a single line that cannot fit in one part is cut inside
 * the line, at a Unicode code point boundary, never between a high and a low surrogate, never
 * immediately before a combining mark, and never where the part would end in spaces or tabs
 * that the engine would strip. The scan is linear in the text length, including for a single
 * line larger than the limit.
 *
 * @param text - Rendered material text.
 * @param maximumBytes - Largest UTF-8 byte length one part may have.
 * @returns One or more part texts, in order; no parts for empty text.
 */
export const splitParsedText = (text: string, maximumBytes: number): readonly string[] => {
  if (maximumBytes < 4) throw new Error("A part must be able to hold one code point.");
  const canonical = text
    .replace(/\r\n?/gu, "\n")
    .normalize("NFC")
    .replace(/[ \t]+(?=\n|$)/gu, "");
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
      const cut = trimCut(canonical, index, end, lineEnd, bytes);
      parts.push(canonical.slice(index, cut.end));
      index = cut.end;
    }
    partStart = index;
    cursor = index;
    partBytes = 0;
  }
  if (partBytes > 0) parts.push(canonical.slice(partStart));
  return parts;
};

/** Matches one combining mark, which must not be the first code point of a part. */
const COMBINING_MARK = /^\p{M}$/u;

/**
 * Largest number of code points a cut may move back to avoid a seam the engine would rewrite.
 *
 * The bound keeps the scan linear when a pathological line is one long run of combining marks
 * or spaces: past it the cut is taken as computed, which can leave a detached mark or a
 * stripped space in that one place instead of scanning the whole run again for every part.
 */
const MAXIMUM_CUT_BACKOFF = 32;

/** Matches the whitespace the engine strips at the end of a part. */
const TRIMMED_AT_PART_END = /^[ \t]$/u;

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
 * A part must not end in spaces or tabs (the engine strips them) and the next part must not
 * begin with a combining mark, but a part always keeps at least one code point so the scan
 * always advances.
 *
 * @param text - Canonical text.
 * @param start - First index of the part.
 * @param end - Largest index that fits the byte ceiling.
 * @param lineEnd - Exclusive end of the line being cut.
 * @param bytes - Byte length of the untrimmed slice.
 * @returns The chosen end index and its byte length.
 */
const trimCut = (
  text: string,
  start: number,
  end: number,
  lineEnd: number,
  bytes: number,
): { readonly end: number; readonly bytes: number } => {
  let trimmedEnd = end;
  let trimmedBytes = bytes;
  let steps = 0;
  while (trimmedEnd < lineEnd && trimmedEnd > start && steps < MAXIMUM_CUT_BACKOFF) {
    const next = text.codePointAt(trimmedEnd) ?? 0;
    const previousStart = previousCodePointStart(text, trimmedEnd, start);
    if (previousStart <= start) break;
    const previous = text.codePointAt(previousStart) ?? 0;
    const startsWithMark = COMBINING_MARK.test(String.fromCodePoint(next));
    const endsWithTrimmed = TRIMMED_AT_PART_END.test(String.fromCodePoint(previous));
    if (!startsWithMark && !endsWithTrimmed) break;
    trimmedEnd = previousStart;
    trimmedBytes -= utf8Width(previous);
    steps += 1;
  }
  return { end: trimmedEnd, bytes: trimmedBytes };
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
