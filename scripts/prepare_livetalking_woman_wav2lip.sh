#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PY_BIN="${PY_BIN:-python}"
PERSONA_ID="${PERSONA_ID:-woman_demo}"
VIDEO_ROOT="${VIDEO_ROOT:-livetalking/test_videos}"
LIVETALKING_ROOT="${LIVETALKING_ROOT:-livetalking}"
FACE_DET_BATCH_SIZE="${FACE_DET_BATCH_SIZE:-8}"
IMG_SIZE="${IMG_SIZE:-256}"
PAD_TOP="${PAD_TOP:-0}"
PAD_BOTTOM="${PAD_BOTTOM:-20}"
PAD_LEFT="${PAD_LEFT:-0}"
PAD_RIGHT="${PAD_RIGHT:-0}"
ALIGNED_WIDTH="${ALIGNED_WIDTH:-1176}"
ALIGNED_HEIGHT="${ALIGNED_HEIGHT:-1764}"
ALIGNED_FPS="${ALIGNED_FPS:-25}"
ALIGNED_ROOT="${ALIGNED_ROOT:-${LIVETALKING_ROOT}/data/museguide_aligned_videos/${PERSONA_ID}}"
FORCE_REBUILD="${FORCE_REBUILD:-0}"
STATES="${STATES:-IDLE GREETING_SELF FOCUS_EXHIBIT EXPLAIN_DETAILED POINTING_DIRECTION}"

read -r -a states <<< "${STATES}"

source_for_state() {
  case "$1" in
    IDLE)
      if [ -f "${VIDEO_ROOT}/woman_demo_IDLE.mp4" ]; then
        echo "${VIDEO_ROOT}/woman_demo_IDLE.mp4"
      else
        echo "${VIDEO_ROOT}/idle.mp4"
      fi
      ;;
    GREETING_SELF) echo "${VIDEO_ROOT}/woman_demo_GREETING_SELF.mp4" ;;
    FOCUS_EXHIBIT) echo "${VIDEO_ROOT}/woman_demo_FOCUS_EXHIBIT.mp4" ;;
    EXPLAIN_DETAILED) echo "${VIDEO_ROOT}/woman_demo_EXPLAIN_DETAILED.mp4" ;;
    POINTING_DIRECTION) echo "${VIDEO_ROOT}/woman_demo_POINTING_DIRECTION.mp4" ;;
    *) echo "" ;;
  esac
}

echo "Preparing LiveTalking Wav2Lip assets for ${PERSONA_ID}"
echo "Selected states: ${STATES}"
echo "If dependency download is slow, enable your shell proxy first with: proxy_on"

mkdir -p "${LIVETALKING_ROOT}/models"
if [ ! -f "${LIVETALKING_ROOT}/models/wav2lip.pth" ]; then
  if [ -f "wav2lip/wav2lip256.pth" ]; then
    ln -s "$(pwd)/wav2lip/wav2lip256.pth" "${LIVETALKING_ROOT}/models/wav2lip.pth"
  else
    echo "Missing wav2lip/wav2lip256.pth. Put Wav2Lip weights there first." >&2
    exit 1
  fi
fi

mkdir -p "${LIVETALKING_ROOT}/wav2lip/face_detection/detection/sfd"
if [ ! -f "${LIVETALKING_ROOT}/wav2lip/face_detection/detection/sfd/s3fd.pth" ]; then
  if [ -f "wav2lip/s3fd.pth" ]; then
    ln -s "$(pwd)/wav2lip/s3fd.pth" "${LIVETALKING_ROOT}/wav2lip/face_detection/detection/sfd/s3fd.pth"
  else
    echo "Missing wav2lip/s3fd.pth. Put face detector weights there first." >&2
    exit 1
  fi
fi

for state in "${states[@]}"; do
  source_video_path="$(source_for_state "${state}")"
  video_path="${ALIGNED_ROOT}/${PERSONA_ID}_${state}.mp4"
  avatar_id="${PERSONA_ID}_${state}"
  avatar_dir="${LIVETALKING_ROOT}/data/avatars/${avatar_id}"

  if [ ! -f "${source_video_path}" ]; then
    echo "Skip ${state}: ${source_video_path} not found"
    continue
  fi

  if [ "${FORCE_REBUILD}" = "1" ] && [ -d "${avatar_dir}" ]; then
    echo "Rebuilding ${avatar_id}: removing previous generated avatar"
    rm -rf "${avatar_dir}"
  fi

  if [ -f "${avatar_dir}/coords.pkl" ]; then
    echo "Skip ${avatar_id}: already prepared"
    continue
  fi

  mkdir -p "${ALIGNED_ROOT}"
  if [ "${FORCE_REBUILD}" = "1" ] && [ -f "${video_path}" ]; then
    echo "Rebuilding aligned video: ${video_path}"
    rm -f "${video_path}"
  fi

  if [ ! -f "${video_path}" ]; then
    echo "Aligning ${source_video_path} -> ${video_path}"
    "${PY_BIN}" - "${source_video_path}" "${video_path}" "${ALIGNED_WIDTH}" "${ALIGNED_HEIGHT}" "${ALIGNED_FPS}" <<'PY'
from pathlib import Path
import sys
import cv2

src, dst, width, height, fps = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
Path(dst).parent.mkdir(parents=True, exist_ok=True)
cap = cv2.VideoCapture(src)
if not cap.isOpened():
    raise SystemExit(f"Cannot open video: {src}")
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(dst, fourcc, fps, (width, height))
if not writer.isOpened():
    raise SystemExit(f"Cannot create video: {dst}")
while True:
    ok, frame = cap.read()
    if not ok:
        break
    src_h, src_w = frame.shape[:2]
    scale = max(width / src_w, height / src_h)
    resized = cv2.resize(frame, (round(src_w * scale), round(src_h * scale)), interpolation=cv2.INTER_AREA)
    y0 = max((resized.shape[0] - height) // 2, 0)
    x0 = max((resized.shape[1] - width) // 2, 0)
    writer.write(resized[y0:y0 + height, x0:x0 + width])
cap.release()
writer.release()
PY
  fi

  echo "Generating ${avatar_id} from ${video_path}"
  (
    cd "${LIVETALKING_ROOT}"
    "${PY_BIN}" -m avatars.wav2lip.genavatar \
      --video_path "../${video_path}" \
      --avatar_id "${avatar_id}" \
      --img_size "${IMG_SIZE}" \
      --pads "${PAD_TOP}" "${PAD_BOTTOM}" "${PAD_LEFT}" "${PAD_RIGHT}" \
      --face_det_batch_size "${FACE_DET_BATCH_SIZE}"
  )
done

echo "LiveTalking Wav2Lip MuseGuide test-video assets are ready."
