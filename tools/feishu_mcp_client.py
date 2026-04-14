#!/usr/bin/env python3
"""
Feishu MCP client wrapper.

Reads Feishu docs, wiki pages, spreadsheets, and chat messages through the
Feishu MCP server.

Best for:
  - company-authorized documents
  - content accessible with an App token or User token

Prerequisites:
  1. Install Feishu MCP: `npm install -g feishu-mcp`
  2. Create a Feishu app and get App ID / App Secret
  3. Enable the required permissions in Feishu Open Platform

Common permissions:
  - docs:doc:readonly
  - wiki:wiki:readonly
  - im:message:readonly
  - bitable:app:readonly
  - sheets:spreadsheet:readonly

Usage:
  # one-time setup
  python3 feishu_mcp_client.py --setup

  # read a doc / wiki page / sheet
  python3 feishu_mcp_client.py --url "https://xxx.feishu.cn/wiki/xxx" --output out.txt

  # read chat messages
  python3 feishu_mcp_client.py --chat-id "oc_xxx" --target "Zhang San" --output out.txt

  # list docs in a wiki space
  python3 feishu_mcp_client.py --list-wiki --space-id "xxx"
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


CONFIG_PATH = Path.home() / ".colleague-skill" / "feishu_config.json"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))
    print(f"configuration saved to {CONFIG_PATH}")


def setup_config() -> None:
    print("=== Feishu MCP Setup ===")
    print("Create an enterprise internal app at open.feishu.cn and collect the following values.\n")

    app_id = input("App ID (cli_xxx): ").strip()
    app_secret = input("App Secret: ").strip()

    print("\nChoose token mode:")
    print("  [1] App token (app-level permissions configured in Feishu)")
    print("  [2] User token (accesses content the user can see, needs refresh over time)")
    mode = input("Choose [1/2], default 1: ").strip() or "1"

    config = {
        "app_id": app_id,
        "app_secret": app_secret,
        "mode": "app" if mode == "1" else "user",
    }

    if mode == "2":
        print("\nGet a user token through Feishu Open Platform -> OAuth 2.0 -> user_access_token")
        user_token = input("User Access Token (u-xxx): ").strip()
        config["user_token"] = user_token
        print("Note: a user token typically expires after about 2 hours and must be refreshed.")

    save_config(config)
    print("\nsetup complete")


def call_mcp(tool: str, params: dict, config: dict) -> dict:
    """Call `feishu-mcp` through `npx` using stdio JSON-RPC."""
    env = os.environ.copy()
    env["FEISHU_APP_ID"] = config.get("app_id", "")
    env["FEISHU_APP_SECRET"] = config.get("app_secret", "")

    if config.get("mode") == "user" and config.get("user_token"):
        env["FEISHU_USER_ACCESS_TOKEN"] = config["user_token"]

    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool,
                "arguments": params,
            },
            "id": 1,
        }
    )

    try:
        result = subprocess.run(
            ["npx", "-y", "feishu-mcp", "--stdio"],
            input=payload,
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"MCP call failed: {result.stderr}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        print("error: `npx` was not found. Install Node.js first.", file=sys.stderr)
        print("Then install Feishu MCP with: npm install -g feishu-mcp", file=sys.stderr)
        sys.exit(1)


def extract_doc_token(url: str) -> tuple[str, str]:
    """Extract the document token and type from a Feishu URL."""
    import re

    patterns = [
        (r"/wiki/([A-Za-z0-9]+)", "wiki"),
        (r"/docx/([A-Za-z0-9]+)", "docx"),
        (r"/docs/([A-Za-z0-9]+)", "doc"),
        (r"/sheets/([A-Za-z0-9]+)", "sheet"),
        (r"/base/([A-Za-z0-9]+)", "base"),
    ]
    for pattern, doc_type in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1), doc_type
    raise ValueError(f"could not extract a document token from URL: {url}")


def fetch_doc_via_mcp(url: str, config: dict) -> str:
    """Read a Feishu document or wiki page through MCP."""
    token, doc_type = extract_doc_token(url)

    if doc_type == "wiki":
        result = call_mcp("get_wiki_node", {"token": token}, config)
    elif doc_type in ("docx", "doc"):
        result = call_mcp("get_doc_content", {"doc_token": token}, config)
    elif doc_type == "sheet":
        result = call_mcp("get_spreadsheet_content", {"spreadsheet_token": token}, config)
    else:
        raise ValueError(f"unsupported document type: {doc_type}")

    if "result" in result:
        content = result["result"]
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    return item.get("text", "")
        elif isinstance(content, str):
            return content
    elif "error" in result:
        raise RuntimeError(f"MCP returned an error: {result['error']}")

    return json.dumps(result, ensure_ascii=False, indent=2)


def fetch_messages_via_mcp(
    chat_id: str,
    target_name: str,
    limit: int,
    config: dict,
) -> str:
    """Read group-chat messages through MCP."""
    result = call_mcp(
        "get_chat_messages",
        {
            "chat_id": chat_id,
            "page_size": min(limit, 50),
        },
        config,
    )

    messages = []
    raw = result.get("result", [])
    if isinstance(raw, list):
        messages = raw
    elif isinstance(raw, str):
        try:
            messages = json.loads(raw)
        except Exception:
            return raw

    if target_name:
        messages = [
            message
            for message in messages
            if target_name in str(message.get("sender", {}).get("name", ""))
        ]

    long_msgs = [message for message in messages if len(str(message.get("content", ""))) > 50]
    short_msgs = [message for message in messages if len(str(message.get("content", ""))) <= 50]

    lines = [
        "# Feishu Messages (MCP)",
        f"Chat ID: {chat_id}",
        f"Target: {target_name or 'all'}",
        f"Total messages: {len(messages)}",
        "",
        "---",
        "",
        "## Long Messages",
        "",
    ]
    for message in long_msgs:
        sender = message.get("sender", {}).get("name", "")
        content = message.get("content", "")
        timestamp = message.get("create_time", "")
        lines.append(f"[{timestamp}] {sender}: {content}")
        lines.append("")

    lines += ["---", "", "## Daily Messages", ""]
    for message in short_msgs[:200]:
        sender = message.get("sender", {}).get("name", "")
        content = message.get("content", "")
        lines.append(f"{sender}: {content}")

    return "\n".join(lines)


def list_wiki_docs(space_id: str, config: dict) -> str:
    """List all docs inside a wiki space."""
    result = call_mcp("list_wiki_nodes", {"space_id": space_id}, config)
    raw = result.get("result", "")
    if isinstance(raw, str):
        return raw
    return json.dumps(raw, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Feishu MCP client")
    parser.add_argument("--setup", action="store_true", help="initialize local configuration")
    parser.add_argument("--url", help="Feishu doc / wiki / sheet URL")
    parser.add_argument("--chat-id", help="chat ID (format: oc_xxx)")
    parser.add_argument("--target", help="target person name")
    parser.add_argument("--limit", type=int, default=500, help="maximum number of messages to fetch")
    parser.add_argument("--list-wiki", action="store_true", help="list wiki documents")
    parser.add_argument("--space-id", help="wiki space ID")
    parser.add_argument("--output", default=None, help="output file path")

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    config = load_config()
    if not config:
        print("error: not configured yet. Run `python3 feishu_mcp_client.py --setup` first.", file=sys.stderr)
        sys.exit(1)

    content = ""

    if args.url:
        print(f"reading via MCP: {args.url}", file=sys.stderr)
        content = fetch_doc_via_mcp(args.url, config)
    elif args.chat_id:
        print(f"reading chat via MCP: {args.chat_id}", file=sys.stderr)
        content = fetch_messages_via_mcp(
            args.chat_id,
            args.target or "",
            args.limit,
            config,
        )
    elif args.list_wiki:
        if not args.space_id:
            print("error: --list-wiki requires --space-id", file=sys.stderr)
            sys.exit(1)
        content = list_wiki_docs(args.space_id, config)
    else:
        parser.print_help()
        return

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"saved to {args.output}", file=sys.stderr)
    else:
        print(content)


if __name__ == "__main__":
    main()
