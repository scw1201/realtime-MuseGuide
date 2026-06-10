#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST, for example REMOTE_HOST=user@host}"
REMOTE_DIR="${REMOTE_DIR:?Set REMOTE_DIR to an absolute path on the remote server, for example /home/user/museguide}"
REMOTE_USER_DIR="${REMOTE_USER_DIR:-.config/systemd/user}"
REMOTE_CONDA_DIR="${REMOTE_CONDA_DIR:-${REMOTE_DIR}/.conda}"
REMOTE_ENV_PREFIX="${REMOTE_ENV_PREFIX:-${REMOTE_CONDA_DIR}/envs/museguide}"

API_PORT="${API_PORT:-8000}"
ASR_PORT="${ASR_PORT:-9001}"
TTS_PORT="${TTS_PORT:-8765}"

SERVICES=(
  "museguide-asr.service"
  "museguide-tts.service"
  "museguide-api.service"
)

render_template() {
  local src="$1"
  local dst="$2"
  sed \
    -e "s#{{REMOTE_DIR}}#${REMOTE_DIR}#g" \
    -e "s#{{API_PORT}}#${API_PORT}#g" \
    -e "s#{{ASR_PORT}}#${ASR_PORT}#g" \
    -e "s#{{TTS_PORT}}#${TTS_PORT}#g" \
    "$src" > "$dst"
}

echo "[1/7] Building frontend dist locally"
cd "$ROOT_DIR/frontend"
npm run build

echo "[2/7] Syncing project to ${REMOTE_HOST}:${REMOTE_DIR}"
cd "$ROOT_DIR"
rsync -az \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude "__pycache__" \
  --exclude "*.pyc" \
  --exclude ".pytest_cache" \
  --exclude ".mypy_cache" \
  --exclude ".venv" \
  --exclude ".venv*" \
  --exclude ".conda" \
  --exclude ".conda*" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/.vite" \
  --exclude "volcengine_binary_demo/.venv" \
  ./ "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "[3/7] Preparing remote directories"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR' '$REMOTE_USER_DIR'"

echo "[4/7] Installing Conda and updating remote environment"
ssh "$REMOTE_HOST" "
  set -e
  if [ ! -x '$REMOTE_CONDA_DIR/bin/conda' ]; then
    curl -fsSL -o /tmp/museguide-miniconda.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    bash /tmp/museguide-miniconda.sh -b -p '$REMOTE_CONDA_DIR'
  fi
  '$REMOTE_CONDA_DIR/bin/conda' env update -p '$REMOTE_ENV_PREFIX' -f '$REMOTE_DIR/environment.server.yml' --prune
"

echo "[5/7] Rendering systemd services"
TMP_SERVICE_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_SERVICE_DIR"' EXIT
for service in "${SERVICES[@]}"; do
  render_template "$ROOT_DIR/deploy/systemd/${service}.template" "$TMP_SERVICE_DIR/$service"
done

echo "[6/7] Installing user systemd services"
for service in "${SERVICES[@]}"; do
  rsync -az "$TMP_SERVICE_DIR/$service" "${REMOTE_HOST}:${REMOTE_USER_DIR}/$service"
done

echo "[7/7] Reloading and starting services"
ssh "$REMOTE_HOST" "systemctl --user daemon-reload && systemctl --user enable --now ${SERVICES[*]} && systemctl --user restart ${SERVICES[*]} && systemctl --user --no-pager --full status museguide-api.service | sed -n '1,50p'"

echo
echo "Deployment finished."
echo "Remote directory: ${REMOTE_DIR}"
echo "API URL: http://$(ssh "$REMOTE_HOST" 'hostname -I | awk \"{print \\$1}\"'):${API_PORT}"
