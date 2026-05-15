#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


STATE_DIR = Path(".headteacher-skill")


def ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def run_command(cmd: List[str]) -> Dict[str, Any]:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def run_json_command(cmd: List[str]) -> Dict[str, Any]:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{message}")
    return json.loads(result.stdout)


def parse_embedded_json(text: str) -> Optional[Dict[str, Any]]:
    import re
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def find_first_key(data: Any, target_key: str) -> Optional[Any]:
    if isinstance(data, dict):
        if target_key in data:
            return data[target_key]
        for value in data.values():
            found = find_first_key(value, target_key)
            if found is not None:
                return found
    if isinstance(data, list):
        for item in data:
            found = find_first_key(item, target_key)
            if found is not None:
                return found
    return None
