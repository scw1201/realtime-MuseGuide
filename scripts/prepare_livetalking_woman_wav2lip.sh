#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PY_BIN="${PY_BIN:-python}"
PERSONA_ID="${PERSONA_ID:-woman_demo}"
VIDEO_ROOT="${VIDEO_ROOT:-frontend/public/videos/${PERSONA_ID}}"
LIVETALKING_ROOT="${LIVETALKING_ROOT:-livetalking}"
FACE_DET_BATCH_SIZE="${FACE_DET_BATCH_SIZE:-8}"

states=(
  IDLE
  LISTENING
  GREETING_SELF
  EXPLAIN_DETAILED
  POINTING_DIRECTION
  FOCUS_EXHIBIT
)

echo "Preparing LiveTalking Wav2Lip assets for ${PERSONA_ID}"
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
  video_path="${VIDEO_ROOT}/${PERSONA_ID}_${state}.mp4"
  avatar_id="${PERSONA_ID}_${state}"
  avatar_dir="${LIVETALKING_ROOT}/data/avatars/${avatar_id}"

  if [ ! -f "${video_path}" ]; then
    echo "Skip ${state}: ${video_path} not found"
    continue
  fi

  if [ -f "${avatar_dir}/coords.pkl" ]; then
    echo "Skip ${avatar_id}: already prepared"
    continue
  fi

  echo "Generating ${avatar_id} from ${video_path}"
  (
    cd "${LIVETALKING_ROOT}"
    "${PY_BIN}" -m avatars.wav2lip.genavatar \
      --video_path "../${video_path}" \
      --avatar_id "${avatar_id}" \
      --img_size 96 \
      --face_det_batch_size "${FACE_DET_BATCH_SIZE}"
  )
done

echo "LiveTalking Wav2Lip woman assets are ready."
