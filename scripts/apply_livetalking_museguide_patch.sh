#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PATCH_FILE="${PATCH_FILE:-patches/livetalking_museguide.patch}"
LIVETALKING_ROOT="${LIVETALKING_ROOT:-livetalking}"

if [ ! -f "${PATCH_FILE}" ]; then
  echo "Patch file not found: ${PATCH_FILE}" >&2
  exit 1
fi

git -C "${LIVETALKING_ROOT}" apply --check "../${PATCH_FILE}"
git -C "${LIVETALKING_ROOT}" apply "../${PATCH_FILE}"
echo "Applied ${PATCH_FILE} to ${LIVETALKING_ROOT}."
