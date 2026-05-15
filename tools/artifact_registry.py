#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from utils import (
    ensure_state_dir,
    STATE_DIR,
)


REGISTRY_PATH = STATE_DIR / "artifact_registry.json"


def load_registry(path: Path = REGISTRY_PATH) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_registry(records: List[Dict[str, Any]], path: Path = REGISTRY_PATH) -> None:
    ensure_state_dir()
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def register_artifact(args: argparse.Namespace) -> Dict[str, Any]:
    records = load_registry()
    record = {
        "artifact_id": f"artifact-{uuid.uuid4().hex[:10]}",
        "title": args.title,
        "artifact_type": args.artifact_type,
        "related_entity": args.related_entity,
        "template_name": args.template_name,
        "local_path": args.local_path,
        "remote_url": args.remote_url,
        "sync_status": args.sync_status,
        "params_summary": args.params_summary,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    records.append(record)
    save_registry(records)
    return record


def list_artifacts(limit: int) -> List[Dict[str, Any]]:
    records = load_registry()
    return records[-limit:]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage local artifact metadata for the headteacher workbench.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    register = subparsers.add_parser("register", help="Register a generated artifact.")
    register.add_argument("--title", required=True)
    register.add_argument("--artifact-type", required=True, choices=["docx", "xlsx", "pptx"])
    register.add_argument("--related-entity", default="")
    register.add_argument("--template-name", default="")
    register.add_argument("--local-path", required=True)
    register.add_argument("--remote-url", default="")
    register.add_argument("--sync-status", default="仅本地")
    register.add_argument("--params-summary", default="")

    listing = subparsers.add_parser("list", help="List recent artifact records.")
    listing.add_argument("--limit", type=int, default=20)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "register":
        record = register_artifact(args)
        print(json.dumps(record, ensure_ascii=False, indent=2))
        return 0
    if args.command == "list":
        print(json.dumps(list_artifacts(args.limit), ensure_ascii=False, indent=2))
        return 0
    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
