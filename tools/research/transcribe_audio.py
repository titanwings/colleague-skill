#!/usr/bin/env python3
"""Transcribe audio/video content for celebrity research.

For videos without usable subtitles (most podcasts, some interviews),
this tool downloads the audio stream and runs it through a Whisper model.

Critical usage rules:
- The raw transcript output is for Claude to READ ONCE and extract paraphrased
  findings. It MUST NOT be committed into the skill directory as a long file.
- The tool writes to a temp-friendly location by default and warns about cleanup.
- For copyright safety, only short paraphrased notes with source metadata should
  end up under knowledge/research/raw/.

Transcription backend priority:
1. faster-whisper (local, preferred — Apple Silicon friendly)
2. openai-whisper (local fallback)
3. OpenAI Whisper API (if OPENAI_API_KEY is set)

Usage:
  # Transcribe a video/podcast URL (auto-downloads audio via yt-dlp)
  python3 tools/research/transcribe_audio.py --url "https://..." --output /tmp/out.txt

  # Transcribe a local audio/video file
  python3 tools/research/transcribe_audio.py --input /path/to/file.mp3 --output /tmp/out.txt

  # Choose backend and model
  python3 tools/research/transcribe_audio.py --url "..." --backend faster-whisper --model small
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


SUPPORTED_AUDIO_EXT = {".mp3", ".m4a", ".wav", ".flac", ".ogg", ".opus", ".aac"}
SUPPORTED_VIDEO_EXT = {".mp4", ".mkv", ".webm", ".mov", ".avi"}


def _has_cmd(name: str) -> bool:
    return shutil.which(name) is not None


def download_audio(url: str, workdir: Path) -> Path:
    """Download best audio from a video URL using yt-dlp."""
    if not _has_cmd("yt-dlp"):
        raise SystemExit(
            "error: yt-dlp is required to download audio from URLs.\n"
            "install: brew install yt-dlp  (macOS)  or  pip install yt-dlp"
        )

    workdir.mkdir(parents=True, exist_ok=True)
    output_template = str(workdir / "%(id)s.%(ext)s")

    cmd = [
        "yt-dlp",
        "-f", "bestaudio/best",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "-o", output_template,
        url,
    ]

    print(f"[transcribe] downloading audio: {url}", file=sys.stderr)
    subprocess.run(cmd, check=True)

    audio_files = sorted(workdir.glob("*.mp3"))
    if not audio_files:
        raise SystemExit(f"error: yt-dlp produced no audio file under {workdir}")
    return audio_files[-1]


def transcribe_with_faster_whisper(audio_path: Path, model_name: str, language: Optional[str]) -> str:
    """Transcribe using faster-whisper (preferred backend)."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return ""

    print(f"[transcribe] loading faster-whisper model: {model_name}", file=sys.stderr)
    compute_type = "int8"
    model = WhisperModel(model_name, device="auto", compute_type=compute_type)

    print(f"[transcribe] transcribing: {audio_path.name}", file=sys.stderr)
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        vad_filter=True,
    )

    detected_lang = info.language
    duration = info.duration
    print(
        f"[transcribe] detected language: {detected_lang}, duration: {duration:.1f}s",
        file=sys.stderr,
    )

    lines: list[str] = []
    for seg in segments:
        ts = f"[{_fmt_ts(seg.start)}]"
        text = seg.text.strip()
        if text:
            lines.append(f"{ts} {text}")

    return "\n".join(lines)


def transcribe_with_openai_whisper(audio_path: Path, model_name: str, language: Optional[str]) -> str:
    """Transcribe using the openai-whisper package (local fallback)."""
    try:
        import whisper
    except ImportError:
        return ""

    print(f"[transcribe] loading openai-whisper model: {model_name}", file=sys.stderr)
    model = whisper.load_model(model_name)

    print(f"[transcribe] transcribing: {audio_path.name}", file=sys.stderr)
    result = model.transcribe(
        str(audio_path),
        language=language,
        verbose=False,
    )

    lines: list[str] = []
    for seg in result.get("segments", []):
        ts = f"[{_fmt_ts(seg['start'])}]"
        text = seg["text"].strip()
        if text:
            lines.append(f"{ts} {text}")

    return "\n".join(lines)


def transcribe_with_openai_api(audio_path: Path, language: Optional[str]) -> str:
    """Transcribe using OpenAI's Whisper API (remote fallback)."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return ""

    try:
        from openai import OpenAI
    except ImportError:
        return ""

    size_mb = audio_path.stat().st_size / (1024 * 1024)
    if size_mb > 25:
        print(
            f"[transcribe] warning: file is {size_mb:.1f}MB, OpenAI API limit is 25MB. "
            f"consider splitting or using a local backend.",
            file=sys.stderr,
        )

    print(f"[transcribe] using OpenAI Whisper API", file=sys.stderr)
    client = OpenAI(api_key=api_key)

    with open(audio_path, "rb") as f:
        kwargs = {"model": "whisper-1", "file": f, "response_format": "verbose_json"}
        if language:
            kwargs["language"] = language
        result = client.audio.transcriptions.create(**kwargs)

    lines: list[str] = []
    for seg in getattr(result, "segments", []) or []:
        start = seg.get("start") if isinstance(seg, dict) else seg.start
        text = (seg.get("text") if isinstance(seg, dict) else seg.text).strip()
        if text:
            lines.append(f"[{_fmt_ts(start)}] {text}")

    if not lines:
        text = getattr(result, "text", "").strip()
        if text:
            lines.append(text)

    return "\n".join(lines)


def _fmt_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def transcribe(
    audio_path: Path,
    backend: str = "auto",
    model_name: str = "small",
    language: Optional[str] = None,
) -> str:
    """Run transcription with the requested backend (or auto-detect)."""
    attempts: list[tuple[str, callable]] = []

    if backend in {"auto", "faster-whisper"}:
        attempts.append(("faster-whisper", lambda: transcribe_with_faster_whisper(audio_path, model_name, language)))
    if backend in {"auto", "openai-whisper"}:
        attempts.append(("openai-whisper", lambda: transcribe_with_openai_whisper(audio_path, model_name, language)))
    if backend in {"auto", "openai-api"}:
        attempts.append(("openai-api", lambda: transcribe_with_openai_api(audio_path, language)))

    for name, fn in attempts:
        try:
            text = fn()
        except Exception as exc:
            print(f"[transcribe] backend {name} failed: {exc}", file=sys.stderr)
            continue
        if text:
            print(f"[transcribe] backend used: {name}", file=sys.stderr)
            return text

    raise SystemExit(
        "error: no working transcription backend found.\n"
        "install one of the following:\n"
        "  pip install faster-whisper   (recommended, local, Apple Silicon friendly)\n"
        "  pip install openai-whisper   (local alternative)\n"
        "  pip install openai  + export OPENAI_API_KEY=sk-...   (remote fallback)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe audio/video for celebrity research (output is paraphrase-seed material, do not commit long transcripts).",
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--url", help="Video/podcast URL (auto-downloads audio via yt-dlp)")
    src.add_argument("--input", help="Local audio or video file path")

    parser.add_argument("--output", help="Output transcript path. Default: adjacent to input or /tmp")
    parser.add_argument(
        "--backend",
        default="auto",
        choices=["auto", "faster-whisper", "openai-whisper", "openai-api"],
        help="Transcription backend (default: auto)",
    )
    parser.add_argument(
        "--model",
        default="small",
        help="Model size for local backends (tiny/base/small/medium/large-v3). Default: small",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="ISO language code (en, zh, ja, ...). Default: auto-detect",
    )
    parser.add_argument(
        "--keep-audio",
        action="store_true",
        help="Keep the downloaded audio file (default: cleanup after transcription)",
    )
    args = parser.parse_args()

    cleanup_audio = False
    audio_path: Path

    with tempfile.TemporaryDirectory(prefix="transcribe_") as tmpdir_str:
        tmpdir = Path(tmpdir_str)

        if args.url:
            audio_path = download_audio(args.url, tmpdir)
            cleanup_audio = not args.keep_audio
        else:
            input_path = Path(args.input).expanduser()
            if not input_path.exists():
                raise SystemExit(f"error: input file not found: {input_path}")
            audio_path = input_path

        transcript = transcribe(
            audio_path=audio_path,
            backend=args.backend,
            model_name=args.model,
            language=args.language,
        )

        if args.output:
            output_path = Path(args.output).expanduser()
        else:
            output_path = Path(tempfile.gettempdir()) / f"{audio_path.stem}_transcript.txt"

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(transcript + "\n", encoding="utf-8")

        print(f"\n[transcribe] wrote: {output_path}", file=sys.stderr)
        print(
            "[transcribe] REMINDER: this transcript is for paraphrase extraction only. "
            "Do not commit it into the skill directory as a long file.",
            file=sys.stderr,
        )
        print(output_path)

        if args.keep_audio and args.url:
            persistent = output_path.parent / audio_path.name
            shutil.copy2(audio_path, persistent)
            print(f"[transcribe] kept audio: {persistent}", file=sys.stderr)


if __name__ == "__main__":
    main()
