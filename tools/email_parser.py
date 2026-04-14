#!/usr/bin/env python3
"""
Email parser.

Supported formats:
1. `.eml` files
2. `.txt` plain-text mail records
3. `.mbox` mailboxes

Usage:
    python email_parser.py --file emails.eml --target "zhangsan@company.com" --output output.txt
    python email_parser.py --file inbox.mbox --target "Zhang San" --output output.txt
"""

import argparse
import email
import email.policy
import mailbox
import re
import sys
from email.header import decode_header
from html.parser import HTMLParser
from pathlib import Path


class HTMLTextExtractor(HTMLParser):
    """Extract plain text from HTML email content."""

    def __init__(self):
        super().__init__()
        self.result = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False
        if tag in ("p", "br", "div", "tr"):
            self.result.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.result.append(data)

    def get_text(self):
        return re.sub(r"\n{3,}", "\n\n", "".join(self.result)).strip()


def decode_mime_str(s: str) -> str:
    """Decode MIME-encoded header fields."""
    if not s:
        return ""
    parts = decode_header(s)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            charset = charset or "utf-8"
            try:
                result.append(part.decode(charset, errors="replace"))
            except Exception:
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)


def extract_email_body(msg) -> str:
    """Extract the message body as plain text."""
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in disposition:
                continue

            if content_type == "text/plain":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    body = payload.decode(charset, errors="replace")
                    break
                except Exception:
                    body = payload.decode("utf-8", errors="replace")
                    break

            elif content_type == "text/html" and not body:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    html = payload.decode(charset, errors="replace")
                except Exception:
                    html = payload.decode("utf-8", errors="replace")
                extractor = HTMLTextExtractor()
                extractor.feed(html)
                body = extractor.get_text()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            try:
                body = payload.decode(charset, errors="replace")
            except Exception:
                body = payload.decode("utf-8", errors="replace")

    body = re.sub(r"\n>.*", "", body)
    body = re.sub(r"\n-{3,}.*?原始邮件.*?\n", "\n", body, flags=re.DOTALL)
    body = re.sub(r"\n_{3,}\n.*", "", body, flags=re.DOTALL)

    return body.strip()


def is_from_target(from_field: str, target: str) -> bool:
    """Return True if the mail appears to be sent by the target person."""
    from_str = decode_mime_str(from_field).lower()
    target_lower = target.lower()
    return target_lower in from_str


def parse_eml_file(file_path: str, target: str) -> list[dict]:
    """Parse a single `.eml` file."""
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=email.policy.default)

    from_field = str(msg.get("From", ""))
    if not is_from_target(from_field, target):
        return []

    subject = decode_mime_str(str(msg.get("Subject", "")))
    date = str(msg.get("Date", ""))
    body = extract_email_body(msg)

    if not body:
        return []

    return [
        {
            "from": decode_mime_str(from_field),
            "subject": subject,
            "date": date,
            "body": body,
        }
    ]


def parse_mbox_file(file_path: str, target: str) -> list[dict]:
    """Parse an `.mbox` file."""
    results = []
    mbox = mailbox.mbox(file_path)

    for msg in mbox:
        from_field = str(msg.get("From", ""))
        if not is_from_target(from_field, target):
            continue

        subject = decode_mime_str(str(msg.get("Subject", "")))
        date = str(msg.get("Date", ""))
        body = extract_email_body(msg)

        if not body:
            continue

        results.append(
            {
                "from": decode_mime_str(from_field),
                "subject": subject,
                "date": date,
                "body": body,
            }
        )

    return results


def parse_txt_file(file_path: str, target: str) -> list[dict]:
    """
    Parse plain-text email records using a simple format:
    From: xxx
    Subject: xxx
    Date: xxx
    ---
    Body text
    ===
    """
    results = []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    emails_raw = re.split(r"\n={3,}\n|\n-{3,}\n(?=From:)", content)

    for raw in emails_raw:
        from_match = re.search(r"^From:\s*(.+)$", raw, re.MULTILINE)
        subject_match = re.search(r"^Subject:\s*(.+)$", raw, re.MULTILINE)
        date_match = re.search(r"^Date:\s*(.+)$", raw, re.MULTILINE)

        from_field = from_match.group(1).strip() if from_match else ""
        if not is_from_target(from_field, target):
            continue

        body = re.sub(r"^(From|To|Subject|Date|CC|BCC):.*\n?", "", raw, flags=re.MULTILINE)
        body = body.strip()

        if not body:
            continue

        results.append(
            {
                "from": from_field,
                "subject": subject_match.group(1).strip() if subject_match else "",
                "date": date_match.group(1).strip() if date_match else "",
                "body": body,
            }
        )

    return results


def classify_emails(emails: list[dict]) -> dict:
    """
    Classify emails by usefulness:
    - long emails (>200 chars): technical proposals, opinionated explanations
    - decision emails: explicit judgment or approval/rejection
    - daily communication: short routine messages
    """
    long_emails = []
    decision_emails = []
    daily_emails = []

    decision_keywords = [
        "同意",
        "不同意",
        "建议",
        "方案",
        "觉得",
        "应该",
        "决定",
        "确认",
        "approve",
        "reject",
        "lgtm",
        "suggest",
        "recommend",
        "think",
        "我的看法",
        "我认为",
        "我觉得",
        "需要",
        "必须",
        "不需要",
    ]

    for email_item in emails:
        body = email_item["body"]

        if len(body) > 200:
            long_emails.append(email_item)
        elif any(keyword in body.lower() for keyword in decision_keywords):
            decision_emails.append(email_item)
        else:
            daily_emails.append(email_item)

    return {
        "long_emails": long_emails,
        "decision_emails": decision_emails,
        "daily_emails": daily_emails,
        "total_count": len(emails),
    }


def format_output(target: str, classified: dict) -> str:
    """Format the extracted emails for downstream AI analysis."""
    lines = [
        "# Email Extraction",
        f"Target: {target}",
        f"Total emails: {classified['total_count']}",
        "",
        "---",
        "",
        "## Long Emails (technical proposals / opinionated content, highest weight)",
        "",
    ]

    for email_item in classified["long_emails"]:
        lines.append(f"**Subject:** {email_item['subject']} [{email_item['date']}]")
        lines.append(email_item["body"])
        lines.append("")
        lines.append("---")
        lines.append("")

    lines += [
        "## Decision Emails",
        "",
    ]

    for email_item in classified["decision_emails"]:
        lines.append(f"**Subject:** {email_item['subject']} [{email_item['date']}]")
        lines.append(email_item["body"])
        lines.append("")

    lines += [
        "---",
        "",
        "## Daily Communication (style reference)",
        "",
    ]

    for email_item in classified["daily_emails"][:30]:
        lines.append(f"**{email_item['subject']}**: {email_item['body'][:200]}")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse email files and extract messages sent by the target person"
    )
    parser.add_argument("--file", required=True, help="input file path (.eml / .mbox / .txt)")
    parser.add_argument("--target", required=True, help="target person (email address or name)")
    parser.add_argument("--output", default=None, help="output file path (defaults to stdout)")

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"error: file does not exist: {file_path}", file=sys.stderr)
        sys.exit(1)

    suffix = file_path.suffix.lower()

    if suffix == ".eml":
        emails = parse_eml_file(str(file_path), args.target)
    elif suffix == ".mbox":
        emails = parse_mbox_file(str(file_path), args.target)
    else:
        emails = parse_txt_file(str(file_path), args.target)

    if not emails:
        print(f"warning: no emails found from '{args.target}'", file=sys.stderr)
        print("hint: check whether the target name/email matches the From field", file=sys.stderr)

    classified = classify_emails(emails)
    output = format_output(args.target, classified)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"written to {args.output}; extracted {len(emails)} emails")
    else:
        print(output)


if __name__ == "__main__":
    main()
