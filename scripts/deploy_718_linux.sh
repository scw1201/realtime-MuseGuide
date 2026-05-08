#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_HOST="718-linux"
REMOTE_DIR="/media/lenovo/aigo/data/my_museguide"
REMOTE_USER_DIR="/home/lenovo/.config/systemd/user"
REMOTE_CONDA_DIR="${REMOTE_DIR}/.conda"
REMOTE_ENV_PREFIX="${REMOTE_CONDA_DIR}/envs/museguide"
SERVICES=(
  "museguide-asr.service"
  "museguide-tts.service"
  "museguide-api.service"
)

echo "[1/6] Building frontend dist locally"
cd "$ROOT_DIR/frontend"
npm run build

echo "[2/6] Syncing project to ${REMOTE_HOST}:${REMOTE_DIR}"
cd "$ROOT_DIR"
rsync -az \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude "__pycache__" \
  --exclude "*.pyc" \
  --exclude ".pytest_cache" \
  --exclude ".mypy_cache" \
  --exclude ".venv" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/.vite" \
  --exclude "volcengine_binary_demo/.venv" \
  ./ "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "[3/6] Preparing remote directories"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR' '$REMOTE_USER_DIR'"

echo "[4/6] Installing Conda and updating remote environment"
ssh "$REMOTE_HOST" "
  set -e
  if [ ! -x '$REMOTE_CONDA_DIR/bin/conda' ]; then
    curl -fsSL -o /tmp/museguide-miniconda.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    bash /tmp/museguide-miniconda.sh -b -p '$REMOTE_CONDA_DIR'
  fi
  '$REMOTE_CONDA_DIR/bin/conda' env update -p '$REMOTE_ENV_PREFIX' -f '$REMOTE_DIR/environment.server.yml' --prune
"

echo "[5/6] Installing user systemd services"
for service in "${SERVICES[@]}"; do
  rsync -az "$ROOT_DIR/deploy/718-linux/$service" "${REMOTE_HOST}:${REMOTE_USER_DIR}/$service"
done

echo "[6/6] Reloading and starting services"
ssh "$REMOTE_HOST" "systemctl --user daemon-reload && systemctl --user enable --now ${SERVICES[*]} && systemctl --user restart ${SERVICES[*]} && systemctl --user --no-pager --full status museguide-api.service | sed -n '1,40p'"

echo
echo "Deployment finished."
echo "App URL: http://$(ssh "$REMOTE_HOST" 'hostname -I | awk \"{print \\$1}\"'):8000"
