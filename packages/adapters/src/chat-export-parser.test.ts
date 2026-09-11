import { describe, expect, it } from "vitest";

import { createBuiltinParserRegistry } from "./builtin-parsers.js";
import { detectChatExport, renderChatExport } from "./chat-export-parser.js";

import type { ParseContext, RawMaterial } from "./contracts.js";
import type { IsoDateTime, RequestId, SubjectId } from "@distilly/protocol";

const context: ParseContext = {
  subjectId: `subject_${"a".repeat(32)}` as SubjectId,
  requestId: `req_${"b".repeat(32)}` as RequestId,
  maximumOutputBytes: 32 * 1024 * 1024,
};

const raw = (value: unknown, name = "export.json"): RawMaterial => ({
  clientRef: name,
  mediaType: "application/json",
  bytes: new TextEncoder().encode(JSON.stringify(value)),
  source: {
    medium: "document",
    access: "private",
    capturedAt: "2026-09-11T00:00:00.000Z" as IsoDateTime,
    title: name,
  },
});

const chatGptExport = [
  {
    title: "Rollback review",
    create_time: 1_772_000_000.5,
    current_node: "n3",
    mapping: {
      n1: {
        id: "n1",
        parent: null,
        message: {
          author: { role: "user" },
          create_time: 1_772_000_000.5,
          content: { content_type: "text", parts: ["What breaks first if we ship this?"] },
        },
      },
      n2: {
        id: "n2",
        parent: "n1",
        message: {
          author: { role: "assistant" },
          create_time: 1_772_000_001.5,
          content: {
            content_type: "text",
            parts: ["The cache key.\nThen the retry budget."],
          },
        },
      },
      n2branch: {
        id: "n2branch",
        parent: "n1",
        message: {
          author: { role: "assistant" },
          create_time: 1_772_000_002.5,
          content: { content_type: "text", parts: ["THIS BRANCH WAS NOT CHOSEN"] },
        },
      },
      n3: {
        id: "n3",
        parent: "n2",
        message: {
          author: { role: "user" },
          create_time: 1_772_000_003.5,
          content: {
            content_type: "user_editable_context",
            user_profile: "Ada ships behind a rollback plan.",
            user_instructions: "Answer with the failure mode first.",
          },
        },
      },
      n4: {
        id: "n4",
        parent: "n3",
        message: {
          author: { role: "assistant" },
          create_time: 1_772_000_004.5,
          content: { content_type: "model_editable_context", parts: ["assistant bookkeeping"] },
        },
      },
    },
  },
];

const claudeExport = [
  {
    uuid: "c1",
    name: "Compiler debugging",
    created_at: "2026-03-05T10:00:00.000Z",
    chat_messages: [
      { sender: "human", created_at: "2026-03-05T10:00:01.000Z", text: "Read the listing." },
      {
        sender: "assistant",
        created_at: "2026-03-05T10:00:02.000Z",
        text: "Line 42 shifts early.",
      },
      { sender: "assistant", text: "" },
    ],
  },
];

const telegramExport = {
  name: "Ada and Grace",
  type: "personal_chat",
  messages: [
    { type: "message", from: "Ada", date: "2026-03-05T10:00:00+01:00", text: "Ship it." },
    {
      type: "message",
      from: "Grace",
      date: "2026-03-05T10:00:05+01:00",
      text: [
        { type: "bold", text: "No" },
        { type: "plain", text: ", not yet." },
      ],
    },
    { type: "service", from: "Ada", date: "2026-03-05T10:00:06+01:00", text: "joined" },
  ],
};

const slackExport = {
  channel: "C0123",
  name: "design",
  messages: [
    { type: "message", user: "U1", ts: "1772000000.000100", text: "rollback &amp; retry" },
    { type: "message", username: "grace", ts: "1772000060.000200", text: "agreed" },
    { type: "message", subtype: "channel_join", user: "U2", ts: "1772000120.000300" },
  ],
};

const discordExport = {
  channel: { id: "99", name: "incidents" },
  messages: [
    {
      author: { id: "1", name: "ada", nickname: "Ada" },
      timestamp: "2026-03-05T10:00:00+00:00",
      content: "The failure mode was a cache key.",
      attachments: [{ url: "https://example.test/a.png" }],
    },
    { author: { id: "2", name: "grace" }, timestamp: "2026-03-05T10:00:30+00:00", content: "" },
  ],
};

describe("chat export detection", () => {
  it("recognizes each supported export structurally", () => {
    expect(detectChatExport(chatGptExport)).toBe("chatgpt");
    expect(detectChatExport(claudeExport)).toBe("claude");
    expect(detectChatExport(telegramExport)).toBe("telegram");
    expect(detectChatExport(slackExport)).toBe("slack");
    expect(detectChatExport(discordExport)).toBe("discord");
  });

  it("leaves any other JSON document alone", () => {
    expect(detectChatExport({ items: [{ id: 1 }] })).toBeUndefined();
    expect(detectChatExport([{ id: 1, name: "x" }])).toBeUndefined();
    expect(detectChatExport({ messages: [{ text: "no speaker" }] })).toBeUndefined();
    // An application event log carries ts/user/text but is not a Slack conversation.
    expect(
      detectChatExport({
        messages: [{ ts: "1714564800.5", user: "worker-1", text: "JOB_STARTED" }],
      }),
    ).toBeUndefined();
    // An object with a mapping key is not a ChatGPT export without message nodes.
    expect(detectChatExport([{ mapping: { a: 1 }, title: "de" }])).toBeUndefined();
    expect(detectChatExport("string")).toBeUndefined();
    expect(detectChatExport(undefined)).toBeUndefined();
  });

  it("recognizes an export whose dates are epoch numbers", () => {
    expect(
      detectChatExport({
        name: "converted",
        messages: [{ type: "message", from: "Ada", date: 1_772_000_000, text: "Ship it." }],
      }),
    ).toBe("telegram");
  });
});

describe("chat export rendering", () => {
  it("renders only the current ChatGPT path and keeps message text verbatim", () => {
    const transcript = renderChatExport("chatgpt", chatGptExport, {
      maximumOutputBytes: 1_000_000,
    });
    expect(transcript.content).toContain("# ChatGPT conversation export");
    expect(transcript.content).toContain("## Rollback review (2026-02-25T06:13:20.500Z)");
    expect(transcript.content).toContain(
      "[2026-02-25T06:13:20.500Z] user: What breaks first if we ship this?",
    );
    expect(transcript.content).toContain("assistant: The cache key.\nThen the retry budget.");
    expect(transcript.content).toContain("user (profile): Ada ships behind a rollback plan.");
    expect(transcript.content).toContain("Answer with the failure mode first.");
    expect(transcript.content).not.toContain("THIS BRANCH WAS NOT CHOSEN");
    expect(transcript.content).not.toContain("assistant bookkeeping");
    expect(transcript.participants).toEqual(["user", "assistant", "user (profile)"]);
    expect(transcript.messageCount).toBe(3);
    expect(transcript.warnings.join(" ")).toContain("outside each conversation's current path");
  });

  it("renders Claude, Telegram, Slack, and Discord exports with normalized times", () => {
    const claude = renderChatExport("claude", claudeExport, { maximumOutputBytes: 1_000_000 });
    expect(claude.content).toContain("[2026-03-05T10:00:01.000Z] human: Read the listing.");
    expect(claude.warnings.join(" ")).toContain("1 message(s) carried no text");

    const telegram = renderChatExport("telegram", telegramExport, {
      maximumOutputBytes: 1_000_000,
    });
    expect(telegram.content).toContain("[2026-03-05T09:00:05.000Z] Grace: No, not yet.");
    expect(telegram.content).toContain("[2026-03-05T09:00:00.000Z] Ada: Ship it.");
    expect(telegram.warnings.join(" ")).toContain("non-message or textless");

    const slack = renderChatExport("slack", slackExport, { maximumOutputBytes: 1_000_000 });
    expect(slack.content).toContain("rollback & retry");
    expect(slack.content).toContain("[2026-02-25T06:14:20.000Z] grace: agreed");
    expect(slack.participants).toEqual(["U1", "grace"]);

    const discord = renderChatExport("discord", discordExport, {
      maximumOutputBytes: 1_000_000,
    });
    expect(discord.content).toContain("## incidents");
    expect(discord.content).toContain(
      "[2026-03-05T10:00:00.000Z] Ada: The failure mode was a cache key.",
    );
    expect(discord.warnings.join(" ")).toContain("1 attachment(s)");
  });

  it("keeps a timezone-naive timestamp exactly as exported", () => {
    const transcript = renderChatExport(
      "telegram",
      {
        name: "naive",
        messages: [{ type: "message", from: "Ada", date: "2026-03-05T10:00:00", text: "hi" }],
      },
      { maximumOutputBytes: 1_000_000 },
    );
    expect(transcript.content).toContain("[2026-03-05T10:00:00] Ada: hi");
  });

  it("stops at the output limit and says what was left out", () => {
    const transcript = renderChatExport("claude", claudeExport, { maximumOutputBytes: 120 });
    expect(transcript.messageCount).toBeLessThan(3);
    expect(transcript.warnings.join(" ")).toContain("left out to stay within the output limit");
  });

  it("is deterministic for one input", () => {
    const first = renderChatExport("chatgpt", chatGptExport, { maximumOutputBytes: 1_000_000 });
    const second = renderChatExport("chatgpt", chatGptExport, { maximumOutputBytes: 1_000_000 });
    expect(second).toEqual(first);
  });
});

describe("json parser integration", () => {
  const parser = createBuiltinParserRegistry().select("application/json")!;

  it("turns a chat export into a transcript material with participants", async () => {
    const parsed = await parser.parse(raw(chatGptExport), context);
    expect(parsed.material?.kind).toBe("transcript");
    expect(parsed.material?.participants).toEqual(["user", "assistant", "user (profile)"]);
    expect(parsed.material?.extraction).toMatchObject({
      method: "document_text",
      producer: "distilly-json:chatgpt",
    });
    expect(parsed.warnings.join(" ")).toContain("Rendered 3 message(s) from 1 conversation(s).");
  });

  it("keeps the stable pretty-printed document for any other JSON", async () => {
    const parsed = await parser.parse(raw({ b: 1, a: [{ d: 2, c: 3 }] }), context);
    expect(parsed.material?.kind).toBe("document");
    expect(parsed.material?.content).toBe(
      '{\n  "a": [\n    {\n      "c": 3,\n      "d": 2\n    }\n  ],\n  "b": 1\n}',
    );
  });

  it("stores an export with no message text as unparsed with a warning", async () => {
    const parsed = await parser.parse(
      raw([
        {
          title: "empty",
          current_node: "n1",
          mapping: {
            n1: {
              id: "n1",
              parent: null,
              message: {
                author: { role: "user" },
                content: { content_type: "text", parts: [] },
              },
            },
          },
        },
      ]),
      context,
    );
    expect(parsed.material).toBeUndefined();
    expect(parsed.warnings.join(" ")).toContain("contained no message text");
  });
});
