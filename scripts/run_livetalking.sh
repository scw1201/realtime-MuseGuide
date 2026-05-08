#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PY_BIN="${PY_BIN:-python}"
LIVETALKING_PORT="${LIVETALKING_PORT:-8010}"
LIVETALKING_MODEL="${LIVETALKING_MODEL:-wav2lip}"
LIVETALKING_AVATAR_ID="${LIVETALKING_AVATAR_ID:-woman_demo_IDLE}"
LIVETALKING_TTS="${LIVETALKING_TTS:-doubao}"
LIVETALKING_REF_FILE="${LIVETALKING_REF_FILE:-zh_female_cancan_mars_bigtts}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

eval "$("${PY_BIN}" - <<'PY'
from pathlib import Path
import shlex
import yaml

path = Path("museguide/configs/secrets.yaml")
if not path.exists():
    raise SystemExit(0)
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
tts = data.get("tts", {}) or {}
appid = str(tts.get("appid", "")).strip()
token = str(tts.get("access_token", "")).strip()
if appid:
    print(f"export DOUBAO_APPID={shlex.quote(appid)}")
if token:
    print(f"export DOUBAO_TOKEN={shlex.quote(token)}")
PY
)"

if [ -z "${DOUBAO_APPID:-}" ] || [ -z "${DOUBAO_TOKEN:-}" ]; then
  echo "DOUBAO_APPID/DOUBAO_TOKEN are not configured." >&2
  exit 1
fi

cd livetalking

exec "${PY_BIN}" app.py \
  --transport webrtc \
  --model "${LIVETALKING_MODEL}" \
  --avatar_id "${LIVETALKING_AVATAR_ID}" \
  --tts "${LIVETALKING_TTS}" \
  --REF_FILE "${LIVETALKING_REF_FILE}" \
  --listenport "${LIVETALKING_PORT}"
