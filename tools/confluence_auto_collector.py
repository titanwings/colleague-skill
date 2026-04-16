#!/usr/bin/env python3
"""
Confluence auto-collector

Input a colleague's Confluence username/display name, automatically:
  1. Search Confluence user
  2. Pull pages created/edited by the user
  3. Pull comments/replies by the user
  4. Output in unified format for create-colleague analysis

Setup:
  python3 confluence_auto_collector.py --setup

Usage:
  python3 confluence_auto_collector.py --name "John Doe" --output-dir ./knowledge/john
  python3 confluence_auto_collector.py --name "john.doe" --doc-limit 30 --space-key DEV

Requirements:
  Confluence Cloud: API Token (https://id.atlassian.com/manage-profile/security/api-tokens)
  Confluence Server/DC: username + password, or Personal Access Token
"""

from __future__ import annotations

import json
import sys
import time
import argparse
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote
from base64 import b64encode

try:
    import requests
except ImportError:
    print(
        "Error: please install requests first: pip3 install requests",
        file=sys.stderr,
    )
    sys.exit(1)

# --- Constants ----------------------------------------------------------------

CONFIG_PATH = Path.home() / ".colleague-skill" / "confluence_config.json"

MAX_RETRIES = 5
RETRY_BASE_WAIT = 1.0
RETRY_MAX_WAIT = 60.0

DEFAULT_DOC_LIMIT = 50
DEFAULT_COMMENT_LIMIT = 200


# --- Error types --------------------------------------------------------------


class CollectorError(Exception):
    pass


class AuthError(CollectorError):
    pass


class PermissionError_(CollectorError):
    pass


# --- Config management --------------------------------------------------------


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(
            "Config not found. Run: python3 confluence_auto_collector.py --setup",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        return json.loads(CONFIG_PATH.read_text())
    except json.JSONDecodeError:
        print(f"Config file corrupted, re-run --setup: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))


def setup_config() -> None:
    print("=== Confluence Auto-Collector Setup ===\n")
    print("Supports Confluence Cloud and Server/Data Center\n")

    print("Select Confluence type:")
    print("  [1] Confluence Cloud (xxx.atlassian.net)")
    print("  [2] Confluence Server / Data Center")
    choice = input("\nChoose [1/2] (default 1): ").strip() or "1"

    if choice == "1":
        print("\n--- Confluence Cloud ---")
        print(
            "Step 1: Go to https://id.atlassian.com/manage-profile/security/api-tokens"
        )
        print("        Create an API Token\n")

        base_url = input(
            "Confluence URL (e.g. https://yourcompany.atlassian.net): "
        ).strip()
        if not base_url.startswith("http"):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")

        email = input("Atlassian account email: ").strip()
        api_token = input("API Token: ").strip()

        config = {
            "type": "cloud",
            "base_url": base_url,
            "email": email,
            "api_token": api_token,
        }
    else:
        print("\n--- Confluence Server/DC ---")
        base_url = input(
            "Confluence URL (e.g. https://confluence.yourcompany.com): "
        ).strip()
        if not base_url.startswith("http"):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")

        print("\nAuth method:")
        print("  [1] Username + Password")
        print("  [2] Personal Access Token (PAT)")
        auth_choice = input("Choose [1/2] (default 1): ").strip() or "1"

        if auth_choice == "2":
            token = input("Personal Access Token: ").strip()
            config = {
                "type": "server",
                "base_url": base_url,
                "auth_method": "pat",
                "token": token,
            }
        else:
            username = input("Username: ").strip()
            password = input("Password: ").strip()
            config = {
                "type": "server",
                "base_url": base_url,
                "auth_method": "basic",
                "username": username,
                "password": password,
            }

    # Verify connection
    print("\nVerifying connection ...", end=" ", flush=True)
    try:
        client = ConfClient(config)
        info = client.get("/rest/api/space", params={"limit": 1})
        if info is not None:
            print("OK")
            spaces = info.get("results", [])
            if spaces:
                print(
                    f"  Accessible space: {spaces[0].get('key')} - {spaces[0].get('name')}"
                )
        else:
            print("Connection failed", file=sys.stderr)
            sys.exit(1)
    except AuthError as e:
        print(f"Auth failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    save_config(config)
    print(f"\nConfig saved to {CONFIG_PATH}")


# --- Confluence HTTP Client ---------------------------------------------------


class ConfClient:
    """Confluence REST API client with rate-limit retry."""

    def __init__(self, config: dict) -> None:
        self._base_url = config["base_url"]
        self._session = requests.Session()
        self._session.headers["Accept"] = "application/json"

        conf_type = config.get("type", "cloud")
        if conf_type == "cloud":
            email = config["email"]
            token = config["api_token"]
            cred = b64encode(f"{email}:{token}".encode()).decode()
            self._session.headers["Authorization"] = f"Basic {cred}"
        else:
            auth_method = config.get("auth_method", "basic")
            if auth_method == "pat":
                self._session.headers["Authorization"] = f"Bearer {config['token']}"
            else:
                cred = b64encode(
                    f"{config['username']}:{config['password']}".encode()
                ).decode()
                self._session.headers["Authorization"] = f"Basic {cred}"

    def get(self, path: str, params: dict = None) -> Optional[dict]:
        return self._request("GET", path, params=params)

    def _request(self, method: str, path: str, **kwargs) -> Optional[dict]:
        url = self._base_url + path

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = self._session.request(method, url, timeout=30, **kwargs)
            except requests.RequestException as e:
                print(f"  [Network error] {e}", file=sys.stderr)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BASE_WAIT * attempt)
                    continue
                return None

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code == 401:
                raise AuthError("Invalid credentials. Re-run --setup.")

            if resp.status_code == 403:
                raise PermissionError_(f"Permission denied: {path}")

            if resp.status_code == 429:
                wait = float(resp.headers.get("Retry-After", RETRY_BASE_WAIT * attempt))
                wait = min(wait, RETRY_MAX_WAIT)
                print(
                    f"  [Rate limit] waiting {wait:.0f}s (attempt {attempt}/{MAX_RETRIES})...",
                    file=sys.stderr,
                )
                time.sleep(wait)
                continue

            if resp.status_code == 404:
                return None

            print(
                f"  [API warning] {method} {path} returned {resp.status_code}",
                file=sys.stderr,
            )
            return None

        print(
            f"  [Error] {method} {path} failed after {MAX_RETRIES} retries",
            file=sys.stderr,
        )
        return None

    def paginate(self, path: str, params: dict = None, limit: int = 50) -> list:
        """Auto-paginate through Confluence REST API results."""
        results = []
        start = 0
        page_size = min(limit, 50)

        while len(results) < limit:
            p = dict(params or {})
            p["start"] = start
            p["limit"] = page_size

            data = self.get(path, params=p)
            if not data:
                break

            page_results = data.get("results", [])
            if not page_results:
                break

            results.extend(page_results)
            start += len(page_results)

            size_info = data.get("size", 0)
            if size_info < page_size:
                break

        return results[:limit]


# --- User search --------------------------------------------------------------


def find_user(name: str, client: ConfClient, config: dict) -> Optional[dict]:
    """Search for a Confluence user by display name or username.

    For Cloud: uses /rest/api/search/user to get accountId (required for CQL).
    For Server/DC: uses /rest/api/search with user.fullname CQL.
    """
    print(f"  Searching user: {name} ...", file=sys.stderr)

    conf_type = config.get("type", "cloud")

    # --- Strategy 1: User search endpoint (Cloud) ---
    if conf_type == "cloud":
        data = client.get(
            "/rest/api/search/user",
            params={"cql": f'user.fullname ~ "{name}"', "limit": 10},
        )
        if data and data.get("results"):
            candidates = data["results"]
            if len(candidates) == 1:
                u = candidates[0].get("user", {})
                _print_found_user(u)
                return _make_user_dict(u)

            # Multiple matches: try exact match first
            for c in candidates:
                u = c.get("user", {})
                dn = u.get("displayName", "")
                # Exact match on name portion (before /)
                dn_name = dn.split("/")[0].strip()
                if dn_name == name or dn == name:
                    _print_found_user(u)
                    return _make_user_dict(u)

            # No exact match: show candidates
            print(f"\n  Found {len(candidates)} matches:", file=sys.stderr)
            for i, c in enumerate(candidates[:10]):
                u = c.get("user", {})
                dn = u.get("displayName", "")
                email = u.get("email", "")
                print(f"    [{i + 1}] {dn}  ({email})", file=sys.stderr)

            choice = input("\n  Choose number (default 1): ").strip() or "1"
            try:
                idx = int(choice) - 1
                u = candidates[idx].get("user", {})
            except (ValueError, IndexError):
                u = candidates[0].get("user", {})

            _print_found_user(u)
            return _make_user_dict(u)

        # Also try by email
        data2 = client.get(
            "/rest/api/search/user",
            params={"cql": f'user.email = "{name}"', "limit": 1},
        )
        if data2 and data2.get("results"):
            u = data2["results"][0].get("u", {})
            _print_found_user(u)
            return _make_user_dict(u)

    # --- Strategy 2: Server/DC user search ---
    else:
        data = client.get(
            "/rest/api/search",
            params={
                "cql": f'user.fullname ~ "{name}"',
                "limit": 10,
            },
        )
        if data and data.get("results"):
            for r in data["results"]:
                u = r.get("user", {})
                if u:
                    _print_found_user(u)
                    return _make_user_dict(u)

    # --- Strategy 3: Find user via content they authored ---
    print(f"  Trying content-based user search...", file=sys.stderr)
    content_data = client.get(
        "/rest/api/search",
        params={
            "cql": f'creator = "{name}" AND type = page ORDER BY lastModified DESC',
            "limit": 1,
            "expand": "content.version",
        },
    )

    if content_data and content_data.get("results"):
        first = content_data["results"][0]
        content = first.get("content", first)
        version = content.get("version", {})
        by = version.get("by", {})
        if by:
            _print_found_user(by)
            return _make_user_dict(by)

    print(f"  User not found: {name}", file=sys.stderr)
    print(
        "  Tip: try the exact display name or username shown in Confluence",
        file=sys.stderr,
    )
    return None


def _make_user_dict(user_data: dict) -> dict:
    """Normalize user data into a standard dict."""
    account_id = user_data.get("accountId", "")
    return {
        "username": user_data.get("username") or account_id,
        "displayName": user_data.get("displayName", ""),
        "accountId": account_id,
        "userKey": user_data.get("userKey", ""),
    }


def _print_found_user(user_data: dict) -> None:
    dn = user_data.get("displayName", "")
    aid = user_data.get("accountId", "")
    email = user_data.get("email", "")
    print(f"  Found user: {dn} ({email or aid})", file=sys.stderr)


# --- HTML to text conversion --------------------------------------------------


def html_to_text(html: str) -> str:
    """Simple HTML to plain text conversion."""
    if not html:
        return ""
    # Remove script/style
    text = re.sub(
        r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE
    )
    # Convert common tags
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<(h[1-6])[^>]*>", "\n## ", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "- ", text, flags=re.IGNORECASE)
    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&nbsp;", " ").replace("&#39;", "'")
    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# --- Content collection -------------------------------------------------------


def collect_pages(
    user: dict,
    client: ConfClient,
    doc_limit: int,
    space_key: Optional[str] = None,
) -> list:
    """Collect pages created or last-modified by the target user."""
    name = user["displayName"]
    # Cloud uses accountId for CQL creator, Server uses username
    creator_id = user.get("accountId") or user.get("username", name)

    print(f"  Fetching pages by {name} ...", file=sys.stderr)

    # Build CQL query
    cql_parts = [f'creator = "{creator_id}" AND type = page']
    if space_key:
        cql_parts.append(f'space = "{space_key}"')
    cql = " AND ".join(cql_parts) + " ORDER BY lastModified DESC"

    pages = []
    start = 0
    page_size = 25

    while len(pages) < doc_limit:
        data = client.get(
            "/rest/api/search",
            params={
                "cql": cql,
                "limit": page_size,
                "start": start,
                "expand": "content.body.storage,content.version,content.space",
            },
        )

        if not data:
            break

        results = data.get("results", [])
        if not results:
            break

        for r in results:
            content = r.get("content", r)
            title = content.get("title", r.get("title", "Untitled"))
            space_info = content.get("space", {})
            space_name = space_info.get("name", space_info.get("key", ""))

            body_storage = content.get("body", {}).get("storage", {}).get("value", "")
            body_text = html_to_text(body_storage)

            version = content.get("version", {})
            modified_by = version.get("by", {}).get("displayName", "")
            modified_when = version.get("when", "")

            if body_text and len(body_text) > 20:
                pages.append(
                    {
                        "title": title,
                        "space": space_name,
                        "content": body_text,
                        "modified_by": modified_by,
                        "modified_when": modified_when[:10] if modified_when else "",
                        "url": content.get("_links", {}).get("webui", ""),
                    }
                )

        start += len(results)
        total_size = data.get("totalSize", data.get("size", 0))
        if start >= total_size or len(results) < page_size:
            break

    # Also fetch pages where user was last modifier (not just creator)
    if len(pages) < doc_limit:
        cql2_parts = [
            f'contributor = "{creator_id}" AND type = page AND creator != "{creator_id}"'
        ]
        if space_key:
            cql2_parts.append(f'space = "{space_key}"')
        cql2 = " AND ".join(cql2_parts) + " ORDER BY lastModified DESC"

        remaining = doc_limit - len(pages)
        data2 = client.get(
            "/rest/api/search",
            params={
                "cql": cql2,
                "limit": min(remaining, 25),
                "expand": "content.body.storage,content.version,content.space",
            },
        )

        if data2:
            for r in data2.get("results", []):
                content = r.get("content", r)
                title = content.get("title", r.get("title", "Untitled"))
                space_info = content.get("space", {})
                space_name = space_info.get("name", space_info.get("key", ""))

                body_storage = (
                    content.get("body", {}).get("storage", {}).get("value", "")
                )
                body_text = html_to_text(body_storage)

                version = content.get("version", {})
                modified_when = version.get("when", "")

                if body_text and len(body_text) > 20:
                    pages.append(
                        {
                            "title": title,
                            "space": space_name,
                            "content": body_text,
                            "modified_by": name,
                            "modified_when": modified_when[:10]
                            if modified_when
                            else "",
                            "url": content.get("_links", {}).get("webui", ""),
                        }
                    )

    print(f"  Collected {len(pages)} pages", file=sys.stderr)
    return pages[:doc_limit]


def collect_comments(
    user: dict,
    client: ConfClient,
    comment_limit: int,
    space_key: Optional[str] = None,
) -> list:
    """Collect comments made by the target user."""
    name = user["displayName"]
    creator_id = user.get("accountId") or user.get("username", name)

    print(f"  Fetching comments by {name} ...", file=sys.stderr)

    cql_parts = [f'creator = "{creator_id}" AND type = comment']
    if space_key:
        cql_parts.append(f'space = "{space_key}"')
    cql = " AND ".join(cql_parts) + " ORDER BY created DESC"

    comments = []
    start = 0
    page_size = 25

    while len(comments) < comment_limit:
        data = client.get(
            "/rest/api/search",
            params={
                "cql": cql,
                "limit": page_size,
                "start": start,
                "expand": "content.body.storage,content.container",
            },
        )

        if not data:
            break

        results = data.get("results", [])
        if not results:
            break

        for r in results:
            content = r.get("content", r)
            body_storage = content.get("body", {}).get("storage", {}).get("value", "")
            body_text = html_to_text(body_storage)

            if not body_text or len(body_text) < 5:
                continue

            container = content.get("container", {})
            page_title = container.get("title", r.get("title", "Unknown page"))

            created = content.get("version", {}).get("when", "")

            comments.append(
                {
                    "page_title": page_title,
                    "content": body_text,
                    "created": created[:10] if created else "",
                }
            )

        start += len(results)
        total_size = data.get("totalSize", data.get("size", 0))
        if start >= total_size or len(results) < page_size:
            break

    print(f"  Collected {len(comments)} comments", file=sys.stderr)
    return comments[:comment_limit]


# --- Format output ------------------------------------------------------------


def format_docs(pages: list, user_name: str) -> str:
    """Format collected pages into unified text output."""
    lines = [
        "# Confluence Pages (Auto-collected)",
        f"Target: {user_name}",
        f"Total: {len(pages)} pages",
        "",
        "---",
        "",
    ]

    # Separate long docs from short ones
    long_pages = [p for p in pages if len(p["content"]) > 200]
    short_pages = [p for p in pages if len(p["content"]) <= 200]

    if long_pages:
        lines.append(
            "## Detailed Documents (high weight: technical docs / design / specs)"
        )
        lines.append("")
        for p in long_pages:
            lines.append(f"### {p['title']}")
            if p["space"]:
                lines.append(f"Space: {p['space']}  |  Modified: {p['modified_when']}")
            lines.append("")
            lines.append(p["content"])
            lines.append("")
            lines.append("---")
            lines.append("")

    if short_pages:
        lines.append("## Short Pages (reference)")
        lines.append("")
        for p in short_pages:
            lines.append(f"### {p['title']}")
            lines.append(p["content"])
            lines.append("")

    return "\n".join(lines)


def format_comments(comments: list, user_name: str) -> str:
    """Format collected comments into unified text output."""
    lines = [
        "# Confluence Comments (Auto-collected)",
        f"Target: {user_name}",
        f"Total: {len(comments)} comments",
        "",
        "---",
        "",
    ]

    # Separate long comments (opinions/reviews) from short ones
    long_comments = [c for c in comments if len(c["content"]) > 50]
    short_comments = [c for c in comments if len(c["content"]) <= 50]

    if long_comments:
        lines.append(
            "## Detailed Comments (high weight: reviews / opinions / discussions)"
        )
        lines.append("")
        for c in long_comments:
            lines.append(f'[{c["created"]}] On "{c["page_title"]}":')
            lines.append(f"  {c['content']}")
            lines.append("")

    if short_comments:
        lines.append("## Short Comments (style reference)")
        lines.append("")
        for c in short_comments[:100]:
            lines.append(f"[{c['created']}] {c['content']}")

    return "\n".join(lines)


# --- Main collection flow -----------------------------------------------------


def collect_all(
    name: str,
    output_dir: Path,
    doc_limit: int,
    comment_limit: int,
    space_key: Optional[str],
    config: dict,
) -> dict:
    """Collect all Confluence data for a colleague, output to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    results: dict = {}

    print(f"\nStarting collection: {name}\n", file=sys.stderr)

    # Init client
    try:
        client = ConfClient(config)
        # Quick connectivity check
        check = client.get("/rest/api/space", params={"limit": 1})
        if check is None:
            raise AuthError("Cannot connect to Confluence")
        print(f"  Connected to: {config['base_url']}", file=sys.stderr)
    except AuthError as e:
        print(f"Auth error: {e}", file=sys.stderr)
        sys.exit(1)

    # Step 1: Find user
    user = find_user(name, client, config)
    if not user:
        print(f"User not found: {name}", file=sys.stderr)
        sys.exit(1)

    display_name = user.get("displayName", name)

    pages = []
    comments = []

    # Step 2: Collect pages
    print(f"\nCollecting pages (limit {doc_limit})...", file=sys.stderr)
    try:
        pages = collect_pages(user, client, doc_limit, space_key)
        if pages:
            doc_content = format_docs(pages, display_name)
            doc_path = output_dir / "docs.txt"
            doc_path.write_text(doc_content, encoding="utf-8")
            results["docs"] = str(doc_path)
            print(f"  Pages -> {doc_path}", file=sys.stderr)
        else:
            print("  No pages found", file=sys.stderr)
    except CollectorError as e:
        print(f"  Page collection failed: {e}", file=sys.stderr)
    except Exception as e:
        print(f"  Page collection error: {e}", file=sys.stderr)

    # Step 3: Collect comments
    print(f"\nCollecting comments (limit {comment_limit})...", file=sys.stderr)
    try:
        comments = collect_comments(user, client, comment_limit, space_key)
        if comments:
            comment_content = format_comments(comments, display_name)
            comment_path = output_dir / "messages.txt"
            comment_path.write_text(comment_content, encoding="utf-8")
            results["comments"] = str(comment_path)
            print(f"  Comments -> {comment_path}", file=sys.stderr)
        else:
            print("  No comments found", file=sys.stderr)
    except CollectorError as e:
        print(f"  Comment collection failed: {e}", file=sys.stderr)
    except Exception as e:
        print(f"  Comment collection error: {e}", file=sys.stderr)

    # Write summary
    summary = {
        "name": display_name,
        "username": user.get("username", ""),
        "source": "confluence",
        "base_url": config["base_url"],
        "space_key": space_key,
        "pages_collected": len(pages),
        "comments_collected": len(comments),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "files": results,
    }
    summary_path = output_dir / "collection_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"  Summary -> {summary_path}", file=sys.stderr)

    print(f"\nCollection complete. Output: {output_dir}", file=sys.stderr)
    return results


# --- CLI entry ----------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Confluence Auto-Collector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # First-time setup
  python3 confluence_auto_collector.py --setup

  # Collect colleague data
  python3 confluence_auto_collector.py --name "John Doe"
  python3 confluence_auto_collector.py --name "john.doe" --output-dir ./knowledge/john --doc-limit 30
  python3 confluence_auto_collector.py --name "John" --space-key DEV --doc-limit 20
        """,
    )
    parser.add_argument("--setup", action="store_true", help="Initialize config")
    parser.add_argument("--name", help="Colleague name or Confluence username")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory (default: ./knowledge/{name})",
    )
    parser.add_argument(
        "--doc-limit",
        type=int,
        default=DEFAULT_DOC_LIMIT,
        help=f"Max pages to collect (default {DEFAULT_DOC_LIMIT})",
    )
    parser.add_argument(
        "--comment-limit",
        type=int,
        default=DEFAULT_COMMENT_LIMIT,
        help=f"Max comments to collect (default {DEFAULT_COMMENT_LIMIT})",
    )
    parser.add_argument(
        "--space-key",
        default=None,
        help="Filter by Confluence space key (e.g. DEV, TEAM)",
    )

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    if not args.name:
        parser.print_help()
        parser.error("Please provide --name")

    config = load_config()
    output_dir = (
        Path(args.output_dir) if args.output_dir else Path(f"./knowledge/{args.name}")
    )

    try:
        collect_all(
            name=args.name,
            output_dir=output_dir,
            doc_limit=args.doc_limit,
            comment_limit=args.comment_limit,
            space_key=args.space_key,
            config=config,
        )
    except CollectorError as e:
        print(f"\nCollection failed: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nCancelled", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
