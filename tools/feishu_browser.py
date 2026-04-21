#!/usr/bin/env python3
"""
Feishu browser collector (Playwright-based).

Reuses the local Chrome login session so no API token is required. This is
useful for Feishu content that is only accessible through your existing login.

Supports:
  - Feishu docs (`docx` / `docs`)
  - Feishu wiki pages
  - Feishu sheets -> exported as CSV-like text
  - Feishu chat messages from a specific group

Install:
  pip install playwright
  playwright install chromium

Usage:
  python3 feishu_browser.py --url "https://xxx.feishu.cn/wiki/xxx" --output out.txt
  python3 feishu_browser.py --url "https://xxx.feishu.cn/docx/xxx" --output out.txt
  python3 feishu_browser.py --chat "backend-team" --target "Zhang San" --limit 500 --output out.txt
  python3 feishu_browser.py --url "https://xxx.feishu.cn/sheets/xxx" --output out.csv
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from pathlib import Path
from typing import Optional


def get_default_chrome_profile() -> str:
    """Return the default Chrome profile path for the current OS."""
    system = platform.system()
    if system == "Darwin":
        return str(Path.home() / "Library/Application Support/Google/Chrome/Default")
    if system == "Linux":
        return str(Path.home() / ".config/google-chrome/Default")
    if system == "Windows":
        import os

        return str(Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data/Default")
    return str(Path.home() / ".config/google-chrome/Default")


def make_context(playwright, chrome_profile: Optional[str], headless: bool):
    """Create a persistent browser context that reuses Chrome login state."""
    profile = chrome_profile or get_default_chrome_profile()
    try:
        return playwright.chromium.launch_persistent_context(
            user_data_dir=profile,
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            ignore_default_args=["--enable-automation"],
            viewport={"width": 1280, "height": 900},
        )
    except Exception as exc:
        print(f"warning: could not load Chrome profile: {exc}", file=sys.stderr)
        print(f"attempted path: {profile}", file=sys.stderr)
        print("use --chrome-profile to specify a profile path manually", file=sys.stderr)
        sys.exit(1)


def detect_page_type(url: str) -> str:
    """Guess the Feishu page type from the URL."""
    if "/wiki/" in url:
        return "wiki"
    if "/docx/" in url or "/docs/" in url:
        return "doc"
    if "/sheets/" in url or "/spreadsheets/" in url:
        return "sheet"
    if "/base/" in url:
        return "base"
    return "unknown"


def fetch_doc(page, url: str) -> str:
    """Fetch the visible text from a Feishu document or wiki page."""
    page.goto(url, wait_until="domcontentloaded", timeout=30000)

    selectors = [
        ".docs-reader-content",
        ".lark-editor-content",
        "[data-block-type]",
        ".doc-render-core",
        ".wiki-content",
        ".node-doc-content",
    ]

    loaded = False
    for selector in selectors:
        try:
            page.wait_for_selector(selector, timeout=15000)
            loaded = True
            break
        except Exception:
            continue

    if not loaded:
        time.sleep(5)

    time.sleep(2)

    for selector in selectors:
        try:
            element = page.query_selector(selector)
            if element:
                text = element.inner_text()
                if len(text.strip()) > 50:
                    return text.strip()
        except Exception:
            continue

    return page.inner_text("body").strip()


def fetch_sheet(page, url: str) -> str:
    """Fetch sheet content and return it in a CSV-like text format."""
    page.goto(url, wait_until="domcontentloaded", timeout=30000)

    try:
        page.wait_for_selector(".spreadsheet-container, .sheet-container", timeout=15000)
    except Exception:
        time.sleep(5)

    time.sleep(3)

    data = page.evaluate(
        """
        () => {
            const rows = [];
            const cells = document.querySelectorAll('[data-row][data-col]');
            if (cells.length === 0) return null;

            const grid = {};
            let maxRow = 0;
            let maxCol = 0;

            cells.forEach(cell => {
                const r = parseInt(cell.getAttribute('data-row'));
                const c = parseInt(cell.getAttribute('data-col'));
                if (!grid[r]) grid[r] = {};
                grid[r][c] = cell.innerText.replace(/\\n/g, ' ').trim();
                maxRow = Math.max(maxRow, r);
                maxCol = Math.max(maxCol, c);
            });

            for (let r = 0; r <= maxRow; r++) {
                const row = [];
                for (let c = 0; c <= maxCol; c++) {
                    row.push(grid[r] && grid[r][c] ? grid[r][c] : '');
                }
                rows.push(row);
            }

            return rows;
        }
        """
    )

    if data:
        lines = []
        for row in data:
            lines.append(",".join(f'"{cell}"' for cell in row))
        return "\n".join(lines)

    return page.inner_text("body")


def fetch_messages(page, chat_name: str, target_name: str, limit: int = 500) -> str:
    """Fetch messages from a Feishu group chat, optionally filtered by sender."""
    page.goto("https://applink.feishu.cn/client/chat/open", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)

    try:
        search_btn = page.query_selector(
            '[data-test-id="search-btn"], .search-button, [placeholder*="搜索"]'
        )
        if search_btn:
            search_btn.click()
            time.sleep(1)
            page.keyboard.type(chat_name)
            time.sleep(2)

            result = page.query_selector(".search-result-item:first-child, .im-search-item:first-child")
            if result:
                result.click()
                time.sleep(2)
    except Exception as exc:
        print(f"warning: automatic chat search failed: {exc}", file=sys.stderr)
        print(f"manually open chat '{chat_name}', then press Enter to continue...", file=sys.stderr)
        input()

    print("loading message history...", file=sys.stderr)
    messages_container = page.query_selector(".message-list, .im-message-list, [data-testid='message-list']")

    if messages_container:
        for _ in range(10):
            page.evaluate("el => el.scrollTop = 0", messages_container)
            time.sleep(1.5)
    else:
        for _ in range(10):
            page.keyboard.press("Control+Home")
            time.sleep(1.5)

    time.sleep(2)

    messages = page.evaluate(
        f"""
        () => {{
            const target = "{target_name}";
            const results = [];

            const msgSelectors = [
                '.message-item',
                '.im-message-item',
                '[data-message-id]',
                '.msg-list-item',
            ];

            let items = [];
            for (const sel of msgSelectors) {{
                items = document.querySelectorAll(sel);
                if (items.length > 0) break;
            }}

            items.forEach(item => {{
                const senderEl = item.querySelector(
                    '.sender-name, .message-sender, [data-testid="sender-name"], .name'
                );
                const contentEl = item.querySelector(
                    '.message-content, .msg-content, [data-testid="message-content"], .text-content'
                );
                const timeEl = item.querySelector(
                    '.message-time, .msg-time, [data-testid="message-time"], .time'
                );

                const sender = senderEl ? senderEl.innerText.trim() : '';
                const content = contentEl ? contentEl.innerText.trim() : '';
                const time = timeEl ? timeEl.innerText.trim() : '';

                if (!content) return;
                if (target && !sender.includes(target)) return;

                results.push({{ sender, content, time }});
            }});

            return results.slice(-{limit});
        }}
        """
    )

    if not messages:
        print("warning: could not extract structured messages automatically; falling back to page text", file=sys.stderr)
        return page.inner_text("body")

    long_msgs = [message for message in messages if len(message.get("content", "")) > 50]
    short_msgs = [message for message in messages if len(message.get("content", "")) <= 50]

    lines = [
        "# Feishu Messages (browser)",
        f"Chat: {chat_name}",
        f"Target: {target_name or 'all'}",
        f"Total messages: {len(messages)}",
        "",
        "---",
        "",
        "## Long Messages (opinions / decisions)",
        "",
    ]
    for message in long_msgs:
        lines.append(f"[{message.get('time', '')}] {message.get('content', '')}")
        lines.append("")

    lines += ["---", "", "## Daily Messages", ""]
    for message in short_msgs[:200]:
        lines.append(f"[{message.get('time', '')}] {message.get('content', '')}")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Feishu browser collector (reuses Chrome login state)")
    parser.add_argument("--url", help="Feishu doc / wiki / sheet URL")
    parser.add_argument("--chat", help="group-chat name (used when collecting messages)")
    parser.add_argument("--target", help="target person name (only extract this person's messages)")
    parser.add_argument("--limit", type=int, default=500, help="maximum number of messages to fetch (default: 500)")
    parser.add_argument("--output", default=None, help="output file path (defaults to stdout)")
    parser.add_argument("--chrome-profile", default=None, help="Chrome profile path (auto-detected by default)")
    parser.add_argument("--headless", action="store_true", help="run in headless mode")
    parser.add_argument("--show-browser", action="store_true", help="show the browser window (useful for login or debugging)")

    args = parser.parse_args()

    if not args.url and not args.chat:
        parser.error("provide either --url or --chat")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("error: install Playwright first: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    headless = args.headless and not args.show_browser

    print(f"launching browser ({'headless' if headless else 'headed'} mode)...", file=sys.stderr)

    with sync_playwright() as playwright:
        ctx = make_context(playwright, args.chrome_profile, headless=headless)
        page = ctx.new_page()

        page.goto("https://www.feishu.cn", wait_until="domcontentloaded", timeout=15000)
        time.sleep(2)
        if "login" in page.url.lower() or "signin" in page.url.lower():
            print("warning: Feishu appears to be logged out.", file=sys.stderr)
            print("log in in the opened browser window, then press Enter to continue...", file=sys.stderr)
            if headless:
                print("hint: rerun with --show-browser so you can complete the login flow", file=sys.stderr)
                sys.exit(1)
            input()

        if args.url:
            page_type = detect_page_type(args.url)
            print(f"detected page type: {page_type}; starting extraction...", file=sys.stderr)

            if page_type == "sheet":
                content = fetch_sheet(page, args.url)
            else:
                content = fetch_doc(page, args.url)
        else:
            content = fetch_messages(
                page,
                chat_name=args.chat,
                target_name=args.target or "",
                limit=args.limit,
            )

        ctx.close()

    if not content or len(content.strip()) < 10:
        print("warning: no meaningful content could be extracted", file=sys.stderr)
        sys.exit(1)

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"saved to {args.output} ({len(content)} chars)", file=sys.stderr)
    else:
        print(content)


if __name__ == "__main__":
    main()
