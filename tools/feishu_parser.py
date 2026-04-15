#!/usr/bin/env python3
"""
Feishu message export parser.

Supported input formats:
1. Official Feishu JSON exports, usually arrays of messages with sender/content/timestamp
2. Manually prepared TXT logs, one line per message

Usage:
    python feishu_parser.py --file messages.json --target "Zhang San" --output output.txt
    python feishu_parser.py --file messages.txt --target "Zhang San" --output output.txt
"""

import argparse
import json
import re
import sys
from pathlib import Path


def parse_feishu_json(file_path: str, target_name: str) -> list[dict]:
    """Parse Feishu's exported JSON message format."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    messages = []

    if isinstance(data, list):
        raw_messages = data
    elif isinstance(data, dict):
        raw_messages = data.get("messages") or data.get("records") or data.get("data") or []
    else:
        return []

    for msg in raw_messages:
        sender = (
            msg.get("sender_name")
            or msg.get("sender")
            or msg.get("from")
            or msg.get("user_name")
            or ""
        )
        content = (
            msg.get("content")
            or msg.get("text")
            or msg.get("message")
            or msg.get("body")
            or ""
        )
        timestamp = (
            msg.get("timestamp")
            or msg.get("create_time")
            or msg.get("time")
            or ""
        )

        if isinstance(content, dict):
            content = content.get("text") or content.get("content") or str(content)
        if isinstance(content, list):
            content = " ".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in content
            )

        if target_name and target_name not in str(sender):
            continue

        if not content or content.strip() in ["[图片]", "[文件]", "[撤回了一条消息]", "[语音]"]:
            continue

        messages.append(
            {
                "sender": str(sender),
                "content": str(content).strip(),
                "timestamp": str(timestamp),
            }
        )

    return messages


def parse_feishu_txt(file_path: str, target_name: str) -> list[dict]:
    """Parse a plain-text Feishu chat log in `time sender: message` format."""
    messages = []

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    pattern = re.compile(
        r"^(?P<time>\d{4}[-/]\d{1,2}[-/]\d{1,2}[\s\d:]*)\s+(?P<sender>.+?)[:：]\s*(?P<content>.+)$"
    )

    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = pattern.match(line)
        if match:
            sender = match.group("sender").strip()
            content = match.group("content").strip()
            timestamp = match.group("time").strip()

            if target_name and target_name not in sender:
                continue
            if not content:
                continue

            messages.append(
                {
                    "sender": sender,
                    "content": content,
                    "timestamp": timestamp,
                }
            )
        else:
            if target_name and target_name in line:
                messages.append(
                    {
                        "sender": target_name,
                        "content": line,
                        "timestamp": "",
                    }
                )

    return messages


def extract_key_content(messages: list[dict]) -> dict:
    """
    Split messages into:
    - long messages (>50 chars): likely proposals, opinions, technical judgment
    - decision messages: contain explicit decision keywords
    - daily communication: everything else
    """
    long_messages = []
    decision_messages = []
    daily_messages = []

    decision_keywords = [
        "同意",
        "不行",
        "觉得",
        "建议",
        "应该",
        "不应该",
        "可以",
        "不可以",
        "方案",
        "思路",
        "考虑",
        "决定",
        "确认",
        "拒绝",
        "推进",
        "暂缓",
        "没问题",
        "有问题",
        "风险",
        "评估",
        "判断",
    ]

    for msg in messages:
        content = msg["content"]

        if len(content) > 50:
            long_messages.append(msg)
        elif any(keyword in content for keyword in decision_keywords):
            decision_messages.append(msg)
        else:
            daily_messages.append(msg)

    return {
        "long_messages": long_messages,
        "decision_messages": decision_messages,
        "daily_messages": daily_messages,
        "total_count": len(messages),
    }


def format_output(target_name: str, extracted: dict) -> str:
    """Format extracted Feishu messages for downstream AI analysis."""
    lines = [
        "# Feishu Message Extraction",
        f"Target: {target_name}",
        f"Total messages: {extracted['total_count']}",
        "",
        "---",
        "",
        "## Long Messages (proposals / opinions, highest weight)",
        "",
    ]

    for msg in extracted["long_messages"]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## Decision Messages",
        "",
    ]

    for msg in extracted["decision_messages"]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## Daily Communication (style reference)",
        "",
    ]

    for msg in extracted["daily_messages"][:100]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse Feishu message export files")
    parser.add_argument("--file", required=True, help="input file path (.json or .txt)")
    parser.add_argument(
        "--target",
        required=True,
        help="target person name (only messages sent by this person are extracted)",
    )
    parser.add_argument("--output", default=None, help="output file path (defaults to stdout)")

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"error: file does not exist: {file_path}", file=sys.stderr)
        sys.exit(1)

    if file_path.suffix.lower() == ".json":
        messages = parse_feishu_json(str(file_path), args.target)
    else:
        messages = parse_feishu_txt(str(file_path), args.target)

    if not messages:
        print(f"warning: no messages found from '{args.target}'", file=sys.stderr)
        print("hint: check whether the target name matches the sender field", file=sys.stderr)

    extracted = extract_key_content(messages)
    output = format_output(args.target, extracted)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"written to {args.output}; extracted {len(messages)} messages")
    else:
        print(output)


if __name__ == "__main__":
    main()
