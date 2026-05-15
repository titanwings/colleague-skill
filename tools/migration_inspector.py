#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from schema_planner import build_schema_manifest
from utils import (
    run_json_command,
)


SUBJECT_SCORE_HINTS = (
    "小测",
    "阶段",
    "期中",
    "期末",
    "复数",
    "向量",
    "数学",
    "竞赛",
    "平均排名",
)


def fetch_feishu_structure(base_token: str) -> Dict[str, Any]:
    tables = run_json_command(
        ["lark-cli", "base", "+table-list", "--base-token", base_token, "--offset", "0", "--limit", "100"]
    )["data"]["items"]
    table_details = []
    for table in tables:
        fields = run_json_command(
            [
                "lark-cli",
                "base",
                "+field-list",
                "--base-token",
                base_token,
                "--table-id",
                table["table_id"],
                "--offset",
                "0",
                "--limit",
                "200",
            ]
        )["data"]["items"]
        table_details.append(
            {
                "table_id": table["table_id"],
                "table_name": table["table_name"],
                "fields": fields,
            }
        )
    return {"tables": table_details}


def classify_structure(structure: Dict[str, Any]) -> Dict[str, Any]:
    tables = structure["tables"]
    table_names = {table["table_name"] for table in tables}
    standard_tables = {table["name"] for table in build_schema_manifest()["tables"]}

    if len(standard_tables.intersection(table_names)) >= 6:
        return {
            "classification": "headteacher_workspace",
            "confidence": "high",
            "reason": "Most standard headteacher tables are already present.",
            "recommendation": "connect_existing",
        }

    subject_evidence: List[str] = []
    for table in tables:
        field_names = [field["field_name"] for field in table["fields"]]
        if table["table_name"] == "学生信息":
            score_like = [name for name in field_names if any(hint in name for hint in SUBJECT_SCORE_HINTS)]
            if score_like:
                subject_evidence.append(f"`学生信息` mixes profile fields and score columns: {', '.join(score_like[:6])}")
        if table["table_name"] == "学生记录":
            required = {"时间", "评价", "类型", "学生"}
            if required.issubset(set(field_names)):
                subject_evidence.append("`学生记录` looks like a generic subject-teacher event log with plain-text student references")

    if {"学生信息", "学生记录"}.issubset(table_names) and subject_evidence:
        return {
            "classification": "subject_teacher_base",
            "confidence": "high",
            "reason": "The structure matches a subject-teacher roster plus generic record log.",
            "recommendation": "copy_and_refactor",
            "evidence": subject_evidence,
        }

    generic_notes = []
    for table in tables:
        field_names = [field["field_name"] for field in table["fields"]]
        generic_notes.append(f"{table['table_name']}: {', '.join(field_names[:8])}")
    return {
        "classification": "generic_base",
        "confidence": "medium",
        "reason": "The structure does not match the standard headteacher model or the known subject-teacher template exactly.",
        "recommendation": "inspect_and_map",
        "evidence": generic_notes,
    }


def render_markdown(result: Dict[str, Any]) -> str:
    lines = ["# Migration Inspection", ""]
    lines.append(f"- Classification: `{result['classification']}`")
    lines.append(f"- Confidence: `{result['confidence']}`")
    lines.append(f"- Recommendation: `{result['recommendation']}`")
    lines.append(f"- Reason: {result['reason']}")
    evidence = result.get("evidence", [])
    if evidence:
        lines.append("")
        lines.append("## Evidence")
        lines.append("")
        for item in evidence:
            lines.append(f"- {item}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect an existing Feishu Base and classify it for migration.")
    subparsers = parser.add_subparsers(dest="backend", required=True)

    feishu = subparsers.add_parser("feishu", help="Inspect a Feishu Base.")
    feishu.add_argument("--base-token", required=True)
    feishu.add_argument("--format", default="json", choices=["json", "markdown"])

    args = parser.parse_args()
    structure = fetch_feishu_structure(args.base_token)
    result = classify_structure(structure)
    result["base_token"] = args.base_token
    result["tables"] = [
        {
            "table_id": table["table_id"],
            "table_name": table["table_name"],
            "fields": [field["field_name"] for field in table["fields"]],
        }
        for table in structure["tables"]
    ]

    if args.format == "json":
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
