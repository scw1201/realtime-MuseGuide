# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MuseGuide is a conversational embodied digital human system for museum guidance. It maintains tour context (current zone, visited exhibits, guide stage) and drives a video avatar through structured LLM outputs.

## Development Commands

### Start all services (backend + frontend)
```bash
./dev.sh
```
This starts:
- ASR WebSocket server on port 9001
- TTS Worker on port 8765
- API server on port 8000
- Frontend Vite dev server on port 5173

### Start backend only
```bash
# ASR WebSocket
python -m museguide.asr.ws_server

# TTS Worker
python -m museguide.tts.worker_v3

# API Server (with reload)
ENABLE_RELOAD=1 python -m uvicorn museguide.api.server:app --reload --port 8000

# API Server (production)
python -m uvicorn museguide.api.server:app --port 8000
```

### Frontend
```bash
cd frontend
npm run dev      # Development server
npm run build    # Production build
```

## Architecture

### Data Flow
```
Browser (PCMRecorder) → ASR WebSocket → LLM Orchestrator → Structured JSON
                                                    ↓
Browser (TTSClient) ← TTS Worker ← tts_text + video_state
```

### Core Backend Modules (`museguide/llm/`)

**orchestrator.py** - Main entry point. `LLMOrchestrator.run()` processes user input through the full pipeline:
1. Resolves user text (handles confirmations like "好/是的" → pending actions)
2. Builds system prompt with persona + tour progress context
3. Calls LLM (Doubao/Ark)
4. Parses JSON response
5. Applies tour state updates
6. Maps to video state
7. Generates initiative plan (suggested actions)

**prompt_builder.py** - Constructs system prompts:
- `build_base_system_prompt()` - Core prompt + guide states + domain prior
- `build_system_prompt()` - Adds persona prefix and language constraints
- `build_tour_progress_context()` - Injects session state (visited zones/exhibits, current focus)

**context_store.py** - In-memory session storage keyed by `(session_id, persona_id)`. Tracks:
- Current zone/exhibit/stage
- Zone/exhibit progress (unseen → brief → detailed)
- Pending recommendation state
- Rolling dialogue history (6 turns, 280 chars max)

**guide_stage.py** - Five-stage tour progression:
- `STAGE_ROUTE_GUIDANCE` - Navigation to zones
- `STAGE_ZONE_OVERVIEW` - Zone introduction
- `STAGE_EXHIBIT_OVERVIEW` - Brief exhibit intro
- `STAGE_EXHIBIT_FOCUS` - Directing attention
- `STAGE_EXHIBIT_DETAIL` - Deep explanation

**initiative.py** - Generates `suggested_actions` and `follow_up_text` based on current state and domain prior.

### Key Frontend Modules (`frontend/src/`)

**main.ts** - App initialization, page routing (home/route/collections), voice input handling via ASRClient

**net/ASRClient.ts** - WebSocket client for streaming ASR to port 9001

**net/TTSClient.ts** - WebSocket client for receiving TTS audio from port 8765

**video/VideoEngine.ts** - Switches video based on `video_state` from backend

**audio/AudioEngine.ts** - Queue-based PCM playback with streaming拼接

### Configuration Files (`museguide/configs/`)

| File | Purpose |
|------|---------|
| `domain_prior.json` | Zones, exhibits, locations, aliases - the knowledge base |
| `guide_states.yaml` | Body action states (GREETING_SELF, EXPLAIN_DETAILED, POINTING_DIRECTION, FOCUS_EXHIBIT) |
| `personas.yaml` | 8 personas with voice types, prompt prefixes, self/user address forms |
| `llm.yaml` | Model settings (Doubao) |
| `secrets.yaml` | API keys (Doubao, ASR, TTS) - gitignored |

### LLM Output Structure

The LLM returns JSON that drives the entire system:
```json
{
  "guide_state": "EXPLAIN_DETAILED",
  "tts_text": "讲解内容...",
  "guide_zone": "中华文明源流展区",
  "focus_exhibit": "四羊方尊",
  "guide_stage": "深入讲解",
  "user_intent": "了解展品细节"
}
```

This gets enriched by orchestrator into:
```json
{
  "video_state": "EXPLAIN_DETAILED",
  "suggested_actions": [{"label": "看细节", "text": "讲讲工艺细节"}],
  "follow_up_text": "你想了解它的铸造工艺吗？",
  "pending_action_type": "deepen_exhibit",
  "zone_progress": {...},
  "exhibit_progress": {...}
}
```

### Persona System

Personas control:
- `tts_voice_type` -火山 TTS voice selection
- `prompt_prefix` - Character definition and speaking style
- `self_ref` / `user_address` - Pronouns (我/您, 在下/诸位, I/you)
- `language` - "en" for English-only output

Persona IDs: `woman_demo`, `man_demo`, `eu_woman_demo`, `eu_man_demo`, `gu_man_demo`, `gu_woman_demo`, `boy_demo`, `girl_demo`

### Video State Mapping

`guide_stage` + `tour_event` → `video_state` (deterministic mapping in `orchestrator.py`):
- Start command → `GREETING_SELF`
- Route guidance / zone transition → `POINTING_DIRECTION`
- Exhibit focus → `FOCUS_EXHIBIT`
- Everything else → `EXPLAIN_DETAILED`

### Confirmation Handling

When user says "好/是的/可以/ok", the system:
1. Checks `prior_state.pending_action_text` from previous turn
2. If exists and user has no explicit new instruction → substitutes pending action
3. If `pending_action_type == "ask_zone"` (open-ended) → keeps user text as-is

### Debug Logging

`museguide/logs/dialogue_debug.jsonl` contains full request/response traces when debugging.

## Common Development Patterns

### Adding a new guide stage
1. Add constant to `guide_stage.py`
2. Add to `GUIDE_STAGE_LABELS` with description
3. Update `normalize_guide_stage()` logic
4. Add video mapping in `orchestrator.py:_mapped_guide_state()`

### Adding a new persona
1. Add entry to `personas.yaml` with all fields
2. Add start greeting to `orchestrator.py:_build_start_tts()`
3. If English, update `_persona_requires_english()` check

### Modifying LLM prompt
- Core behavior: `museguide/llm/prompts.py` (SYSTEM_PROMPT_CORE)
- Guide states: `guide_states.yaml` (llm_desc field)
- Domain knowledge: `domain_prior.json`
- Persona voice: `personas.yaml` (prompt_prefix)

### Domain data changes
Edit `domain_prior.json` - zones and exhibits with location info, aliases for matching.
