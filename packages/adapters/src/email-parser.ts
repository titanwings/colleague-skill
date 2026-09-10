import { DistillyError } from "@distilly/protocol";

/** One decoded message extracted from an RFC 5322 message or an mbox mailbox. */
export interface ParsedEmailMessage {
  readonly from?: string;
  readonly to?: string;
  readonly cc?: string;
  readonly date?: string;
  readonly subject?: string;
  readonly body: string;
}

/** Decoded mailbox ready for deterministic rendering. */
export interface ParsedEmail {
  readonly messages: readonly ParsedEmailMessage[];
  readonly skippedAttachments: number;
  readonly undecodableParts: number;
}

/** Maximum multipart nesting depth before the source is rejected as unrepresentable. */
const MAXIMUM_NESTING = 16;

/** Media type families that never carry distillable human text. */
const BINARY_MEDIA_PREFIXES = Object.freeze([
  "application/",
  "audio/",
  "image/",
  "video/",
  "font/",
  "model/",
]);

const invalidInput = (message: string, fieldPath?: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message,
    retryable: false,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });

const HEADER_LINE = /^([!-9;-~]+):\s*(.*)$/u;
/**
 * Splits an mbox `from_` line into its sender token and the remainder.
 *
 * Writers format the date as ctime, RFC 2822, ISO 8601, epoch seconds, or omit it, and
 * ctime pads single-digit days with a second space. Matching one date shape would
 * silently merge every message written in another shape, so the rule keeps the sender
 * token and the remainder and lets the caller judge the remainder instead.
 */
const MBOX_SEPARATOR = /^From (\S+)(?: (.*))?$/u;

/**
 * Maps bytes to a code-point-preserving string so structural scanning never confuses a
 * part's raw bytes with a decoded charset.
 *
 * Chunked to avoid an argument-count limit on large mailboxes.
 *
 * @param bytes - Raw source bytes.
 * @returns One character per byte, each in U+0000–U+00FF.
 */
const bytesToBinaryString = (bytes: Uint8Array): string => {
  const chunk = 8192;
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + chunk)));
  }
  return parts.join("");
};

/**
 * Reverses {@link bytesToBinaryString} for one part body.
 *
 * @param text - Binary string produced from bytes.
 * @returns The original bytes.
 */
const binaryStringToBytes = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
};

/**
 * Reports whether decoded text carries control characters that prose never uses.
 *
 * The check runs on decoded text, not raw bytes, so an encoding that legitimately embeds
 * control bytes (ISO-2022-JP escapes, UTF-16 NULs) is judged by what it decodes to.
 *
 * @param text - Decoded candidate text.
 * @returns True when the payload looks binary.
 */
const looksBinary = (text: string): boolean => {
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c || code === 0x0b) {
      continue;
    }
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

/**
 * Decodes one part body with its declared charset, then deterministic fallbacks.
 *
 * Valid multi-byte UTF-8 wins over a declaration only when that declaration is one of
 * the labels senders routinely apply to UTF-8 by mistake. A specific legacy declaration
 * such as shift_jis or gb18030 is honoured first, because those encodings have byte
 * pairs that are also valid UTF-8 and guessing UTF-8 there would corrupt them.
 *
 * @param bytes - Raw part bytes after transfer decoding.
 * @param charset - Declared charset name, if any.
 * @returns Decoded text, or undefined when no candidate decoder exists.
 */
const COMMON_UTF8_MISLABELS = new Set([
  "",
  "ascii",
  "charset",
  "cp1252",
  "default",
  "iso-8859-1",
  "latin-1",
  "latin1",
  "unknown-8bit",
  "us-ascii",
  "utf-8",
  "utf8",
  "windows-1252",
  "x-unknown",
]);

const decodeCharset = (bytes: Uint8Array, charset: string | undefined): string | undefined => {
  const label = (charset ?? "utf-8").trim().toLowerCase().replaceAll('"', "");
  if (COMMON_UTF8_MISLABELS.has(label) && bytes.some((byte) => byte >= 0x80)) {
    try {
      const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if ([...utf8].some((character) => character.codePointAt(0)! > 0x7f)) return utf8;
    } catch {
      // Not UTF-8, so the declared charset decides.
    }
  }
  const candidates = [...new Set([label, "utf-8", "windows-1252"])].filter(
    (candidate) => candidate.length > 0,
  );
  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate, { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
  }
  return undefined;
};

const fromBase64 = (value: string): Uint8Array | undefined => {
  const cleaned = value.replaceAll(/\s/gu, "");
  if (cleaned.length === 0) return new Uint8Array();
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(cleaned)) return undefined;
  return Uint8Array.from(Buffer.from(cleaned, "base64"));
};

const fromQuotedPrintable = (value: string): Uint8Array => {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "=") {
      const next = value[index + 1];
      if (next === "\n") {
        index += 1;
        continue;
      }
      if (next === "\r" && value[index + 2] === "\n") {
        index += 2;
        continue;
      }
      const hex = value.slice(index + 1, index + 3);
      if (/^[0-9A-Fa-f]{2}$/u.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
      bytes.push(0x3d);
      continue;
    }
    bytes.push(character.charCodeAt(0) & 0xff);
  }
  return Uint8Array.from(bytes);
};

/**
 * Decodes RFC 2047 encoded words inside a header value.
 *
 * Whitespace between two adjacent encoded words is not part of the value, so it is
 * removed instead of surviving as a visible separator.
 *
 * @param value - Raw header value.
 * @returns Header text with encoded words decoded, or the input when malformed.
 */
const decodeHeaderWords = (value: string): string =>
  value
    // Whitespace between two adjacent encoded words is not part of the value, so it is
    // collapsed before decoding rather than left as a visible separator.
    .replaceAll(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?)/gu, "$1")
    .replaceAll(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/gu,
      (match, charset: string, encoding: string, payload: string) => {
        const bytes =
          encoding.toUpperCase() === "B"
            ? fromBase64(payload)
            : fromQuotedPrintable(payload.replaceAll("_", " "));
        if (bytes === undefined) return match;
        return decodeCharset(bytes, charset) ?? match;
      },
    );

/**
 * Removes `script` and `style` element regions in one linear pass.
 *
 * A back-reference regular expression is quadratic when a document holds many openers and
 * no closer, and re-searching for a closer each time is quadratic for the same reason, so
 * each tag type searches for its closer at most once: the first failed search proves no
 * closer remains anywhere, and later openers then drop only their own tag. Short slices
 * are compared instead of lowercasing the document, because lowercasing can change a
 * string's length and misalign every later index.
 *
 * @param html - Raw HTML text.
 * @returns HTML with script and style regions removed.
 */
const removeScriptAndStyle = (html: string): string => {
  const noCloserLeft: Record<"script" | "style", boolean> = { script: false, style: false };
  let result = "";
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open === -1) return result + html.slice(index);
    const head = html.slice(open, open + 9).toLowerCase();
    const tag: "script" | "style" | "" = head.startsWith("<script")
      ? "script"
      : head.startsWith("<style")
        ? "style"
        : "";
    if (tag === "") {
      result += html.slice(index, open + 1);
      index = open + 1;
      continue;
    }
    const closeTag = `</${tag}`;
    let close = -1;
    if (!noCloserLeft[tag]) {
      let cursor = open + tag.length + 1;
      for (;;) {
        const candidate = html.indexOf("<", cursor);
        if (candidate === -1) break;
        if (html.slice(candidate, candidate + closeTag.length).toLowerCase() === closeTag) {
          close = candidate;
          break;
        }
        cursor = candidate + 1;
      }
      if (close === -1) noCloserLeft[tag] = true;
    }
    result += html.slice(index, open);
    if (close === -1) {
      // No closer anywhere, so only the opener tag is markup; trailing prose survives.
      const openerEnd = html.indexOf(">", open);
      if (openerEnd === -1) return result;
      index = openerEnd + 1;
      continue;
    }
    const closerEnd = html.indexOf(">", close);
    index = closerEnd === -1 ? html.length : closerEnd + 1;
  }
  return result;
};

/**
 * Removes HTML comments in one linear pass.
 *
 * @param html - Raw HTML text.
 * @returns HTML with comment regions removed.
 */
const removeComments = (html: string): string => {
  let result = "";
  let index = 0;
  for (;;) {
    const start = html.indexOf("<!--", index);
    if (start === -1) return result + html.slice(index);
    result += html.slice(index, start);
    const end = html.indexOf("-->", start + 4);
    if (end === -1) return result;
    index = end + 3;
  }
};

/** Element names recognized as markup, so prose angle brackets are never removed. */
const HTML_TAGS =
  /<\/?(?:a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|big|blink|blockquote|body|br|button|canvas|caption|center|cite|code|col|colgroup|dd|del|details|dfn|dialog|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|h[1-6]|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|marquee|menu|meta|meter|nav|nobr|noscript|object|ol|optgroup|option|output|p|param|picture|pre|progress|q|rp|rt|ruby|s|samp|section|select|slot|small|source|span|strike|strong|sub|summary|sup|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video|wbr)\b[^<>]*>/giu;

const decodeNumericEntities = (text: string): string =>
  text
    .replaceAll(/&#(\d+);/gu, (match, code: string) => {
      const value = Number.parseInt(code, 10);
      return value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    })
    .replaceAll(/&#[xX]([0-9A-Fa-f]+);/gu, (match, code: string) => {
      const value = Number.parseInt(code, 16);
      return value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    });

const stripHtml = (html: string): string =>
  decodeNumericEntities(
    removeComments(removeScriptAndStyle(html))
      .replaceAll(/<br\s*\/?>/giu, "\n")
      .replaceAll(/<\/(p|div|tr|li|h[1-6])>/giu, "\n")
      .replaceAll(HTML_TAGS, " "),
  )
    .replaceAll(/&nbsp;/giu, " ")
    .replaceAll(/&lt;/giu, "<")
    .replaceAll(/&gt;/giu, ">")
    .replaceAll(/&quot;/giu, '"')
    .replaceAll(/&#39;|&apos;/giu, "'")
    .replaceAll(/&amp;/giu, "&");

/**
 * Reports whether text has at least one visible character.
 *
 * @param text - Candidate text.
 * @returns True when something other than whitespace or formatting characters remains.
 */
const hasVisibleText = (text: string): boolean =>
  text.replaceAll(/\s/gu, "").replaceAll(/\p{Cf}/gu, "").length > 0;

const normalizeLines = (text: string): string =>
  text
    .split(/\r\n|\r|\n/u)
    .map((line) => line.replaceAll(/[ \t]+/gu, " ").replaceAll(/^ +| +$/gu, ""))
    .join("\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .replaceAll(/^\n+|\n+$/gu, "");

/**
 * Decodes a raw (non-RFC-2047) header value that carries 8-bit bytes.
 *
 * A header is otherwise a byte-preserving string, so an unencoded UTF-8 subject would
 * surface as mojibake. ASCII values take the fast path unchanged.
 *
 * @param value - Raw header value as a byte-preserving string.
 * @returns The decoded value, or the input when it is already ASCII or undecodable.
 */
const decodeRawHeaderValue = (value: string): string => {
  if (![...value].some((character) => character.codePointAt(0)! > 0x7f)) return value;
  return decodeCharset(binaryStringToBytes(value), undefined) ?? value;
};

interface HeaderBlock {
  readonly headers: ReadonlyMap<string, string>;
  readonly bodyStart: number;
}

/**
 * Splits an entity into its unfolded header map and the offset where its body starts.
 *
 * Leading blank lines are skipped so a message whose first header is indented still
 * yields its headers instead of silently losing them.
 *
 * @param text - Entity text including headers.
 * @returns Header map plus body offset, or undefined when the entity has no header block.
 */
const readHeaders = (text: string): HeaderBlock | undefined => {
  const leading = /^(?:[ \t]*\r?\n)+/u.exec(text);
  const trimOffset = leading === null ? 0 : leading[0].length;
  const trimmed = text.slice(trimOffset);
  const separator = /\r\n\r\n|\n\n|\r\r|\r\n\n|\n\r\n/u.exec(trimmed);
  if (separator === null) return undefined;
  const unfolded = trimmed.slice(0, separator.index).replaceAll(/\r?\n[ \t]+/gu, " ");
  const headers = new Map<string, string>();
  for (const line of unfolded.split(/\r\n|\r|\n/u)) {
    const match = HEADER_LINE.exec(line.trimStart());
    if (match === null) continue;
    const name = match[1]!.toLowerCase();
    const value = decodeRawHeaderValue(match[2]!.trim());
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return { headers, bodyStart: trimOffset + separator.index + separator[0].length };
};

const parameter = (value: string | undefined, name: string): string | undefined => {
  if (value === undefined) return undefined;
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*("[^"]*"|[^;\\s]+)`, "iu");
  const match = pattern.exec(value);
  if (match === null) return undefined;
  return match[1]!.trim().replaceAll(/^"|"$/gu, "");
};

const mediaTypeOf = (value: string): string =>
  (value.split(";")[0] ?? "text/plain").trim().toLowerCase() || "text/plain";

const isBinaryMediaType = (mediaType: string | undefined): boolean => {
  if (mediaType === undefined) return false;
  if (mediaType.startsWith("text/") || mediaType === "message/rfc822") return false;
  return (
    BINARY_MEDIA_PREFIXES.some((prefix) => mediaType.startsWith(prefix)) ||
    mediaType !== "text/plain"
  );
};

interface MimePart {
  readonly mediaType?: string;
  readonly charset?: string;
  readonly encoding: string;
  readonly boundary?: string;
  readonly isAttachment: boolean;
  readonly body: string;
}

const parseEntity = (text: string): MimePart | undefined => {
  const header = readHeaders(text);
  if (header === undefined) return undefined;
  const contentType = header.headers.get("content-type");
  const declaration = contentType === undefined ? undefined : mediaTypeOf(contentType);
  const charset = parameter(contentType, "charset");
  const boundary = parameter(contentType, "boundary");
  const disposition = header.headers.get("content-disposition");
  const isAttachment =
    disposition !== undefined &&
    /^\s*attachment\b/iu.test(disposition) &&
    declaration !== undefined &&
    !declaration.startsWith("multipart/");
  return {
    ...(declaration === undefined ? {} : { mediaType: declaration }),
    ...(charset === undefined ? {} : { charset }),
    encoding: (header.headers.get("content-transfer-encoding") ?? "7bit").trim().toLowerCase(),
    ...(boundary === undefined ? {} : { boundary }),
    isAttachment,
    body: text.slice(header.bodyStart),
  };
};

const decodePartBytes = (part: MimePart): Uint8Array | undefined => {
  if (part.encoding === "base64") return fromBase64(part.body);
  if (part.encoding === "quoted-printable") return fromQuotedPrintable(part.body);
  if (["7bit", "8bit", "binary", ""].includes(part.encoding)) {
    return binaryStringToBytes(part.body);
  }
  return undefined;
};

const splitParts = (body: string, boundary: string): readonly string[] => {
  const delimiter = `--${boundary}`;
  const segments: string[] = [];
  let current: string[] | undefined;
  for (const line of body.split(/\r\n|\r|\n/u)) {
    // RFC 2046 allows transport padding (whitespace) after the delimiter.
    const trimmed = line.replaceAll(/[ \t]+$/gu, "");
    if (trimmed === delimiter || trimmed === `${delimiter}--`) {
      if (current !== undefined) segments.push(current.join("\n"));
      current = trimmed === `${delimiter}--` ? undefined : [];
      continue;
    }
    current?.push(line);
  }
  if (current !== undefined) segments.push(current.join("\n"));
  return segments;
};

/**
 * Keeps the first alternative that carries visible text, so an empty one cannot win.
 *
 * @param current - Alternative already chosen, if any.
 * @param candidate - New alternative to consider.
 * @returns The alternative to keep.
 */
const pickText = (current: string | undefined, candidate: string): string | undefined => {
  if (current !== undefined && hasVisibleText(current)) return current;
  return hasVisibleText(candidate) ? candidate : current;
};

interface CollectedBody {
  readonly text?: string;
  readonly html?: string;
  readonly skippedAttachments: number;
  readonly undecodableParts: number;
  readonly depthExceeded: boolean;
}

const collectBody = (part: MimePart, depth: number): CollectedBody => {
  if (depth >= MAXIMUM_NESTING) {
    return { skippedAttachments: 0, undecodableParts: 0, depthExceeded: true };
  }
  const declaration = part.mediaType;
  if (declaration !== undefined && declaration.startsWith("multipart/")) {
    if (part.boundary === undefined || part.boundary.length === 0) {
      return { skippedAttachments: 0, undecodableParts: 1, depthExceeded: false };
    }
    let text: string | undefined;
    let html: string | undefined;
    let skippedAttachments = 0;
    let undecodableParts = 0;
    let depthExceeded = false;
    for (const segment of splitParts(part.body, part.boundary)) {
      if (segment.trim().length === 0) continue;
      // A segment that opens with a header line but never terminates its header block is
      // an empty-bodied part, not prose. Rendering its headers as the body would publish
      // "Content-Type: ..." as evidence and hide a readable alternative.
      const firstLine = segment.trimStart().split(/\r?\n/u, 1)[0] ?? "";
      if (parseEntity(segment) === undefined && HEADER_LINE.test(firstLine)) {
        undecodableParts += 1;
        continue;
      }
      const nested = parseEntity(segment) ?? {
        // A part with no header block at all still carries bytes; treat it as an untyped
        // body so the binary sniff can reject it instead of dropping it silently.
        encoding: "7bit",
        isAttachment: false,
        body: segment,
      };
      if (nested.isAttachment) {
        skippedAttachments += 1;
        continue;
      }
      if (nested.mediaType?.startsWith("multipart/") === true) {
        const inner = collectBody(nested, depth + 1);
        text = pickText(text, inner.text ?? "");
        html ??= inner.html;
        skippedAttachments += inner.skippedAttachments;
        undecodableParts += inner.undecodableParts;
        depthExceeded ||= inner.depthExceeded;
        continue;
      }
      if (isBinaryMediaType(nested.mediaType)) {
        skippedAttachments += 1;
        continue;
      }
      const bytes = decodePartBytes(nested);
      if (bytes === undefined) {
        undecodableParts += 1;
        continue;
      }
      const decoded = decodeCharset(bytes, nested.charset);
      if (decoded === undefined) {
        undecodableParts += 1;
        continue;
      }
      // A text declaration does not make content textual, so control characters that
      // survive decoding are never evidence.
      if (looksBinary(decoded)) {
        skippedAttachments += 1;
        continue;
      }
      if (nested.mediaType === "text/html") {
        html = pickText(html, decoded);
      } else {
        text = pickText(text, decoded);
      }
    }
    return {
      ...(text === undefined ? {} : { text }),
      ...(html === undefined ? {} : { html }),
      skippedAttachments,
      undecodableParts,
      depthExceeded,
    };
  }
  if (part.isAttachment) {
    return { skippedAttachments: 1, undecodableParts: 0, depthExceeded: false };
  }
  if (isBinaryMediaType(declaration)) {
    return { skippedAttachments: 1, undecodableParts: 0, depthExceeded: false };
  }
  const bytes = decodePartBytes(part);
  if (bytes === undefined) {
    return { skippedAttachments: 0, undecodableParts: 1, depthExceeded: false };
  }
  const decoded = decodeCharset(bytes, part.charset);
  if (decoded === undefined) {
    return { skippedAttachments: 0, undecodableParts: 1, depthExceeded: false };
  }
  if (looksBinary(decoded)) {
    return { skippedAttachments: 1, undecodableParts: 0, depthExceeded: false };
  }
  return declaration === "text/html"
    ? { html: decoded, skippedAttachments: 0, undecodableParts: 0, depthExceeded: false }
    : { text: decoded, skippedAttachments: 0, undecodableParts: 0, depthExceeded: false };
};

const renderMessage = (
  headers: ReadonlyMap<string, string>,
  collected: CollectedBody,
): string | undefined => {
  const plain = collected.text;
  const fromHtml = collected.html === undefined ? undefined : stripHtml(collected.html);
  const chosen =
    plain !== undefined && hasVisibleText(plain)
      ? plain
      : fromHtml !== undefined && hasVisibleText(fromHtml)
        ? fromHtml
        : undefined;
  if (chosen === undefined) return undefined;
  const body = normalizeLines(chosen);
  if (!hasVisibleText(body)) return undefined;
  const lines: string[] = [];
  const push = (label: string, value: string | undefined): void => {
    if (value !== undefined && value.trim().length > 0) lines.push(`${label}: ${value.trim()}`);
  };
  push("From", decodeHeaderWords(headers.get("from") ?? ""));
  push("To", decodeHeaderWords(headers.get("to") ?? ""));
  push("Cc", decodeHeaderWords(headers.get("cc") ?? ""));
  push("Date", headers.get("date"));
  push("Subject", decodeHeaderWords(headers.get("subject") ?? ""));
  lines.push("", body);
  return lines.join("\n");
};

const splitMailbox = (text: string): readonly string[] => {
  const messages: string[] = [];
  let current: string[] | undefined;
  let sawSeparator = false;
  for (const line of text.split(/\r\n|\r|\n/u)) {
    const isFirst = !sawSeparator && current === undefined;
    const separator = MBOX_SEPARATOR.exec(line);
    // A separator has either no remainder or a date-like remainder carrying a digit, so
    // every writer's date format separates while prose ("From now on ...") and an address
    // in a quotation ("From alice@example.com wrote:") stay body text.
    const remainder = separator?.[2];
    const isSeparator = separator !== null && (remainder === undefined || /\d/u.test(remainder));
    if (line.startsWith("From ") && (isFirst || isSeparator)) {
      if (current !== undefined) messages.push(current.join("\n"));
      current = [];
      sawSeparator = true;
      continue;
    }
    current?.push(line);
  }
  if (current !== undefined) messages.push(current.join("\n"));
  return messages;
};

/**
 * Parses one RFC 5322 message, or a whole mbox mailbox, into decoded messages.
 *
 * Structural scanning works on the raw bytes so each part is decoded with the charset it
 * declares; decoding the container first would double-decode 8-bit bodies.
 *
 * @param bytes - Raw source bytes.
 * @param mbox - Whether to split the input on mbox `From ` separator lines.
 * @returns Decoded messages plus counts of what could not become text.
 */
export const parseEmailMessages = (bytes: Uint8Array, mbox: boolean): ParsedEmail => {
  const text = bytesToBinaryString(bytes);
  const sources = mbox ? splitMailbox(text) : [text];
  const messages: ParsedEmailMessage[] = [];
  let skippedAttachments = 0;
  let undecodableParts = 0;
  let depthExceeded = false;
  for (const source of sources) {
    if (source.trim().length === 0) continue;
    const header = readHeaders(source);
    const entity = parseEntity(source);
    if (header === undefined || entity === undefined) {
      undecodableParts += 1;
      continue;
    }
    const collected = collectBody(entity, 0);
    skippedAttachments += collected.skippedAttachments;
    undecodableParts += collected.undecodableParts;
    depthExceeded ||= collected.depthExceeded;
    const body = renderMessage(header.headers, collected);
    if (body === undefined) continue;
    const value = (name: string): string | undefined => {
      const raw = header.headers.get(name);
      return raw === undefined ? undefined : decodeHeaderWords(raw);
    };
    messages.push({
      ...(value("from") === undefined ? {} : { from: value("from")! }),
      ...(value("to") === undefined ? {} : { to: value("to")! }),
      ...(value("cc") === undefined ? {} : { cc: value("cc")! }),
      ...(header.headers.get("date") === undefined ? {} : { date: header.headers.get("date")! }),
      ...(value("subject") === undefined ? {} : { subject: value("subject")! }),
      body,
    });
  }
  if (depthExceeded) {
    throw invalidInput(
      `The mail source nests more than ${MAXIMUM_NESTING} multipart levels, which cannot be represented as text.`,
    );
  }
  if (messages.length === 0) {
    throw invalidInput("The mail source did not contain a decodable message.");
  }
  return { messages, skippedAttachments, undecodableParts };
};
