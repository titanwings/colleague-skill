"""
image_generator.py — Async NanoBanana image generation

Spawns a background subprocess so the model doesn't wait.
The subprocess calls NanoBanana, downloads the image, then sends it
directly via Telegram Bot API (bypassing openclaw's known image-send bug).

Usage:
    python tools/image_generator.py generate \
        --prompt "..." \
        --slug "example_tianyi" \
        --chat-id "123456789"

    python tools/image_generator.py check --job-id "abc123"
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────

NANOBANANA_API_KEY = os.environ.get("NANOBANANA_API_KEY", "")
NANOBANANA_API_URL = os.environ.get("NANOBANANA_API_URL", "http://35.220.164.252:3888/v1/images/generations")
NANOBANANA_MODEL = os.environ.get("NANOBANANA_MODEL", "doubao-seedream-5-0-260128")
NANOBANANA_SIZE = "1920x1920"  # minimum 3686400 pixels required

JOBS_DIR = Path(tempfile.gettempdir()) / "colleague_skill_jobs"
JOBS_DIR.mkdir(exist_ok=True)

# Read Telegram bot token from openclaw config
def _telegram_token() -> str:
    config_path = Path.home() / ".openclaw" / "openclaw.json"
    try:
        cfg = json.loads(config_path.read_text())
        return cfg["channels"]["telegram"]["botToken"]
    except Exception:
        return os.environ.get("TELEGRAM_BOT_TOKEN", "")


# ─── Background worker (runs as subprocess) ──────────────────────────────────

def _worker(job_id: str, prompt: str, chat_id: str):
    """Called in a detached subprocess. Generates image and sends via Telegram."""
    import requests

    job_file = JOBS_DIR / f"{job_id}.json"

    def update(status: str, **extra):
        job_file.write_text(json.dumps({"job_id": job_id, "status": status, **extra}))

    update("running")

    try:
        # 1. Call NanoBanana
        if not NANOBANANA_API_KEY:
            raise ValueError("NANOBANANA_API_KEY is not set")

        resp = requests.post(
            NANOBANANA_API_URL,
            headers={"Authorization": f"Bearer {NANOBANANA_API_KEY}"},
            json={"model": NANOBANANA_MODEL, "prompt": prompt, "n": 1, "size": NANOBANANA_SIZE},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        # Doubao returns data[0].url
        image_url = (data.get("data") or [{}])[0].get("url")
        if not image_url:
            raise ValueError(f"No image URL in response: {data}")

        # 2. Send via Telegram Bot API directly (avoids openclaw bug)
        token = _telegram_token()
        tg_resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendPhoto",
            json={"chat_id": chat_id, "photo": image_url},
            timeout=30,
        )
        tg_resp.raise_for_status()

        update("done", image_url=image_url)

    except Exception as e:
        update("error", error=str(e))


# ─── Commands ────────────────────────────────────────────────────────────────

def cmd_generate(prompt: str, slug: str, chat_id: str) -> dict:
    """Spawn background worker and return job_id immediately."""
    job_id = str(uuid.uuid4())[:8]

    # Write initial state
    (JOBS_DIR / f"{job_id}.json").write_text(
        json.dumps({"job_id": job_id, "status": "pending"})
    )

    # Detach subprocess — model can continue without waiting
    subprocess.Popen(
        [
            sys.executable, __file__, "_worker",
            "--job-id", job_id,
            "--prompt", prompt,
            "--chat-id", chat_id,
        ],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"图片生成中，job_id={job_id}，稍后发送到 Telegram",
    }


def cmd_check(job_id: str) -> dict:
    """Check status of a background job."""
    job_file = JOBS_DIR / f"{job_id}.json"
    if not job_file.exists():
        return {"job_id": job_id, "status": "not_found"}
    return json.loads(job_file.read_text())


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    p_gen = sub.add_parser("generate")
    p_gen.add_argument("--prompt", required=True)
    p_gen.add_argument("--slug", required=True)
    p_gen.add_argument("--chat-id", required=True)

    p_check = sub.add_parser("check")
    p_check.add_argument("--job-id", required=True)

    # Internal: called by the detached subprocess
    p_worker = sub.add_parser("_worker")
    p_worker.add_argument("--job-id", required=True)
    p_worker.add_argument("--prompt", required=True)
    p_worker.add_argument("--chat-id", required=True)

    args = parser.parse_args()

    if args.cmd == "generate":
        result = cmd_generate(args.prompt, args.slug, args.chat_id)
    elif args.cmd == "check":
        result = cmd_check(args.job_id)
    elif args.cmd == "_worker":
        _worker(args.job_id, args.prompt, args.chat_id)
        return
    else:
        parser.print_help()
        return

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
