import { describe, expect, it } from "vitest";

import { parseEmailMessages } from "./email-parser.js";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const SIMPLE = [
  "From: Ada Lovelace <ada@example.com>",
  "To: Charles Babbage <charles@example.com>",
  "Date: Mon, 01 Sep 2026 10:00:00 +0000",
  "Subject: Notes on the engine",
  "",
  "The engine needs a sharper distinction between data and process.",
  "",
  "— Ada",
  "",
].join("\r\n");

const MULTIPART = [
  "From: Ada <ada@example.com>",
  "To: Charles <charles@example.com>",
  "Subject: Design review",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="outer"',
  "",
  "--outer",
  'Content-Type: multipart/alternative; boundary="inner"',
  "",
  "--inner",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Plain view of the design.",
  "--inner",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<html><body><p>HTML view of the <b>design</b>.</p></body></html>",
  "--inner--",
  "--outer",
  "Content-Type: application/pdf; name=spec.pdf",
  "Content-Disposition: attachment; filename=spec.pdf",
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--outer--",
  "",
].join("\n");

const BASE64_QUOTED = [
  "From: =?UTF-8?B?5byg5LiJ?= <zhang@example.com>",
  "To: team@example.com",
  "Subject: =?UTF-8?B?5rWL6K+V5Li76aKY?=",
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="utf-8"',
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("第一行\n第二行\n", "utf8").toString("base64"),
  "",
].join("\r\n");

const QUOTED_PRINTABLE = [
  "From: Ada <ada@example.com>",
  "Subject: QP test",
  "Content-Type: text/plain; charset=iso-8859-1",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Caf=C3=A9 at 10:00 =E2=80=94 bring the notes.",
  "",
].join("\r\n");

const MBOX = [
  "From ada@example.com Mon Sep 01 10:00:00 2026",
  "From: Ada <ada@example.com>",
  "Subject: first",
  "",
  "First message body.",
  "",
  "From charles@example.com Mon Sep 01 11:00:00 2026",
  "From: Charles <charles@example.com>",
  "Subject: second",
  "",
  "Second message body.",
  "",
].join("\n");

/**
 * Builds a single-part message from raw body bytes and explicit header lines.
 *
 * @param headerLines - Header lines without the terminating blank line.
 * @param body - Raw body bytes.
 * @returns Complete message bytes.
 */
const rawMessage = (headerLines: readonly string[], body: Uint8Array): Uint8Array => {
  const head = bytes(`${headerLines.join("\r\n")}\r\n\r\n`);
  const combined = new Uint8Array(head.length + body.length);
  combined.set(head, 0);
  combined.set(body, head.length);
  return combined;
};

/**
 * Builds a one-part HTML message around an inner fragment.
 *
 * @param inner - HTML body content.
 * @returns Complete message bytes.
 */
const htmlMessage = (inner: string): string =>
  ["From: h@example.com", "Content-Type: text/html; charset=utf-8", "", inner, ""].join("\r\n");

describe("mail material parsing", () => {
  it("renders a simple message with decoded headers and body", () => {
    const parsed = parseEmailMessages(bytes(SIMPLE), false);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toEqual({
      from: "Ada Lovelace <ada@example.com>",
      to: "Charles Babbage <charles@example.com>",
      date: "Mon, 01 Sep 2026 10:00:00 +0000",
      subject: "Notes on the engine",
      body: "From: Ada Lovelace <ada@example.com>\nTo: Charles Babbage <charles@example.com>\nDate: Mon, 01 Sep 2026 10:00:00 +0000\nSubject: Notes on the engine\n\nThe engine needs a sharper distinction between data and process.\n\n— Ada",
    });
    expect(parsed.skippedAttachments).toBe(0);
    expect(parsed.undecodableParts).toBe(0);
  });

  it("prefers the plain alternative of a nested multipart and counts the attachment", () => {
    const parsed = parseEmailMessages(bytes(MULTIPART), false);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]?.body).toContain("Plain view of the design.");
    expect(parsed.messages[0]?.body).not.toContain("HTML view");
    expect(parsed.skippedAttachments).toBe(1);
    expect(parsed.undecodableParts).toBe(0);
  });

  it("falls back to the HTML part when no plain part exists and strips markup", () => {
    const htmlOnly = [
      "From: Ada <ada@example.com>",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<html><body><p>Only <b>markup</b> here</p></body></html>",
      "",
    ].join("\r\n");
    const parsed = parseEmailMessages(bytes(htmlOnly), false);
    expect(parsed.messages[0]?.body).toContain("Only markup here");
    expect(parsed.messages[0]?.body).not.toContain("<b>");
  });

  it("decodes RFC 2047 header words and a base64 UTF-8 body", () => {
    const parsed = parseEmailMessages(bytes(BASE64_QUOTED), false);
    expect(parsed.messages[0]?.from).toBe("张三 <zhang@example.com>");
    expect(parsed.messages[0]?.subject).toBe("测试主题");
    expect(parsed.messages[0]?.body).toContain("第一行\n第二行");
  });

  it("decodes a quoted-printable body through its declared charset", () => {
    const parsed = parseEmailMessages(bytes(QUOTED_PRINTABLE), false);
    expect(parsed.messages[0]?.body).toContain("Café at 10:00 — bring the notes.");
  });

  it("splits an mbox mailbox into one message per separator", () => {
    const parsed = parseEmailMessages(bytes(MBOX), true);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]?.subject).toBe("first");
    expect(parsed.messages[0]?.body).toContain("First message body.");
    expect(parsed.messages[1]?.subject).toBe("second");
    expect(parsed.messages[1]?.body).toContain("Second message body.");
  });

  it("rejects a source with no message, a header-only source, and an unreadable body", () => {
    expect(() => parseEmailMessages(bytes("not a message at all"), false)).toThrow(
      /did not contain a decodable message/u,
    );
    expect(() => parseEmailMessages(bytes("Subject: only headers\r\n\r\n"), false)).toThrow(
      /did not contain a decodable message/u,
    );
    expect(() => parseEmailMessages(bytes(""), true)).toThrow(
      /did not contain a decodable message/u,
    );
    expect(() =>
      parseEmailMessages(
        bytes(
          "From: a@example.com\r\nContent-Transfer-Encoding: x-uuencode\r\n\r\nbegin 644 x\r\n",
        ),
        false,
      ),
    ).toThrow(/did not contain a decodable message/u);
  });

  // Regression coverage for the independent audit of the first implementation.
  describe("audit regressions", () => {
    it("decodes an 8-bit body through the charset its part declares", () => {
      const message = rawMessage(
        [
          "From: gb@example.com",
          "Subject: GB18030 raw",
          "Content-Type: text/plain; charset=GB18030",
          "Content-Transfer-Encoding: 8bit",
        ],
        Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4]),
      );
      const body = parseEmailMessages(message, false).messages[0]?.body ?? "";
      expect(body).toContain("中文");
      expect(body).not.toContain("脰");
    });

    it("honours a declared charset outside the built-in candidate list", () => {
      const message = rawMessage(
        [
          "From: jp@example.com",
          "Subject: shift_jis raw",
          "Content-Type: text/plain; charset=shift_jis",
          "Content-Transfer-Encoding: 8bit",
        ],
        Uint8Array.from([0x93, 0xfa, 0x96, 0x7b]),
      );
      expect(parseEmailMessages(message, false).messages[0]?.body).toContain("日本");
    });

    it("never turns an untyped binary part into evidence", () => {
      const message = [
        "From: a@example.com",
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="b"',
        "",
        "--b",
        "",
        "\u0000\u0001\u0002\u0003binary-ish",
        "--b",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Real text body.",
        "--b--",
        "",
      ].join("\r\n");
      const parsed = parseEmailMessages(bytes(message), false);
      expect(parsed.messages[0]?.body).toContain("Real text body.");
      expect(parsed.messages[0]?.body).not.toContain("\u0000");
      expect(parsed.skippedAttachments).toBe(1);
    });

    it("refuses a top-level binary payload instead of emitting it as text", () => {
      const message = rawMessage(
        [
          "From: a@example.com",
          "Content-Type: application/octet-stream",
          "Content-Transfer-Encoding: base64",
        ],
        bytes("AAECAw=="),
      );
      expect(() => parseEmailMessages(message, false)).toThrow(
        /did not contain a decodable message/u,
      );
    });

    it("survives prose containing angle brackets and decodes numeric entities", () => {
      const html = [
        "From: a@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        "<p>caf&#233; &#x1F600; and 2 < 3 and a<b</p>",
        "",
      ].join("\r\n");
      const body = parseEmailMessages(bytes(html), false).messages[0]?.body ?? "";
      expect(body).toContain("café 😀");
      expect(body).toContain("2 < 3");
    });

    it("accepts a boundary delimiter carrying transport padding", () => {
      const message = [
        "From: a@example.com",
        'Content-Type: multipart/mixed; boundary="PAD"',
        "",
        "--PAD ",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Padded delimiter body.",
        "--PAD-- ",
        "",
      ].join("\r\n");
      expect(parseEmailMessages(bytes(message), false).messages[0]?.body).toContain(
        "Padded delimiter body.",
      );
    });

    it("uses the HTML alternative when the plain alternative is empty", () => {
      const message = [
        "From: a@example.com",
        'Content-Type: multipart/alternative; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "   ",
        "--b",
        "Content-Type: text/html; charset=utf-8",
        "",
        "<p>HTML fallback text.</p>",
        "--b--",
        "",
      ].join("\r\n");
      expect(parseEmailMessages(bytes(message), false).messages[0]?.body).toContain(
        "HTML fallback text.",
      );
    });

    it("joins adjacent encoded header words without inserting a space", () => {
      const fold = [
        "From: a@example.com",
        "Subject: =?utf-8?B?UmVz?=",
        " =?utf-8?B?dW3DqQ==?=",
        "",
        "Body text.",
        "",
      ].join("\r\n");
      // "UmVz" decodes to "Res" and "dW3DqQ==" to "umé"; adjacent words concatenate
      // directly, so the correct value is "Resumé" and not "Résumé".
      expect(parseEmailMessages(bytes(fold), false).messages[0]?.subject).toBe("Resumé");
    });

    it("rejects a body with no visible character", () => {
      const zwsp = rawMessage(
        ["From: a@example.com", "Subject: z", "Content-Type: text/plain; charset=utf-8"],
        bytes("\u200b"),
      );
      expect(() => parseEmailMessages(zwsp, false)).toThrow(/did not contain a decodable message/u);
    });

    it("reports the nesting limit instead of a generic failure", () => {
      const depth = 30;
      const lines: string[] = ["From: a@example.com"];
      for (let level = 0; level < depth; level += 1) {
        lines.push(`Content-Type: multipart/mixed; boundary="b${level}"`, "", `--b${level}`);
      }
      lines.push("Content-Type: text/plain", "", "DEEP-TEXT", `--b${depth - 1}--`, "");
      expect(() => parseEmailMessages(bytes(lines.join("\r\n")), false)).toThrow(
        /nests more than 16 multipart levels/u,
      );
    });

    it("does not truncate a message at an unescaped From line inside its body", () => {
      const mailbox = [
        "From ada@example.com Mon Sep 01 10:00:00 2026",
        "From: Ada <ada@example.com>",
        "Subject: plan",
        "",
        "Before the separator.",
        "From now on the plan changes.",
        "After the separator.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]?.body).toContain("From now on the plan changes.");
      expect(parsed.messages[0]?.body).toContain("After the separator.");
    });

    it("keeps the message of a mailbox whose separator carries no month name", () => {
      const mailbox = [
        "From ada@example.com 2026-09-01 10:00:00",
        "From: Ada <ada@example.com>",
        "Subject: dash date",
        "",
        "Body with a dash date separator.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]?.body).toContain("dash date separator");
    });
  });

  // Regression coverage for the second independent audit, which found that the first
  // round of fixes had introduced new defects.
  describe("re-audit regressions", () => {
    const MAILBOX_FORMATS: readonly (readonly [string, string])[] = [
      ["ctime padded day", "From a@example.com Fri Sep  1 10:00:00 2026"],
      ["ctime two-digit day", "From a@example.com Fri Sep 11 10:00:00 2026"],
      ["thunderbird dash", "From - Fri Sep 11 10:00:00 2026"],
      ["rfc 2822", "From a@example.com Fri, 11 Sep 2026 10:00:00 +0000"],
      ["iso 8601", "From a@example.com 2026-09-11T10:00:00Z"],
      ["epoch seconds", "From a@example.com 1789060600"],
      ["no date", "From a@example.com"],
    ];

    it.each(MAILBOX_FORMATS)("splits a mailbox whose separators use %s", (_label, first) => {
      const mailbox = [
        first,
        "From: A <a@example.com>",
        "Subject: one",
        "",
        "First body.",
        "",
        first.replace(/^From \S+/u, "From b@example.com"),
        "From: B <b@example.com>",
        "Subject: two",
        "",
        "Second body.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0]?.subject).toBe("one");
      expect(parsed.messages[1]?.subject).toBe("two");
      expect(parsed.messages[0]?.body).not.toContain("Subject: two");
    });

    it("treats a header-only empty part as empty rather than as body text", () => {
      const message = [
        "From: e@example.com",
        "Subject: empty alt",
        'Content-Type: multipart/alternative; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "--b",
        "Content-Type: text/html; charset=utf-8",
        "",
        "<p>Readable HTML alternative.</p>",
        "--b--",
        "",
      ].join("\r\n");
      const body = parseEmailMessages(bytes(message), false).messages[0]?.body ?? "";
      expect(body).toContain("Readable HTML alternative.");
      expect(body).not.toContain("Content-Type: text/plain");
    });

    it("decodes an unencoded 8-bit UTF-8 header value", () => {
      const message = bytes(
        ["From: José García <jose@example.com>", "Subject: Raw é€", "", "body", ""].join("\r\n"),
      );
      const parsed = parseEmailMessages(message, false);
      expect(parsed.messages[0]?.from).toBe("José García <jose@example.com>");
      expect(parsed.messages[0]?.subject).toBe("Raw é€");
    });

    it("never treats a declared text/plain payload with control bytes as evidence", () => {
      const message = [
        "From: c@example.com",
        'Content-Type: multipart/mixed; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "\u0000\u0001\u0002\u0003ÿþ",
        "--b",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "REAL-TEXT",
        "--b--",
        "",
      ].join("\r\n");
      const parsed = parseEmailMessages(bytes(message), false);
      expect(parsed.messages[0]?.body).toContain("REAL-TEXT");
      expect(parsed.messages[0]?.body).not.toContain("\u0000");
      expect(parsed.skippedAttachments).toBe(1);
    });

    it("stays fast on HTML with many unclosed script openers", () => {
      const message = [
        "From: h@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        `${"<script>".repeat(20_000)}visible text`,
        "",
      ].join("\r\n");
      const started = Date.now();
      const parsed = parseEmailMessages(bytes(message), false);
      expect(parsed.messages[0]?.body).toContain("visible text");
      expect(Date.now() - started).toBeLessThan(2_000);
    });

    it("does not double-decode an escaped numeric entity", () => {
      const html = [
        "From: h@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        "<p>literal &amp;#233; stays literal</p>",
        "",
      ].join("\r\n");
      const body = parseEmailMessages(bytes(html), false).messages[0]?.body ?? "";
      expect(body).toContain("&#233;");
      expect(body).not.toContain("é");
    });

    it("enforces the nesting limit at the documented depth", () => {
      const depth = 17;
      const lines: string[] = ["From: a@example.com"];
      for (let level = 0; level < depth; level += 1) {
        lines.push(`Content-Type: multipart/mixed; boundary="b${level}"`, "", `--b${level}`);
      }
      lines.push("Content-Type: text/plain", "", "DEEP-TEXT", `--b${depth - 1}--`, "");
      expect(() => parseEmailMessages(bytes(lines.join("\r\n")), false)).toThrow(
        /nests more than 16 multipart levels/u,
      );
    });

    it("honours a specific legacy declaration over a coincidental UTF-8 reading", () => {
      // Shift_JIS C3 A9 C3 A9 C3 A9 is half-width katakana, not "ééé".
      const message = rawMessage(
        [
          "From: jp@example.com",
          "Content-Type: text/plain; charset=shift_jis",
          "Content-Transfer-Encoding: 8bit",
        ],
        Uint8Array.from([0xc3, 0xa9, 0xc3, 0xa9, 0xc3, 0xa9]),
      );
      expect(parseEmailMessages(message, false).messages[0]?.body).toContain("ﾃｩﾃｩﾃｩ");
    });

    it("still prefers UTF-8 when the declaration is a label senders misuse", () => {
      const message = rawMessage(
        [
          "From: m@example.com",
          "Content-Type: text/plain; charset=iso-8859-1",
          "Content-Transfer-Encoding: 8bit",
        ],
        bytes("café — done"),
      );
      expect(parseEmailMessages(message, false).messages[0]?.body).toContain("café — done");
    });

    it("does not split on an address quoted at the start of a body line", () => {
      const mailbox = [
        "From a@example.com Fri Sep 11 10:00:00 2026",
        "From: A <a@example.com>",
        "Subject: one",
        "",
        "Before.",
        "From alice@example.com wrote:",
        "After.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]?.body).toContain("From alice@example.com wrote:");
      expect(parsed.messages[0]?.body).toContain("After.");
    });

    it("splits on a bare sender token with neither an address nor a date", () => {
      const mailbox = [
        "From MAILER-DAEMON",
        "From: postmaster@example.com",
        "Subject: bounce",
        "",
        "Delivery failed.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]?.subject).toBe("bounce");
    });

    it("parses encodings that legitimately embed control bytes", () => {
      // ISO-2022-JP switches charsets with ESC; UTF-16LE is full of NUL bytes.
      const iso2022 = rawMessage(
        [
          "From: jp@example.com",
          "Content-Type: text/plain; charset=iso-2022-jp",
          "Content-Transfer-Encoding: 8bit",
        ],
        // ESC $ B then JIS X 0208 for 日 (0x46 0x7C) and 本 (0x4B 0x5C), then ESC ( B.
        Uint8Array.from([0x1b, 0x24, 0x42, 0x46, 0x7c, 0x4b, 0x5c, 0x1b, 0x28, 0x42]),
      );
      expect(parseEmailMessages(iso2022, false).messages[0]?.body).toContain("日本");

      const utf16 = rawMessage(
        [
          "From: u@example.com",
          "Content-Type: text/plain; charset=utf-16le",
          "Content-Transfer-Encoding: base64",
        ],
        bytes(Buffer.from("hello there", "utf16le").toString("base64")),
      );
      expect(parseEmailMessages(utf16, false).messages[0]?.body).toContain("hello there");
    });

    it("stays linear on balanced script regions at scale", () => {
      const html = [
        "From: h@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        `${"<script>x</script>".repeat(60_000)}<p>visible tail</p>`,
        "",
      ].join("\r\n");
      const started = Date.now();
      const body = parseEmailMessages(bytes(html), false).messages[0]?.body ?? "";
      expect(body).toContain("visible tail");
      expect(Date.now() - started).toBeLessThan(3_000);
    });

    it("stays linear on many unclosed style openers", () => {
      const html = [
        "From: h@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        `${"<style>".repeat(120_000)}<p>visible tail</p>`,
        "",
      ].join("\r\n");
      const started = Date.now();
      const body = parseEmailMessages(bytes(html), false).messages[0]?.body ?? "";
      expect(body).toContain("visible tail");
      expect(Date.now() - started).toBeLessThan(3_000);
    });

    it("splits every documented separator shape in a middle position", () => {
      // The tested separator is deliberately placed between two messages: a separator in
      // the first line would split because splitMailbox always starts a message there, so
      // a first-position test would confirm any nonsense rule, including "From x@y zzz".
      const shapes = [
        "From x@y\t",
        "From x@y\t ",
        "From x@y ",
        "From x@y  Fri Sep 11 02:31:00 2026",
        "From x@y  2026-09-11 02:31:00",
        "From x@y Friday, 11 Sep 2026 02:31:00 +0000",
        "From x@y 11-Sep-2026 02:31:00",
        "From x@y 11/09/2026 02:31:00",
        "From x@y 2026/09/11 02:31:00",
        "From x@y fri sep 11 02:31:00 2026",
        "From x@y 02:31:00 2026",
        "From x@y 20260911",
        "From x@y 1789000000",
        "From x@y <1789000000>",
        "From MAILER-DAEMON Sat Sep 11 02:31:00 2026",
        "From - Fri Sep 11 02:31:00 2026",
      ];
      for (const shape of shapes) {
        const mailbox = [
          "From a@example.com Fri Sep 11 10:00:00 2026",
          "From: A <a@example.com>",
          "Subject: one",
          "",
          "First body.",
          "",
          shape,
          "From: B <b@example.com>",
          "Subject: two",
          "",
          "Second body.",
          "",
          "From c@example.com Fri Sep 11 12:00:00 2026",
          "From: C <c@example.com>",
          "Subject: three",
          "",
          "Third body.",
          "",
        ].join("\n");
        const parsed = parseEmailMessages(bytes(mailbox), true);
        expect(
          parsed.messages.map((message) => message.subject),
          shape,
        ).toEqual(["one", "two", "three"]);
      }
    });

    it("splits every real sender shape, including bare usernames and hostnames", () => {
      // Round 7 measured these as regressions when the separator rule gated on the sender
      // token: a bare local username is a real sender, so the token cannot discriminate.
      for (const shape of [
        "From ada Fri Sep 11 10:00:00 2026",
        "From alice Fri Sep 11 10:00:00 2026",
        "From ada, Fri Sep 11 10:00:00 2026",
        "From ada@localhost Fri Sep 11 10:00:00 2026",
        "From localhost Fri Sep 11 10:00:00 2026",
        "From example.com Fri Sep 11 10:00:00 2026",
        "From ada 2026-09-11T10:00:00Z",
        "From ada 11/09/2026 10:00:00",
        "From ada 20260911",
        "From ada 1789000000",
        "From ada",
        "From x@y 11-Sep-2026 02:31:00",
      ]) {
        const mailbox = [
          "From a@example.com Fri Sep 11 10:00:00 2026",
          "From: A <a@example.com>",
          "Subject: one",
          "",
          "First body.",
          "",
          shape,
          "From: B <b@example.com>",
          "Subject: two",
          "",
          "Second body.",
          "",
          "From c@example.com Fri Sep 11 12:00:00 2026",
          "From: C <c@example.com>",
          "Subject: three",
          "",
          "Third body.",
          "",
        ].join("\n");
        expect(
          parseEmailMessages(bytes(mailbox), true).messages.map((message) => message.subject),
          shape,
        ).toEqual(["one", "two", "three"]);
      }
    });

    it("rejects prose that starts with a number, a month, or a time", () => {
      for (const line of [
        "From alice@example.com 09:30 works for me.",
        "From Sep we will change everything.",
        "From 11/09/2026 invoice is attached.",
        "From 20260911 backup was restored.",
      ]) {
        const mailbox = [
          "From a@example.com Fri Sep 11 10:00:00 2026",
          "From: A <a@example.com>",
          "Subject: one",
          "",
          "Before.",
          line,
          "After.",
          "",
        ].join("\n");
        const parsed = parseEmailMessages(bytes(mailbox), true);
        expect(parsed.messages, line).toHaveLength(1);
        expect(parsed.messages[0]?.body, line).toContain(line);
        expect(parsed.messages[0]?.body, line).toContain("After.");
      }
    });

    it("never splits prose or a quoted address in a middle position", () => {
      for (const line of [
        "From now on the plan changes.",
        "From the desk of Bob, 2nd floor",
        "From alice@example.com wrote:",
        "From 2026 we will change everything.",
        "From 09:30 until 17:00 we are closed.",
        "From the 11/09/2026 invoice is attached.",
        "From the 12345678 records are attached.",
        "From the 20260911 backup was restored.",
        "From x@y zzz nonsense",
      ]) {
        const mailbox = [
          "From a@example.com Fri Sep 11 10:00:00 2026",
          "From: A <a@example.com>",
          "Subject: one",
          "",
          "Before.",
          line,
          "After.",
          "",
        ].join("\n");
        const parsed = parseEmailMessages(bytes(mailbox), true);
        expect(parsed.messages, line).toHaveLength(1);
        expect(parsed.messages[0]?.body, line).toContain(line);
        expect(parsed.messages[0]?.body, line).toContain("After.");
      }
    });

    it("keeps visible text when raw-text markup contains a comment opener", () => {
      for (const inner of [
        "<script>\n<!-- hide\n</script>VISIBLE-CONTENT",
        "<script>if(a<!--b){c()}</script>VISIBLE-CONTENT",
      ]) {
        const body = parseEmailMessages(bytes(htmlMessage(inner)), false).messages[0]?.body ?? "";
        expect(body, inner).toContain("VISIBLE-CONTENT");
      }
    });

    it("splits a date-less separator that carries trailing whitespace", () => {
      for (const separator of ["From x@y ", "From x@y  ", "From MAILER-DAEMON ", "From - "]) {
        const mailbox = [
          separator,
          "From: A <a@example.com>",
          "Subject: one",
          "",
          "First body.",
          "",
          "From b@example.com",
          "From: B <b@example.com>",
          "Subject: two",
          "",
          "Second body.",
          "",
        ].join("\n");
        const parsed = parseEmailMessages(bytes(mailbox), true);
        expect(parsed.messages.length, separator).toBe(2);
        expect(parsed.messages[0]?.body, separator).not.toContain("Subject: two");
      }
    });

    it("does not split on prose whose digit appears later in the line", () => {
      const mailbox = [
        "From a@example.com Fri Sep 11 10:00:00 2026",
        "From: A <a@example.com>",
        "Subject: one",
        "",
        "Before.",
        "From the desk of Bob, 2nd floor",
        "After.",
        "",
      ].join("\n");
      const parsed = parseEmailMessages(bytes(mailbox), true);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]?.body).toContain("From the desk of Bob, 2nd floor");
      expect(parsed.messages[0]?.body).toContain("After.");
    });

    it("lets no commented-out opener swallow visible text", () => {
      for (const inner of [
        "<!-- <script> --><script>LEAK</script>VISIBLE",
        "<!-- <script> -->VISIBLE<p>TAIL</p><script>LEAK</script>",
        "<!-- <script> -->A<!-- <script> -->VISIBLE<script>LEAK</script>",
      ]) {
        const body = parseEmailMessages(bytes(htmlMessage(inner)), false).messages[0]?.body ?? "";
        expect(body, inner).toContain("VISIBLE");
        expect(body, inner).not.toContain("LEAK");
      }
    });

    it("matches element names at the tag boundary instead of by prefix", () => {
      for (const inner of [
        "<scripty>LEAK</scripty>VISIBLE",
        "<scripts>LEAK</scripts>VISIBLE",
        "<stylesheet>LEAK</stylesheet>VISIBLE",
      ]) {
        const body = parseEmailMessages(bytes(htmlMessage(inner)), false).messages[0]?.body ?? "";
        expect(body, inner).toContain("LEAK");
        expect(body, inner).toContain("VISIBLE");
      }
    });

    it("keeps markup scanning aligned when lowercasing would change length", () => {
      // U+0130 lowercases to two code points, which would shift every later index.
      const html = [
        "From: h@example.com",
        "Content-Type: text/html; charset=utf-8",
        "",
        `${"İ".repeat(20)}<script>hidden()</script><p>visible tail</p>`,
        "",
      ].join("\r\n");
      const body = parseEmailMessages(bytes(html), false).messages[0]?.body ?? "";
      expect(body).toContain("visible tail");
      expect(body).not.toContain("hidden()");
    });
  });
});
