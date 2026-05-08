#!/bin/bash
set -e

# ============================
# 进入项目根目录
# ============================
cd "$(dirname "$0")"
PY_BIN="${PY_BIN:-python3}"
ENABLE_RELOAD="${ENABLE_RELOAD:-0}"
OPEN_PATH="${OPEN_PATH:-/}"

echo "📁 Working dir: $(pwd)"
echo "🐍 Python bin: ${PY_BIN}"

if [ -f ".env" ]; then
  echo "🌱 Loading .env"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# ============================
# 启动前清理占用端口
# ============================
kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "🧹 Killing processes on port $port: $pids"
    kill -9 $pids || true
  fi
}

kill_port 9001
kill_port 8765
kill_port 8000
if [ "${ENABLE_LIVETALKING:-0}" = "1" ]; then
  kill_port "${LIVETALKING_PORT:-8010}"
fi

# ============================
# 退出时清理本次启动的进程
# ============================
cleanup() {
  echo "🧹 Cleaning up..."
  if [ -n "${ASR_PID:-}" ]; then kill "$ASR_PID" 2>/dev/null || true; fi
  if [ -n "${TTS_PID:-}" ]; then kill "$TTS_PID" 2>/dev/null || true; fi
  if [ -n "${API_PID:-}" ]; then kill "$API_PID" 2>/dev/null || true; fi
  if [ -n "${LIVETALKING_PID:-}" ]; then kill "$LIVETALKING_PID" 2>/dev/null || true; fi
  if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

# ============================
# secrets.yaml 优先（如需临时覆盖再手动 export）
# ============================
echo "🔐 Using museguide/configs/secrets.yaml for credentials"

# ============================
# 启动 ASR WebSocket Server
# ============================
echo "🎙 Starting ASR WebSocket server (9001)..."
"${PY_BIN}" -m museguide.asr.ws_server &

ASR_PID=$!
echo "   ↳ ASR PID: $ASR_PID"

# ============================
# 启动 TTS Worker (v3)
# ============================
echo "🔊 Starting TTS worker (v3)..."
"${PY_BIN}" -m museguide.tts.worker_v3 &

TTS_PID=$!
echo "   ↳ TTS PID: $TTS_PID"

# ============================
# 启动 API Server
# ============================
echo "🌐 Starting API server (8000)..."
if [ "${ENABLE_RELOAD}" = "1" ]; then
  "${PY_BIN}" -m uvicorn museguide.api.server:app --reload --port 8000 &
else
  "${PY_BIN}" -m uvicorn museguide.api.server:app --port 8000 &
fi

API_PID=$!
echo "   ↳ API PID: $API_PID"

# ============================
# 可选启动 LiveTalking 实时口型服务
# ============================
if [ "${ENABLE_LIVETALKING:-0}" = "1" ]; then
  echo "🗣 Starting LiveTalking lip-sync server (${LIVETALKING_PORT:-8010})..."
  PY_BIN="${LIVETALKING_PY_BIN:-${PY_BIN}}" \
    LIVETALKING_PORT="${LIVETALKING_PORT:-8010}" \
    bash scripts/run_livetalking.sh &
  LIVETALKING_PID=$!
  echo "   ↳ LiveTalking PID: $LIVETALKING_PID"
fi

# ============================
# 启动前端 Vite Dev Server
# ============================
echo "🖥  Starting frontend (Vite)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "   ↳ Frontend PID: $FRONTEND_PID"
cd ..

# ============================
# 等待服务就绪后打开浏览器
# ============================
echo "✅ All services started."
echo "🛑 Press Ctrl+C to stop all."

sleep 2 && open "http://localhost:5173${OPEN_PATH}" &

wait
