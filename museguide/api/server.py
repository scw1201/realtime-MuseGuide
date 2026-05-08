import asyncio
import json
import os
import secrets
import time
from collections import Counter, defaultdict
from pathlib import Path

import websockets
import yaml
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from museguide.llm.orchestrator import LLMOrchestrator
from museguide.tenant_store import (
    ensure_tenant_files,
    get_tenant_info,
    load_tenant_registry,
    resolve_tenant_id,
)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRETS_PATH = Path(__file__).parents[1] / "configs" / "secrets.yaml"
FRONTEND_DIST_PATH = Path(__file__).parents[2] / "frontend" / "dist"
ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12
ADMIN_SESSIONS: dict[str, dict] = {}
ORCHESTRATORS: dict[str, LLMOrchestrator] = {}


class LLMRequest(BaseModel):
    text: str
    persona_id: str = "woman_demo"
    session_id: str | None = None
    source: str = "text"
    tenant_id: str | None = None


class DomainPriorPayload(BaseModel):
    data: dict


class PersonasPayload(BaseModel):
    data: dict


class AdminLoginRequest(BaseModel):
    username: str = "admin"
    password: str


def _load_secrets() -> dict:
    if not SECRETS_PATH.exists():
        return {}
    with open(SECRETS_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _get_admin_users() -> list[dict]:
    env_password = os.getenv("MUSEGUIDE_ADMIN_PASSWORD", "").strip()
    if env_password:
        return [{
            "username": "admin",
            "password": env_password,
            "tenant_id": resolve_tenant_id(),
            "role": "owner",
        }]
    admin_config = (_load_secrets().get("admin", {}) or {})
    users = admin_config.get("users")
    if isinstance(users, list) and users:
        return [user for user in users if isinstance(user, dict)]
    legacy_password = str(admin_config.get("password", "")).strip()
    if legacy_password:
        return [{
            "username": "admin",
            "password": legacy_password,
            "tenant_id": resolve_tenant_id(),
            "role": "owner",
        }]
    return []


def _get_orchestrator(tenant_id: str) -> LLMOrchestrator:
    tenant_id = resolve_tenant_id(requested=tenant_id)
    if tenant_id not in ORCHESTRATORS:
        ORCHESTRATORS[tenant_id] = LLMOrchestrator(tenant_id=tenant_id)
    return ORCHESTRATORS[tenant_id]


def require_admin(authorization: str = Header(default="")):
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Admin login required")
    session = ADMIN_SESSIONS.get(token) or {}
    expires_at = float(session.get("expires_at") or 0)
    if not expires_at or expires_at < time.time():
        ADMIN_SESSIONS.pop(token, None)
        raise HTTPException(status_code=401, detail="Admin session expired")
    return session


def _tenant_from_request(request: Request, requested: str | None = None) -> str:
    header_tenant = request.headers.get("X-MuseGuide-Tenant")
    return resolve_tenant_id(
        host=request.headers.get("host"),
        requested=requested or header_tenant,
    )


def _asr_upstream_url() -> str:
    return os.getenv("MUSEGUIDE_ASR_UPSTREAM", "ws://127.0.0.1:9001")


def _tts_upstream_url() -> str:
    return os.getenv("MUSEGUIDE_TTS_UPSTREAM", "ws://127.0.0.1:8765")


def _frontend_enabled() -> bool:
    return FRONTEND_DIST_PATH.exists()


def _frontend_file_for_path(path: str) -> Path:
    clean_path = path.strip("/")
    target = (FRONTEND_DIST_PATH / clean_path).resolve()
    try:
        target.relative_to(FRONTEND_DIST_PATH.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Not found") from exc
    if target.is_file():
        return target
    index_file = FRONTEND_DIST_PATH / "index.html"
    if index_file.is_file():
        return index_file
    raise HTTPException(status_code=404, detail="Frontend dist is not available")


async def _proxy_websocket(websocket: WebSocket, upstream_url: str) -> None:
    await websocket.accept()
    try:
        async with websockets.connect(upstream_url, max_size=50 * 1024 * 1024) as upstream:
            async def client_to_upstream() -> None:
                while True:
                    message = await websocket.receive()
                    message_type = message.get("type")
                    if message_type == "websocket.disconnect":
                        break
                    if message.get("bytes") is not None:
                        await upstream.send(message["bytes"])
                    elif message.get("text") is not None:
                        await upstream.send(message["text"])

            async def upstream_to_client() -> None:
                async for message in upstream:
                    if isinstance(message, bytes):
                        await websocket.send_bytes(message)
                    else:
                        await websocket.send_text(message)

            tasks = [
                asyncio.create_task(client_to_upstream()),
                asyncio.create_task(upstream_to_client()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, WebSocketDisconnect):
                    raise exc
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@app.post("/api/llm")
def run_llm(req: LLMRequest, request: Request):
    tenant_id = _tenant_from_request(request, req.tenant_id)
    return _get_orchestrator(tenant_id).run(req.text, req.persona_id, req.session_id, req.source)


@app.get("/api/domain_prior")
def get_domain_prior(request: Request, tenant_id: str | None = None):
    resolved_tenant = _tenant_from_request(request, tenant_id)
    path = ensure_tenant_files(resolved_tenant)["domain_prior"]
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/personas")
def get_personas(request: Request, tenant_id: str | None = None):
    resolved_tenant = _tenant_from_request(request, tenant_id)
    path = ensure_tenant_files(resolved_tenant)["personas"]
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("personas", {})


@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest):
    users = _get_admin_users()
    if not users:
        raise HTTPException(status_code=503, detail="Admin password is not configured")
    matched_user = None
    for user in users:
        username = str(user.get("username", "admin")).strip() or "admin"
        password = str(user.get("password", "")).strip()
        if username == req.username and password and secrets.compare_digest(req.password, password):
            matched_user = user
            break
    if not matched_user:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    tenant_id = resolve_tenant_id(requested=str(matched_user.get("tenant_id", "")))
    token = secrets.token_urlsafe(32)
    ADMIN_SESSIONS[token] = {
        "expires_at": time.time() + ADMIN_TOKEN_TTL_SECONDS,
        "tenant_id": tenant_id,
        "username": str(matched_user.get("username", "admin")),
        "role": str(matched_user.get("role", "owner")),
    }
    tenant_info = get_tenant_info(tenant_id)
    return {
        "token": token,
        "expires_in": ADMIN_TOKEN_TTL_SECONDS,
        "tenant_id": tenant_id,
        "tenant_name": tenant_info.get("name", tenant_id),
    }


@app.get("/api/admin/session")
def admin_session(admin: dict = Depends(require_admin)):
    tenant_id = str(admin.get("tenant_id", ""))
    tenant_info = get_tenant_info(tenant_id)
    return {
        "ok": True,
        "tenant_id": tenant_id,
        "tenant_name": tenant_info.get("name", tenant_id),
        "username": admin.get("username", ""),
        "role": admin.get("role", ""),
    }


@app.get("/api/admin/content")
def get_admin_content(admin: dict = Depends(require_admin)):
    paths = ensure_tenant_files(str(admin.get("tenant_id", "")))
    with open(paths["domain_prior"], "r", encoding="utf-8") as f:
        domain_prior = json.load(f)
    with open(paths["personas"], "r", encoding="utf-8") as f:
        personas = yaml.safe_load(f) or {}
    return {
        "tenant": admin.get("tenant_id", ""),
        "domain_prior": domain_prior,
        "personas": personas.get("personas", {}),
    }


@app.put("/api/admin/domain_prior")
def update_domain_prior(payload: DomainPriorPayload, admin: dict = Depends(require_admin)):
    data = payload.data
    if not isinstance(data, dict) or not isinstance(data.get("zones"), list):
        raise HTTPException(status_code=400, detail="Invalid domain prior payload")
    tenant_id = str(admin.get("tenant_id", ""))
    paths = ensure_tenant_files(tenant_id)
    with open(paths["domain_prior"], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    _get_orchestrator(tenant_id).reload_runtime_content()
    return {"ok": True}


@app.put("/api/admin/personas")
def update_personas(payload: PersonasPayload, admin: dict = Depends(require_admin)):
    data = payload.data
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid personas payload")
    tenant_id = str(admin.get("tenant_id", ""))
    paths = ensure_tenant_files(tenant_id)
    with open(paths["personas"], "w", encoding="utf-8") as f:
        yaml.safe_dump(
            {"personas": data},
            f,
            allow_unicode=True,
            sort_keys=False,
        )
    _get_orchestrator(tenant_id).reload_runtime_content()
    return {"ok": True}


def _safe_div(num: float, den: float) -> float:
    if not den:
        return 0.0
    return round(num / den, 2)


def _top_items(counter: Counter, limit: int = 5) -> list[dict]:
    return [
        {"name": name, "count": count}
        for name, count in counter.most_common(limit)
        if str(name).strip()
    ]


@app.get("/api/admin/analytics")
def get_admin_analytics(admin: dict = Depends(require_admin)):
    DEBUG_LOG_PATH = ensure_tenant_files(str(admin.get("tenant_id", "")))["debug_log"]
    if not DEBUG_LOG_PATH.exists():
        return {
            "overview": {
                "total_sessions": 0,
                "total_requests": 0,
                "total_responses": 0,
                "avg_turns_per_session": 0,
                "suggestion_accept_rate": 0,
                "auto_advance_count": 0,
            },
            "top_zones": [],
            "top_exhibits": [],
            "guide_stage_counts": [],
            "persona_counts": [],
            "source_counts": [],
            "zone_stage_matrix": [],
            "recent_sessions": [],
        }

    total_requests = 0
    total_responses = 0
    auto_advance_count = 0
    accepted_suggestions = 0
    suggestion_opportunities = 0
    session_requests = Counter()
    persona_counts = Counter()
    source_counts = Counter()
    guide_stage_counts = Counter()
    top_zones = Counter()
    top_exhibits = Counter()
    zone_stage_counts: dict[str, Counter] = defaultdict(Counter)
    recent_sessions: dict[str, dict] = {}

    with open(DEBUG_LOG_PATH, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = str(item.get("event", "")).strip()
            session_id = str(item.get("session_id", "")).strip()
            persona_id = str(item.get("persona_id", "")).strip()
            ts = str(item.get("ts", "")).strip()

            if persona_id:
                persona_counts[persona_id] += 1

            if event == "request":
                total_requests += 1
                if session_id:
                    session_requests[session_id] += 1
                source = str(item.get("source", "text") or "text").strip()
                source_counts[source] += 1
                prior_state = item.get("prior_state", {}) or {}
                if str(prior_state.get("pending_action_text", "")).strip():
                    suggestion_opportunities += 1
                if str(item.get("confirmed_action", "")).strip():
                    accepted_suggestions += 1
                if source == "auto":
                    auto_advance_count += 1
                if session_id:
                    recent_sessions.setdefault(session_id, {})
                    recent_sessions[session_id].update({
                        "session_id": session_id,
                        "persona_id": persona_id,
                        "last_ts": ts,
                        "last_user_text": str(item.get("user_text", "")).strip(),
                    })
                continue

            if not event.startswith("response"):
                continue

            total_responses += 1
            result = item.get("result", {}) or {}
            zone_name = str(result.get("current_zone") or result.get("guide_zone") or "").strip()
            exhibit_name = str(result.get("current_exhibit") or result.get("focus_exhibit") or "").strip()
            guide_stage = str(result.get("guide_stage", "")).strip()

            if zone_name and zone_name != "未确定":
                top_zones[zone_name] += 1
            if exhibit_name and exhibit_name != "未确定":
                top_exhibits[exhibit_name] += 1
            if guide_stage:
                guide_stage_counts[guide_stage] += 1
            if zone_name and guide_stage:
                zone_stage_counts[zone_name][guide_stage] += 1

            if session_id:
                recent_sessions.setdefault(session_id, {})
                recent_sessions[session_id].update({
                    "session_id": session_id,
                    "persona_id": persona_id,
                    "last_ts": ts,
                    "current_zone": zone_name,
                    "current_exhibit": exhibit_name,
                    "guide_stage": guide_stage,
                })

    total_sessions = len(session_requests)
    avg_turns_per_session = _safe_div(sum(session_requests.values()), total_sessions)
    suggestion_accept_rate = _safe_div(accepted_suggestions * 100, suggestion_opportunities)

    zone_stage_matrix = []
    for zone_name, stage_counter in sorted(zone_stage_counts.items(), key=lambda item: sum(item[1].values()), reverse=True)[:6]:
        row = {"zone": zone_name}
        for stage_name, count in stage_counter.items():
            row[stage_name] = count
        zone_stage_matrix.append(row)

    recent_session_items = sorted(
        recent_sessions.values(),
        key=lambda item: item.get("last_ts", ""),
        reverse=True,
    )[:6]

    return {
        "overview": {
            "total_sessions": total_sessions,
            "total_requests": total_requests,
            "total_responses": total_responses,
            "avg_turns_per_session": avg_turns_per_session,
            "suggestion_accept_rate": suggestion_accept_rate,
            "auto_advance_count": auto_advance_count,
        },
        "top_zones": _top_items(top_zones),
        "top_exhibits": _top_items(top_exhibits),
        "guide_stage_counts": _top_items(guide_stage_counts, limit=8),
        "persona_counts": _top_items(persona_counts, limit=8),
        "source_counts": _top_items(source_counts, limit=8),
        "zone_stage_matrix": zone_stage_matrix,
        "recent_sessions": recent_session_items,
    }


@app.get("/healthz")
def healthcheck():
    return {
        "ok": True,
        "frontend_dist": _frontend_enabled(),
    }


@app.websocket("/asr-ws")
async def proxy_asr(websocket: WebSocket):
    await _proxy_websocket(websocket, _asr_upstream_url())


@app.websocket("/tts-ws")
async def proxy_tts(websocket: WebSocket):
    await _proxy_websocket(websocket, _tts_upstream_url())


@app.get("/", include_in_schema=False)
async def frontend_index():
    if not _frontend_enabled():
        raise HTTPException(status_code=404, detail="Frontend dist is not available")
    return FileResponse(_frontend_file_for_path(""))


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend_files(full_path: str):
    if not _frontend_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(_frontend_file_for_path(full_path))
