/**
 * Detects and renders common chat-export JSON files as deterministic transcripts.
 *
 * A user who wants a person distilled usually already owns the conversation: ChatGPT, Claude,
 * Telegram, Slack, and Discord all export JSON. Those files are ordinary `application/json`,
 * so one detector has to tell them apart structurally instead of by file name, and the result
 * has to preserve every utterance exactly as written, because claims later quote this content.
 *
 * Rendering is deterministic for one input: conversations keep their file order, messages keep
 * their in-conversation order, and timestamps are normalized to UTC ISO text only when the
 * value carries an unambiguous instant.
 */

/** Chat-export shapes this module recognizes. */
export type ChatExportKind = "chatgpt" | "claude" | "discord" | "slack" | "telegram";

/** One rendered transcript plus what the renderer had to leave out. */
export interface ChatExportTranscript {
  readonly kind: ChatExportKind;
  readonly content: string;
  readonly participants: readonly string[];
  readonly conversationCount: number;
  readonly messageCount: number;
  readonly warnings: readonly string[];
}

/** One normalized utterance. */
interface TranscriptMessage {
  readonly speaker: string;
  readonly at?: string;
  readonly text: string;
}

/** One normalized conversation. */
interface TranscriptConversation {
  readonly title: string;
  readonly at?: string;
  readonly messages: readonly TranscriptMessage[];
}

/** Bounds one render so a giant export cannot exceed the parser's output budget. */
export interface ChatExportLimits {
  readonly maximumOutputBytes: number;
}

const encoder = new TextEncoder();

/**
 * Reports whether a JSON value is a non-null object with string keys.
 *
 * @param value - Candidate JSON value.
 * @returns True when the value can be read as a record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads an array element at one index without trusting the array's length.
 *
 * @param value - Candidate JSON value.
 * @returns The array, or undefined when the value is not an array.
 */
const asArray = (value: unknown): readonly unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

/**
 * Reads a non-empty string field.
 *
 * @param value - Candidate JSON value.
 * @returns The trimmed string, or undefined when it is absent or blank.
 */
const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

/**
 * Normalizes one exported timestamp to UTC ISO text when the instant is unambiguous.
 *
 * Epoch seconds (ChatGPT, Slack) and offset-bearing ISO text (Telegram, Discord, Claude)
 * describe one instant; a timezone-naive timestamp is kept verbatim rather than guessed at.
 *
 * @param value - Timestamp field from the export.
 * @returns ISO 8601 UTC text, the original offset-bearing text, or undefined.
 */
const normalizeInstant = (value: unknown): string | undefined => {
  const numeric = typeof value === "number" ? value : undefined;
  const text = numeric === undefined ? asText(value) : undefined;
  if (numeric !== undefined || (text !== undefined && /^\d+(?:\.\d+)?$/u.test(text))) {
    const seconds = numeric ?? Number(text);
    if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
    // A value past 1e11 cannot be a seconds epoch inside this century, so it is milliseconds.
    const milliseconds = seconds >= 1e11 ? seconds : seconds * 1000;
    return new Date(Math.round(milliseconds)).toISOString();
  }
  if (text === undefined) return undefined;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return undefined;
  // A timestamp without a zone is a local wall clock: keep it exactly as exported.
  return /(?:Z|[+-]\d{2}:?\d{2})$/u.test(text) ? new Date(parsed).toISOString() : text;
};

/**
 * Joins exported message parts into one utterance.
 *
 * ChatGPT stores text parts as a mixed array of strings and typed objects; Telegram stores
 * either a string or a list of entities. Anything unrecognized is skipped rather than
 * stringified, so no synthetic text can end up quoted as evidence.
 *
 * @param value - Message text field from the export.
 * @returns The joined text, or undefined when the field carries no text.
 */
const textFromParts = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.length === 0 ? undefined : value;
  const parts = asArray(value);
  if (parts === undefined) return undefined;
  const pieces: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      pieces.push(part);
      continue;
    }
    if (!isRecord(part)) continue;
    const text = asText(part["text"]);
    if (text !== undefined) pieces.push(text);
  }
  const joined = pieces.join("");
  return joined.length === 0 ? undefined : joined;
};

/** Reads the ordered message path of one ChatGPT conversation from its mapping tree. */
/**
 * Reads the text and speaker label of one ChatGPT content object.
 *
 * `model_editable_context` is the assistant's own bookkeeping and is never evidence. The
 * `user_editable_context` object carries the person's standing profile, instructions, and
 * memory, which is exactly the kind of statement a persona distillation needs, so it is kept
 * with a speaker label that shows where it came from instead of being dropped.
 *
 * @param content - Message content object from the export.
 * @returns Text plus an optional speaker suffix, or nothing when the object carries no text.
 */
const chatGptContent = (
  content: Record<string, unknown>,
): { readonly text?: string; readonly speakerSuffix?: string } => {
  const contentType = asText(content["content_type"]);
  if (contentType === "model_editable_context") return {};
  if (contentType === "user_editable_context") {
    const fields = ["user_profile", "user_instructions", "user_memory"]
      .map((key) => asText(content[key]))
      .filter((value): value is string => value !== undefined);
    return fields.length === 0 ? {} : { text: fields.join("\n\n"), speakerSuffix: " (profile)" };
  }
  const text = textFromParts(content["parts"]);
  return text === undefined ? {} : { text };
};

const chatGptPath = (
  mapping: Record<string, unknown>,
  currentNode: string | undefined,
): readonly string[] => {
  const end = currentNode !== undefined && isRecord(mapping[currentNode]) ? currentNode : undefined;
  if (end === undefined) return [];
  const order: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = end;
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor);
    const node: unknown = mapping[cursor];
    if (!isRecord(node)) break;
    order.push(cursor);
    const parent = node["parent"];
    cursor = typeof parent === "string" ? parent : undefined;
  }
  return order.reverse();
};

/**
 * Renders the conversations of one ChatGPT export along each conversation's current path.
 *
 * @param value - Parsed export value.
 * @returns Rendered conversations plus what was skipped.
 */
const readChatGpt = (
  value: unknown,
): { readonly conversations: readonly TranscriptConversation[]; readonly warnings: string[] } => {
  const warnings: string[] = [];
  const conversations: TranscriptConversation[] = [];
  if (!Array.isArray(value)) return { conversations, warnings };
  let skippedBranches = 0;
  let skippedMessages = 0;
  let attachments = 0;
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const mapping = entry["mapping"];
    if (!isRecord(mapping)) continue;
    const path = chatGptPath(mapping, asText(entry["current_node"]));
    if (path.length === 0) {
      skippedBranches += Object.keys(mapping).length;
      continue;
    }
    skippedBranches += Math.max(0, Object.keys(mapping).length - path.length);
    const messages: TranscriptMessage[] = [];
    for (const key of path) {
      const node: unknown = mapping[key];
      if (!isRecord(node)) continue;
      const message: unknown = node["message"];
      if (!isRecord(message)) continue;
      const author: unknown = message["author"];
      const role = isRecord(author) ? (asText(author["role"]) ?? "unknown") : "unknown";
      const content: unknown = message["content"];
      const read = isRecord(content) ? chatGptContent(content) : {};
      if (read.text === undefined) {
        const parts = isRecord(content) ? asArray(content["parts"]) : undefined;
        if (
          parts?.some(
            (part) =>
              isRecord(part) &&
              (asText(part["content_type"]) === "image_asset_pointer" ||
                asText(part["content_type"]) === "audio_asset_pointer"),
          ) === true
        ) {
          attachments += 1;
        }
        skippedMessages += 1;
        continue;
      }
      const at = normalizeInstant(message["create_time"]);
      messages.push({
        speaker: `${role}${read.speakerSuffix ?? ""}`,
        ...(at === undefined ? {} : { at }),
        text: read.text,
      });
    }
    const title = asText(entry["title"]) ?? "Untitled conversation";
    const at = normalizeInstant(entry["create_time"]);
    if (messages.length > 0)
      conversations.push({ title, ...(at === undefined ? {} : { at }), messages });
  }
  if (skippedBranches > 0) {
    warnings.push(
      `${String(skippedBranches)} message node(s) outside each conversation's current path were not included as evidence.`,
    );
  }
  if (skippedMessages > 0) {
    warnings.push(`${String(skippedMessages)} message(s) carried no text and were skipped.`);
  }
  if (attachments > 0) {
    warnings.push(`${String(attachments)} image or audio part(s) were not included as evidence.`);
  }
  return { conversations, warnings };
};

/**
 * Reads one array-of-conversations export that stores `chat_messages` per conversation.
 *
 * @param value - Parsed export value.
 * @returns Rendered conversations plus what was skipped.
 */
const readClaude = (
  value: unknown,
): { readonly conversations: readonly TranscriptConversation[]; readonly warnings: string[] } => {
  const warnings: string[] = [];
  const conversations: TranscriptConversation[] = [];
  if (!Array.isArray(value)) return { conversations, warnings };
  let skipped = 0;
  let attachments = 0;
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const rawMessages = asArray(entry["chat_messages"]);
    if (rawMessages === undefined) continue;
    const messages: TranscriptMessage[] = [];
    for (const raw of rawMessages) {
      if (!isRecord(raw)) continue;
      const text = asText(raw["text"]);
      attachments +=
        (asArray(raw["attachments"])?.length ?? 0) + (asArray(raw["files"])?.length ?? 0);
      if (text === undefined) {
        skipped += 1;
        continue;
      }
      const speaker = asText(raw["sender"]) ?? "unknown";
      const at = normalizeInstant(raw["created_at"]);
      messages.push({ speaker, ...(at === undefined ? {} : { at }), text });
    }
    if (messages.length === 0) continue;
    const title = asText(entry["name"]) ?? "Untitled conversation";
    const at = normalizeInstant(entry["created_at"]);
    conversations.push({ title, ...(at === undefined ? {} : { at }), messages });
  }
  if (skipped > 0) warnings.push(`${String(skipped)} message(s) carried no text and were skipped.`);
  if (attachments > 0) {
    warnings.push(`${String(attachments)} attachment(s) were not included as evidence.`);
  }
  return { conversations, warnings };
};

/**
 * Reads a Slack channel export, where each message carries `ts` and a user or bot name.
 *
 * @param value - Parsed export value.
 * @returns Rendered conversations plus what was skipped.
 */
const readSlack = (
  value: unknown,
): { readonly conversations: readonly TranscriptConversation[]; readonly warnings: string[] } => {
  const warnings: string[] = [];
  const rawMessages = isRecord(value) ? asArray(value["messages"]) : undefined;
  if (rawMessages === undefined) return { conversations: [], warnings };
  const messages: TranscriptMessage[] = [];
  let skipped = 0;
  let attachments = 0;
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    const text = asText(raw["text"]);
    attachments += asArray(raw["files"])?.length ?? 0;
    if (text === undefined) {
      skipped += 1;
      continue;
    }
    const speaker =
      asText(raw["username"]) ?? asText(raw["user"]) ?? asText(raw["bot_id"]) ?? "unknown";
    const at = normalizeInstant(raw["ts"]);
    messages.push({
      speaker,
      ...(at === undefined ? {} : { at }),
      text: decodeSlackEntities(text),
    });
  }
  if (skipped > 0) warnings.push(`${String(skipped)} message(s) carried no text and were skipped.`);
  if (attachments > 0) {
    warnings.push(`${String(attachments)} file(s) were not included as evidence.`);
  }
  const channel = isRecord(value) ? asText(value["channel"]) : undefined;
  const channelName = isRecord(value) ? asText(value["name"]) : undefined;
  if (messages.length === 0) return { conversations: [], warnings };
  return {
    conversations: [{ title: channelName ?? channel ?? "Slack conversation", messages }],
    warnings,
  };
};

/**
 * Reverses Slack's three XML entities so quoted text matches what the user typed.
 *
 * @param text - Raw Slack message text.
 * @returns Text with `&amp;`, `&lt;`, and `&gt;` decoded.
 */
const decodeSlackEntities = (text: string): string =>
  text.replace(/&(?:amp|lt|gt);/gu, (entity) => {
    if (entity === "&amp;") return "&";
    return entity === "&lt;" ? "<" : ">";
  });

/**
 * Reads a Telegram `result.json` export.
 *
 * @param value - Parsed export value.
 * @returns Rendered conversations plus what was skipped.
 */
const readTelegram = (
  value: unknown,
): { readonly conversations: readonly TranscriptConversation[]; readonly warnings: string[] } => {
  const warnings: string[] = [];
  const rawMessages = isRecord(value) ? asArray(value["messages"]) : undefined;
  if (rawMessages === undefined) return { conversations: [], warnings };
  const messages: TranscriptMessage[] = [];
  let skipped = 0;
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    if (asText(raw["type"]) !== undefined && asText(raw["type"]) !== "message") {
      skipped += 1;
      continue;
    }
    const text = textFromParts(raw["text"]);
    if (text === undefined) {
      skipped += 1;
      continue;
    }
    const speaker = asText(raw["from"]) ?? asText(raw["from_id"]) ?? "unknown";
    const at = normalizeInstant(raw["date"]);
    messages.push({ speaker, ...(at === undefined ? {} : { at }), text });
  }
  if (skipped > 0) {
    warnings.push(`${String(skipped)} non-message or textless entr(ies) were skipped.`);
  }
  if (messages.length === 0) return { conversations: [], warnings };
  const title = isRecord(value) ? (asText(value["name"]) ?? "Telegram chat") : "Telegram chat";
  return { conversations: [{ title, messages }], warnings };
};

/**
 * Reads a Discord export, including the DiscordChatExporter wrapper.
 *
 * @param value - Parsed export value.
 * @returns Rendered conversations plus what was skipped.
 */
const readDiscord = (
  value: unknown,
): { readonly conversations: readonly TranscriptConversation[]; readonly warnings: string[] } => {
  const warnings: string[] = [];
  if (!isRecord(value)) return { conversations: [], warnings };
  const rawMessages = asArray(value["messages"]);
  if (rawMessages === undefined) return { conversations: [], warnings };
  const messages: TranscriptMessage[] = [];
  let skipped = 0;
  let attachments = 0;
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    const author: unknown = raw["author"];
    const speaker = isRecord(author)
      ? (asText(author["nickname"]) ?? asText(author["name"]) ?? asText(author["id"]) ?? "unknown")
      : "unknown";
    attachments += asArray(raw["attachments"])?.length ?? 0;
    const text = asText(raw["content"]);
    if (text === undefined) {
      skipped += 1;
      continue;
    }
    const at = normalizeInstant(raw["timestamp"]);
    messages.push({ speaker, ...(at === undefined ? {} : { at }), text });
  }
  if (skipped > 0) warnings.push(`${String(skipped)} message(s) carried no text and were skipped.`);
  if (attachments > 0) {
    warnings.push(`${String(attachments)} attachment(s) were not included as evidence.`);
  }
  if (messages.length === 0) return { conversations: [], warnings };
  const channel: unknown = value["channel"];
  const title = isRecord(channel)
    ? (asText(channel["name"]) ?? asText(channel["id"]) ?? "Discord channel")
    : "Discord channel";
  return { conversations: [{ title, messages }], warnings };
};

/**
 * Identifies which chat export a JSON value is, using structure rather than file name.
 *
 * @param value - Parsed JSON value.
 * @returns The recognized export kind, or undefined for any other JSON document.
 */
export const detectChatExport = (value: unknown): ChatExportKind | undefined => {
  const entries = Array.isArray(value) ? value : [];
  if (
    entries.some((entry) => {
      if (!isRecord(entry) || !isRecord(entry["mapping"])) return false;
      // A ChatGPT export stores conversation nodes whose `message` carries an author and
      // content. Requiring one keeps a generic object with a `mapping` key out.
      return Object.values(entry["mapping"]).some(
        (node) => isRecord(node) && isRecord(node["message"]),
      );
    })
  ) {
    return "chatgpt";
  }
  if (entries.some((entry) => isRecord(entry) && asArray(entry["chat_messages"]) !== undefined)) {
    return "claude";
  }
  if (!isRecord(value)) return undefined;
  const messages = asArray(value["messages"]);
  if (messages === undefined) return undefined;
  if (
    messages.some(
      (message) =>
        isRecord(message) &&
        isRecord(message["author"]) &&
        (asText(message["content"]) !== undefined || asText(message["timestamp"]) !== undefined),
    )
  ) {
    return "discord";
  }
  if (
    messages.some(
      (message) =>
        isRecord(message) &&
        // Real Slack messages declare their type; an event log with `ts`, `user`, and `text`
        // does not, and treating one as a conversation would invent a person's words.
        asText(message["type"]) === "message" &&
        asText(message["ts"]) !== undefined &&
        (asText(message["user"]) !== undefined ||
          asText(message["username"]) !== undefined ||
          asText(message["bot_id"]) !== undefined),
    )
  ) {
    return "slack";
  }
  if (
    messages.some(
      (message) =>
        isRecord(message) &&
        // Telegram writes an ISO date, but a converted export can carry epoch seconds.
        (asText(message["date"]) !== undefined || typeof message["date"] === "number") &&
        (asText(message["from"]) !== undefined || asText(message["from_id"]) !== undefined),
    )
  ) {
    return "telegram";
  }
  return undefined;
};

/**
 * Renders one detected chat export as a transcript that keeps every utterance verbatim.
 *
 * @param kind - Detected export kind.
 * @param value - Parsed JSON value.
 * @param limits - Output byte budget, so a giant export stops with a visible warning.
 * @returns The transcript, its participants, and every omission the renderer made.
 */
export const renderChatExport = (
  kind: ChatExportKind,
  value: unknown,
  limits: ChatExportLimits,
): ChatExportTranscript => {
  const read =
    kind === "chatgpt"
      ? readChatGpt(value)
      : kind === "claude"
        ? readClaude(value)
        : kind === "slack"
          ? readSlack(value)
          : kind === "telegram"
            ? readTelegram(value)
            : readDiscord(value);
  const warnings = [...read.warnings];
  const header = HEADERS[kind];
  const lines: string[] = [header];
  const participants: string[] = [];
  let bytes = encoder.encode(`${header}\n`).byteLength;
  let messageCount = 0;
  let conversationCount = 0;
  let truncated = 0;
  let droppedParticipants = 0;
  for (const conversation of read.conversations) {
    if (bytes >= limits.maximumOutputBytes) {
      truncated += 1;
      continue;
    }
    const heading = `\n## ${conversation.title}${conversation.at === undefined ? "" : ` (${conversation.at})`}`;
    const headingBytes = encoder.encode(`${heading}\n`).byteLength;
    if (bytes + headingBytes > limits.maximumOutputBytes) {
      truncated += 1;
      continue;
    }
    lines.push(heading);
    bytes += headingBytes;
    conversationCount += 1;
    for (const message of conversation.messages) {
      const prefix =
        message.at === undefined
          ? `[unknown time] ${message.speaker}: `
          : `[${message.at}] ${message.speaker}: `;
      const rendered = `${prefix}${message.text}`;
      const renderedBytes = encoder.encode(`${rendered}\n`).byteLength;
      if (bytes + renderedBytes > limits.maximumOutputBytes) {
        truncated += 1;
        continue;
      }
      lines.push(rendered);
      bytes += renderedBytes;
      messageCount += 1;
      if (!participants.includes(message.speaker)) {
        if (participants.length < MAXIMUM_PARTICIPANTS) participants.push(message.speaker);
        else droppedParticipants += 1;
      }
    }
  }
  if (truncated > 0) {
    warnings.push(
      `${String(truncated)} conversation(s) or message(s) were left out to stay within the output limit.`,
    );
  }
  if (droppedParticipants > 0) {
    warnings.push(
      `${String(droppedParticipants)} further speaker(s) were not recorded because a material carries at most ${String(MAXIMUM_PARTICIPANTS)} participants.`,
    );
  }
  return {
    kind,
    content: `${lines.join("\n")}\n`,
    participants,
    conversationCount,
    messageCount,
    warnings,
  };
};

/** Most participants one material may carry, matching the engine's own participant bound. */
const MAXIMUM_PARTICIPANTS = 64;

/** First line written for each recognized export. */
const HEADERS: Readonly<Record<ChatExportKind, string>> = Object.freeze({
  chatgpt: "# ChatGPT conversation export",
  claude: "# Claude conversation export",
  slack: "# Slack conversation export",
  telegram: "# Telegram conversation export",
  discord: "# Discord conversation export",
});
