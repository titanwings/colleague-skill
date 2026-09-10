import { describe, expect, it } from "vitest";
import { parseEmailMessages } from "./email-parser.js";
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const mb = (sep: string): string =>
  [
    sep,
    "From: A <a@example.com>",
    "Subject: one",
    "",
    "First body.",
    "",
    sep.replace(/^From \S+/u, "From b@example.com"),
    "From: B <b@example.com>",
    "Subject: two",
    "",
    "Second body.",
    "",
    sep.replace(/^From \S+/u, "From c@example.com"),
    "From: C <c@example.com>",
    "Subject: three",
    "",
    "Third body.",
    "",
  ].join("\n");
const html = (inner: string): string =>
  ["From: h@example.com", "Content-Type: text/html; charset=utf-8", "", inner, ""].join("\r\n");

describe("round-4 audit repros", () => {
  it("V4-1 trailing-space date-less separators still split", () => {
    for (const sep of ["From x@y ", "From x@y  ", "From MAILER-DAEMON ", "From - "]) {
      const parsed = parseEmailMessages(bytes(mb(sep)), true);
      console.log(`V4-1 ${JSON.stringify(sep)} messages=${parsed.messages.length}`);
      expect(parsed.messages.length, sep).toBe(3);
    }
  });
  it("V4-2 prose with a digit later in the remainder does not split", () => {
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
    console.log(
      `V4-2 messages=${parsed.messages.length} tail=${parsed.messages[0]?.body.includes("After.")}`,
    );
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]?.body).toContain("From the desk of Bob, 2nd floor");
    expect(parsed.messages[0]?.body).toContain("After.");
  });
  it("V4-3 a commented-out opener cannot swallow visible text", () => {
    for (const inner of [
      "<!-- <script> --><script>LEAK</script>VISIBLE",
      "<!-- <script> -->VISIBLE<p>TAIL</p><script>LEAK</script>",
      "<!-- <script> -->A<!-- <script> -->VISIBLE<script>LEAK</script>",
    ]) {
      let body = "";
      try {
        body = parseEmailMessages(bytes(html(inner)), false).messages[0]?.body ?? "";
      } catch (e) {
        body = `THREW: ${(e as Error).message}`;
      }
      console.log(
        `V4-3 in=${JSON.stringify(inner.slice(0, 34))} body=${JSON.stringify(body.slice(-60))}`,
      );
      expect(body).toContain("VISIBLE");
      expect(body).not.toContain("LEAK");
    }
  });
  it("V4-4 tag names are matched at the boundary, not by prefix", () => {
    for (const inner of [
      "<scripty>LEAK</scripty>VISIBLE",
      "<scripts>LEAK</scripts>VISIBLE",
      "<stylesheet>LEAK</stylesheet>VISIBLE",
    ]) {
      const body = parseEmailMessages(bytes(html(inner)), false).messages[0]?.body ?? "";
      console.log(
        `V4-4 in=${JSON.stringify(inner.slice(0, 22))} body=${JSON.stringify(body.slice(-40))}`,
      );
      expect(body).toContain("LEAK");
      expect(body).toContain("VISIBLE");
    }
  });
  it("V4-5 unmatched openers keep visible text", () => {
    const body =
      parseEmailMessages(bytes(html("<style>LEAK</script>VISIBLE-D")), false).messages[0]?.body ??
      "";
    console.log(`V4-5 body=${JSON.stringify(body.slice(-50))}`);
    expect(body).toContain("VISIBLE-D");
  });
});
