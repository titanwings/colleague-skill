#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from schema_planner import (
    build_schema_manifest,
    build_table_specs,
    build_workspace_manifest_template,
)
from setup_doctor import check_feishu_backend
from utils import (
    ensure_state_dir,
    find_first_key,
    run_json_command,
    STATE_DIR,
)


WORKSPACE_MANIFEST_PATH = STATE_DIR / "workspace_manifest.json"


class FeishuBaseAdapter:
    def check_prerequisites(self) -> Dict[str, Any]:
        return check_feishu_backend()

    def authenticate(self) -> Dict[str, Any]:
        status = self.check_prerequisites()
        if status["installed"] and status["configured"]:
            return {"status": "ready", "message": "lark-cli is configured."}
        if not status["installed"]:
            return {"status": "missing_cli", "message": "Install lark-cli first."}
        return {"status": "needs_config", "message": "Run `lark-cli config init --new`."}

    def describe_limitations(self) -> Dict[str, Any]:
        return {
            "backend": "feishu_base",
            "limitations": [
                "v1 creates schema, relation fields, base views, and optional empty dashboards",
                "v1 does not fully configure dashboard blocks",
                "v1 does not overwrite an existing Base by default",
            ],
        }

    def read_entities(self, query_spec: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "not_implemented", "query_spec": query_spec}

    def write_entities(self, change_set: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "not_implemented", "change_set": change_set}

    def materialize_views(self, view_manifest: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "not_implemented", "view_manifest": view_manifest}

    def register_artifact(self, record: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "delegate_to_artifact_registry", "record": record}

    def _create_base(self, workspace_name: str, folder_token: str, time_zone: str) -> Dict[str, Any]:
        cmd = ["lark-cli", "base", "+base-create", "--name", workspace_name, "--time-zone", time_zone]
        if folder_token:
            cmd.extend(["--folder-token", folder_token])
        response = run_json_command(cmd)
        base = find_first_key(response, "base") or {}
        base_token = base.get("base_token") or base.get("app_token") or find_first_key(response, "base_token")
        return {
            "base_token": base_token,
            "name": base.get("name", workspace_name),
            "url": base.get("url", ""),
            "raw": response,
        }

    def _create_table(self, base_token: str, table_name: str, fields: List[Dict[str, Any]], views: List[Dict[str, Any]]) -> Dict[str, Any]:
        cmd = [
            "lark-cli",
            "base",
            "+table-create",
            "--base-token",
            base_token,
            "--name",
            table_name,
            "--fields",
            json.dumps(fields, ensure_ascii=False),
        ]
        if views:
            cmd.extend(["--view", json.dumps(views, ensure_ascii=False)])
        response = run_json_command(cmd)
        table_id = find_first_key(response, "table_id")
        return {"table_id": table_id, "raw": response}

    def _create_link_field(self, base_token: str, table_id: str, field_json: Dict[str, Any]) -> Dict[str, Any]:
        cmd = [
            "lark-cli",
            "base",
            "+field-create",
            "--base-token",
            base_token,
            "--table-id",
            table_id,
            "--json",
            json.dumps(field_json, ensure_ascii=False),
        ]
        response = run_json_command(cmd)
        return {"field_id": find_first_key(response, "field_id"), "raw": response}

    def _create_dashboard(self, base_token: str, name: str, theme_style: str) -> Dict[str, Any]:
        cmd = [
            "lark-cli",
            "base",
            "+dashboard-create",
            "--base-token",
            base_token,
            "--name",
            name,
            "--theme-style",
            theme_style,
        ]
        response = run_json_command(cmd)
        dashboard_id = response.get("dashboard_id") or find_first_key(response, "dashboard_id")
        return {"dashboard_id": dashboard_id, "name": name, "raw": response}

    def build_execution_plan(self, workspace_name: str, base_token: str = "", create_dashboards: bool = False) -> Dict[str, Any]:
        manifest = build_schema_manifest()
        table_specs = build_table_specs()
        plan: Dict[str, Any] = {
            "workspace_name": workspace_name,
            "backend": "feishu_base",
            "base_action": "reuse_existing" if base_token else "create_new",
            "tables": [],
            "dashboards": manifest["dashboards"] if create_dashboards else [],
        }
        for table in table_specs:
            plan["tables"].append(
                {
                    "name": table.name,
                    "create_fields": table.feishu_table_create_fields(),
                    "link_fields": [field.public_dict() for field in table.fields if field.field_type == "link"],
                    "views": [view.public_dict() for view in table.views],
                }
            )
        return plan

    def bootstrap_workspace(
        self,
        workspace_name: str,
        base_token: str = "",
        folder_token: str = "",
        time_zone: str = "Asia/Shanghai",
        create_dashboards: bool = False,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        prerequisites = self.check_prerequisites()
        if not prerequisites["installed"]:
            raise RuntimeError("lark-cli is not installed.")
        if not prerequisites["configured"]:
            raise RuntimeError("lark-cli is not configured. Run `lark-cli config init --new` first.")

        plan = self.build_execution_plan(workspace_name, base_token=base_token, create_dashboards=create_dashboards)
        if dry_run:
            return {"status": "dry_run", "plan": plan}

        base_info = {"base_token": base_token, "name": workspace_name, "url": ""}
        if not base_token:
            base_info = self._create_base(workspace_name, folder_token, time_zone)
            if not base_info["base_token"]:
                raise RuntimeError("Unable to resolve the new base token from lark-cli output.")

        table_specs = build_table_specs()
        table_lookup: Dict[str, str] = {}
        created_tables: List[Dict[str, Any]] = []
        for table in table_specs:
            response = self._create_table(
                base_token=base_info["base_token"],
                table_name=table.name,
                fields=table.feishu_table_create_fields(),
                views=[view.public_dict() for view in table.views],
            )
            if not response["table_id"]:
                raise RuntimeError(f"Unable to resolve table_id for table {table.name}.")
            table_lookup[table.name] = response["table_id"]
            created_tables.append({"name": table.name, "table_id": response["table_id"]})

        created_link_fields: List[Dict[str, Any]] = []
        for table in table_specs:
            table_id = table_lookup[table.name]
            for link_field in table.feishu_link_fields(table_lookup):
                response = self._create_link_field(base_info["base_token"], table_id, link_field)
                created_link_fields.append(
                    {
                        "table_name": table.name,
                        "field_name": link_field["name"],
                        "field_id": response["field_id"],
                    }
                )

        created_dashboards: List[Dict[str, Any]] = []
        if create_dashboards:
            for dashboard in build_schema_manifest()["dashboards"]:
                created_dashboards.append(
                    self._create_dashboard(base_info["base_token"], dashboard["name"], dashboard["theme_style"])
                )

        workspace_manifest = build_workspace_manifest_template(workspace_name, "feishu_base")
        workspace_manifest.update(
            {
                "status": "ready",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "base": {
                    "base_token": base_info["base_token"],
                    "name": base_info["name"],
                    "url": base_info["url"],
                },
                "tables": created_tables,
                "dashboards": [
                    {"name": item["name"], "dashboard_id": item["dashboard_id"]} for item in created_dashboards
                ],
                "capabilities": {
                    "setup_complete": True,
                    "artifact_generation": True,
                    "remote_sync": True,
                },
            }
        )
        ensure_state_dir()
        WORKSPACE_MANIFEST_PATH.write_text(
            json.dumps(workspace_manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        return {
            "status": "ready",
            "base": workspace_manifest["base"],
            "tables": created_tables,
            "link_fields": created_link_fields,
            "dashboards": workspace_manifest["dashboards"],
            "workspace_manifest_path": str(WORKSPACE_MANIFEST_PATH),
        }


def render_markdown(result: Dict[str, Any]) -> str:
    if "limitations" in result:
        lines = ["# Feishu Backend Limitations", ""]
        for item in result["limitations"]:
            lines.append(f"- {item}")
        return "\n".join(lines)

    if result["status"] == "dry_run":
        plan = result["plan"]
        lines = ["# Feishu Bootstrap Plan", ""]
        lines.append(f"- Workspace: `{plan['workspace_name']}`")
        lines.append(f"- Base action: `{plan['base_action']}`")
        lines.append("")
        lines.append("## Tables")
        lines.append("")
        for table in plan["tables"]:
            lines.append(f"### {table['name']}")
            lines.append(f"- Create fields: {', '.join(field['name'] for field in table['create_fields'])}")
            if table["link_fields"]:
                lines.append(f"- Link fields: {', '.join(field['name'] for field in table['link_fields'])}")
            lines.append(f"- Views: {', '.join(view['name'] for view in table['views'])}")
            lines.append("")
        if plan["dashboards"]:
            lines.append("## Dashboards")
            lines.append("")
            for dashboard in plan["dashboards"]:
                lines.append(f"- {dashboard['name']}")
        return "\n".join(lines)

    lines = ["# Feishu Bootstrap Result", ""]
    lines.append(f"- Status: `{result['status']}`")
    lines.append(f"- Base token: `{result['base']['base_token']}`")
    if result["base"].get("url"):
        lines.append(f"- Base URL: {result['base']['url']}")
    lines.append(f"- Workspace manifest: `{result['workspace_manifest_path']}`")
    lines.append("")
    lines.append("## Tables")
    lines.append("")
    for table in result["tables"]:
        lines.append(f"- {table['name']} (`{table['table_id']}`)")
    if result["dashboards"]:
        lines.append("")
        lines.append("## Dashboards")
        lines.append("")
        for dashboard in result["dashboards"]:
            lines.append(f"- {dashboard['name']} (`{dashboard['dashboard_id']}`)")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap the Feishu Base workspace for the headteacher skill.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    bootstrap = subparsers.add_parser("bootstrap", help="Create or reuse a Feishu Base and write the standard schema.")
    bootstrap.add_argument("--workspace-name", required=True)
    bootstrap.add_argument("--base-token", default="")
    bootstrap.add_argument("--folder-token", default="")
    bootstrap.add_argument("--time-zone", default="Asia/Shanghai")
    bootstrap.add_argument("--create-dashboards", action="store_true")
    bootstrap.add_argument("--dry-run", action="store_true")
    bootstrap.add_argument("--format", default="json", choices=["json", "markdown"])

    plan = subparsers.add_parser("plan", help="Emit a dry-run bootstrap plan.")
    plan.add_argument("--workspace-name", required=True)
    plan.add_argument("--base-token", default="")
    plan.add_argument("--create-dashboards", action="store_true")
    plan.add_argument("--format", default="json", choices=["json", "markdown"])

    limitations = subparsers.add_parser("describe-limitations", help="Show Feishu backend limitations.")
    limitations.add_argument("--format", default="json", choices=["json", "markdown"])

    args = parser.parse_args()
    adapter = FeishuBaseAdapter()

    if args.command == "describe-limitations":
        result = adapter.describe_limitations()
    elif args.command == "plan":
        result = {"status": "dry_run", "plan": adapter.build_execution_plan(args.workspace_name, args.base_token, args.create_dashboards)}
    else:
        result = adapter.bootstrap_workspace(
            workspace_name=args.workspace_name,
            base_token=args.base_token,
            folder_token=args.folder_token,
            time_zone=args.time_zone,
            create_dashboards=args.create_dashboards,
            dry_run=args.dry_run,
        )

    output_format = getattr(args, "format", "json")
    if output_format == "json":
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
