#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from utils import (
    parse_embedded_json,
    run_command,
)


WORKSPACE_MANIFEST = Path(".headteacher-skill/workspace_manifest.json")
OPENCLAW_PLUGIN_PATH = Path.home() / ".openclaw" / "extensions" / "openclaw-lark"


def check_python_module(module_name: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except Exception:
        return False


def detect_agent_runtime() -> Dict[str, Any]:
    env = os.environ
    evidence: list[str] = []

    if env.get("OPENCLAW") or env.get("OPENCLAW_WORKSPACE") or env.get("OPENCLAW_AGENT_ID"):
        evidence.append("openclaw_env")
    if env.get("CODEX_THREAD_ID") or env.get("CODEX_INTERNAL_ORIGINATOR_OVERRIDE"):
        evidence.append("codex_env")
    if env.get("CLAUDECODE") or env.get("CLAUDE_CODE_ENTRYPOINT") or env.get("CLAUDE_PROJECT_DIR"):
        evidence.append("claude_code_env")

    cwd_parts = {part.lower() for part in Path.cwd().parts}
    if ".openclaw" in cwd_parts or "openclaw" in cwd_parts:
        evidence.append("openclaw_cwd")
    if ".claude" in cwd_parts or "claude" in cwd_parts:
        evidence.append("claude_cwd")

    if "openclaw_env" in evidence or "openclaw_cwd" in evidence:
        runtime = "openclaw"
    elif "codex_env" in evidence:
        runtime = "codex"
    elif "claude_code_env" in evidence or "claude_cwd" in evidence:
        runtime = "claude_code"
    else:
        runtime = "local_agent"

    return {
        "runtime": runtime,
        "evidence": evidence or ["no_known_agent_markers"],
    }


def check_openclaw_feishu_plugin() -> Dict[str, Any]:
    installed = OPENCLAW_PLUGIN_PATH.exists()
    return {
        "plugin_id": "openclaw-lark",
        "installed": installed,
        "install_path": str(OPENCLAW_PLUGIN_PATH),
        "status": "ready" if installed else "missing_plugin",
        "recommendation": (
            "Use the official OpenClaw Lark/Feishu plugin and Feishu Base API tools."
            if installed
            else "Install the official OpenClaw Lark/Feishu plugin (`openclaw-lark`) first."
        ),
    }


def resolve_feishu_access(runtime: Dict[str, Any], feishu_backend: Dict[str, Any]) -> Dict[str, Any]:
    if runtime["runtime"] == "openclaw":
        plugin = check_openclaw_feishu_plugin()
        return {
            "mode": "openclaw_plugin",
            "status": plugin["status"],
            "plugin": plugin,
            "recommendation": plugin["recommendation"],
        }

    status = "ready" if feishu_backend["installed"] and feishu_backend["configured"] else feishu_backend["status"]
    return {
        "mode": "lark_cli",
        "status": status,
        "binary": feishu_backend.get("binary"),
        "recommendation": (
            "Use `lark-cli` for Feishu bootstrap in Codex / Claude Code / local agent environments."
        ),
    }


def check_feishu_backend() -> Dict[str, Any]:
    path = shutil.which("lark-cli")
    if not path:
        return {
            "backend": "feishu_base",
            "installed": False,
            "configured": False,
            "status": "missing_cli",
            "recommendation": "Install lark-cli first.",
        }

    config = run_command(["lark-cli", "config", "show"])
    parsed = parse_embedded_json(config["stdout"])
    configured = bool(parsed and parsed.get("appId"))
    users = parsed.get("users") if parsed else None
    status = "ready" if configured else "needs_config"

    return {
        "backend": "feishu_base",
        "installed": True,
        "configured": configured,
        "status": status,
        "binary": path,
        "config_path": str(Path.home() / ".lark-cli" / "config.json"),
        "brand": parsed.get("brand") if parsed else None,
        "users": users,
        "recommendation": "Run `lark-cli config init --new`." if not configured else "Feishu backend is available.",
    }


def check_obsidian_backend() -> Dict[str, Any]:
    path = shutil.which("obsidian")
    return {
        "backend": "obsidian",
        "installed": bool(path),
        "status": "placeholder_ready" if path else "missing_cli",
        "binary": path,
        "recommendation": "Install the Obsidian CLI and the official Obsidian-related skill, then verify local access."
        if not path
        else "Obsidian CLI is installed; also verify the official Obsidian-related skill in the agent environment.",
    }


def check_notion_backend() -> Dict[str, Any]:
    return {
        "backend": "notion",
        "installed": None,
        "status": "manual_verification_required",
        "recommendation": "Verify that Notion MCP is connected and available in the current agent environment.",
    }


def check_artifact_stack() -> Dict[str, Any]:
    return {
        "python_docx": check_python_module("docx"),
        "openpyxl": check_python_module("openpyxl"),
        "python_pptx": check_python_module("pptx"),
    }


def build_report(focus_backend: Optional[str]) -> Dict[str, Any]:
    runtime = detect_agent_runtime()
    feishu_backend = check_feishu_backend()
    backends = {
        "feishu_base": feishu_backend,
        "notion": check_notion_backend(),
        "obsidian": check_obsidian_backend(),
        "local_only": {
            "backend": "local_only",
            "status": "always_available",
            "recommendation": "Use the local schema plan and defer backend setup.",
        },
    }
    if focus_backend:
        selected = {focus_backend: backends[focus_backend]}
    else:
        selected = backends

    recommended_backend = "feishu_base" if runtime["runtime"] == "openclaw" or feishu_backend["installed"] else "local_only"
    return {
        "workspace_manifest_exists": WORKSPACE_MANIFEST.exists(),
        "workspace_manifest_path": str(WORKSPACE_MANIFEST),
        "agent_runtime": runtime,
        "feishu_access": resolve_feishu_access(runtime, feishu_backend),
        "recommended_backend": recommended_backend,
        "artifact_stack": check_artifact_stack(),
        "backends": selected,
    }


def render_markdown(report: Dict[str, Any]) -> str:
    lines = ["# Setup Doctor", ""]
    lines.append(f"- Workspace manifest present: `{report['workspace_manifest_exists']}`")
    lines.append(f"- Workspace manifest path: `{report['workspace_manifest_path']}`")
    lines.append(f"- Agent runtime: `{report['agent_runtime']['runtime']}`")
    lines.append(f"- Runtime evidence: `{', '.join(report['agent_runtime']['evidence'])}`")
    lines.append(f"- Recommended Feishu access: `{report['feishu_access']['mode']}`")
    lines.append(f"- Recommended backend: `{report['recommended_backend']}`")
    lines.append("")
    lines.append("## Feishu access")
    lines.append("")
    lines.append(f"- mode: `{report['feishu_access']['mode']}`")
    lines.append(f"- status: `{report['feishu_access']['status']}`")
    if report["feishu_access"]["mode"] == "openclaw_plugin":
        plugin = report["feishu_access"]["plugin"]
        lines.append(f"- plugin_id: `{plugin['plugin_id']}`")
        lines.append(f"- plugin_installed: `{plugin['installed']}`")
        lines.append(f"- plugin_path: `{plugin['install_path']}`")
    elif report["feishu_access"].get("binary"):
        lines.append(f"- binary: `{report['feishu_access']['binary']}`")
    lines.append(f"- recommendation: {report['feishu_access']['recommendation']}")
    lines.append("")
    lines.append("## Artifact stack")
    lines.append("")
    for name, available in report["artifact_stack"].items():
        lines.append(f"- {name}: `{available}`")
    lines.append("")
    lines.append("## Backends")
    lines.append("")
    for backend_name, data in report["backends"].items():
        lines.append(f"### {backend_name}")
        for key in ["status", "installed", "configured", "binary", "users", "recommendation"]:
            if key in data and data[key] is not None:
                if key == "recommendation":
                    lines.append(f"- {key}: {data[key]}")
                else:
                    lines.append(f"- {key}: `{data[key]}`")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check local prerequisites for the headteacher workbench.")
    parser.add_argument(
        "--backend",
        choices=["feishu_base", "notion", "obsidian", "local_only"],
        help="Focus on a single backend.",
    )
    parser.add_argument("--format", default="json", choices=["json", "markdown"], help="Output format.")
    args = parser.parse_args()

    report = build_report(args.backend)
    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
