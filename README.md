# MuseGuide

面向博物馆学习场景的对话式具身数字人导览系统原型。

MuseGuide combines a Vite/TypeScript frontend, a FastAPI orchestration backend, streaming ASR/TTS services, and a LiveTalking-based avatar runtime. The project was built for a graduation demo at the China Millennium Monument scenario, with multi-persona guides, tour progress tracking, contextual recommendations, voice input, speech output, and live avatar playback.

<p align="center">
  <img src="frontend/public/imgs/sub_icon/all_guides.png" alt="MuseGuide guides" width="860"/>
</p>

## Highlights

- Multi-persona museum guides for adult, child, international, and traditional-culture audiences.
- Context-aware tour state: current zone, current exhibit, guide stage, visited items, and pending suggested actions.
- Structured LLM orchestration with JSON parsing, tour-state updates, and action chips.
- Voice interaction: browser microphone input through ASR WebSocket, plus TTS streaming output.
- Embodied guide presentation with state-mapped avatar videos and LiveTalking integration.
- Demo-ready frontend pages for guided tour, route overview, digital collections, analytics, and content administration.

## Repository Layout

```text
frontend/                 Vite + TypeScript web app
museguide/                FastAPI backend, ASR/TTS clients, LLM orchestration
scripts/                  Runtime and deployment helper scripts
deploy/718-linux/         systemd service templates for the 718 demo server
docs/                     Integration notes, thesis/demo materials, screenshots
examples/                 Small local test assets and SDK examples
patches/                  LiveTalking integration patch
```

Large runtime media is intentionally kept under `frontend/public/` because the demo UI depends on local static avatar and landing assets. Model checkpoints, conda environments, secrets, logs, generated data, and LiveTalking runtime folders are excluded by `.gitignore`.

## Quick Start

### Requirements

- Python 3.10+
- Node.js 18+
- ASR/TTS credentials in `museguide/configs/secrets.yaml`

### Install

```bash
pip install -r requirements.server.txt
cd frontend
npm install
```

### Configure

Create `museguide/configs/secrets.yaml` locally. Do not commit this file.

Expected credential groups include:

- `doubao`
- `tts`
- `asr`

See `.env.example` and the config files in `museguide/configs/` for runtime defaults.

### Run Locally

From the repository root:

```bash
./dev.sh
```

The development script starts:

- ASR WebSocket on `9001`
- TTS WebSocket on `8765`
- FastAPI server on `8000`
- Vite frontend on `5173`

Then open:

```text
http://localhost:5173/
```

## 718 Demo Server

The final demo server used:

```text
/media/lenovo/aigo/data/my_museguide
```

Deployment/service files live in:

```text
deploy/718-linux/
```

The helper scripts in `scripts/` start the backend services and LiveTalking avatar runtime. Local SSH tunnel setup for the demo machine was kept outside the repository in the operator's local notes.

## Backend Pipeline

1. User text, voice transcript, chip, or auto action enters `LLMOrchestrator`.
2. The backend loads session-level tour context.
3. `prompt_builder` assembles guide-stage and exhibit context.
4. The LLM returns structured JSON.
5. `response_parser` normalizes and repairs output.
6. `tour_state_manager` updates guide progress.
7. `initiative` generates suggested next actions.
8. The frontend maps guide stage and persona to speech, captions, chips, and avatar video state.

Core modules:

- `museguide/llm/orchestrator.py`
- `museguide/llm/prompt_builder.py`
- `museguide/llm/response_parser.py`
- `museguide/llm/tour_state_manager.py`
- `museguide/llm/initiative.py`
- `frontend/src/app/controller.ts`
- `frontend/src/net/ASRClient.ts`
- `frontend/src/avatar/LiveAvatarEngine.ts`

## Documentation

- LiveTalking integration: `docs/LIVETALKING_INTEGRATION.md`
- Demo materials: `docs/demo/`
- Thesis and software-copyright preparation notes: `docs/thesis/`
- Planning notes: `docs/planning/`
- UI/readme screenshots: `docs/assets/`
- Source persona/teaser media: `docs/assets/source-images/`

## Safety Notes

The repository intentionally excludes:

- `.env` and `museguide/configs/secrets.yaml`
- `.conda/`, virtual environments, and dependency caches
- logs and tenant runtime data
- model checkpoints and large downloaded weights
- nested LiveTalking runtime repository state

If a local demo requires those files, provision them on the target machine rather than committing them.
