#!/bin/bash
set -e

cd "$(dirname "$0")"

ENABLE_RELOAD=1 OPEN_PATH=/\#admin ./dev.sh
