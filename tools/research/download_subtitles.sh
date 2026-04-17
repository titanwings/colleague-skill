#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: download_subtitles.sh <video-url> [output-dir]" >&2
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "error: yt-dlp is required" >&2
  exit 1
fi

url="$1"
output_dir="${2:-.}"
mkdir -p "$output_dir"

download_with_mode() {
  local mode="$1"
  local langs="$2"
  if [[ "$mode" == "manual" ]]; then
    yt-dlp --write-subs --sub-langs "$langs" --sub-format "srt/vtt/best" --skip-download -o "$output_dir/%(title)s.%(ext)s" "$url"
  else
    yt-dlp --write-auto-subs --sub-langs "$langs" --sub-format "srt/vtt/best" --skip-download -o "$output_dir/%(title)s.%(ext)s" "$url"
  fi
}

download_with_mode manual "zh-Hans,zh-Hant,zh,zh-CN,zh-TW,en,en-US,en-GB" || true
download_with_mode auto "zh-Hans,zh,en" || true

find "$output_dir" -type f \( -name "*.srt" -o -name "*.vtt" \) -print | head -n 1
