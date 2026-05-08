from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import yaml

BASE_DIR = Path(__file__).resolve().parent
CONFIGS_DIR = BASE_DIR / "configs"
DATA_DIR = BASE_DIR / "data" / "tenants"
TENANTS_PATH = CONFIGS_DIR / "tenants.yaml"
DEFAULT_TENANT_ID = "museum_demo"


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_tenant_registry() -> dict:
    registry = load_yaml(TENANTS_PATH)
    tenants = registry.get("tenants") or {}
    if tenants:
        return registry
    return {
        "default_tenant": DEFAULT_TENANT_ID,
        "tenants": {
            DEFAULT_TENANT_ID: {
                "name": "MuseGuide Demo Museum",
                "data_dir": DEFAULT_TENANT_ID,
                "domains": [],
            }
        },
    }


def normalize_tenant_id(value: str | None) -> str:
    return str(value or "").strip() or DEFAULT_TENANT_ID


def resolve_tenant_id(host: str | None = None, requested: str | None = None) -> str:
    registry = load_tenant_registry()
    tenants = registry.get("tenants") or {}
    default_tenant = normalize_tenant_id(registry.get("default_tenant"))

    requested_id = normalize_tenant_id(requested) if requested else ""
    if requested_id and requested_id in tenants:
        return requested_id

    host_name = str(host or "").split(":", 1)[0].strip().lower()
    if host_name:
        for tenant_id, info in tenants.items():
            domains = [str(item).strip().lower() for item in (info or {}).get("domains", [])]
            if host_name in domains:
                return str(tenant_id)

    if default_tenant in tenants:
        return default_tenant
    return next(iter(tenants.keys()), DEFAULT_TENANT_ID)


def get_tenant_info(tenant_id: str) -> dict[str, Any]:
    tenants = load_tenant_registry().get("tenants") or {}
    return dict(tenants.get(tenant_id) or {})


def get_tenant_dir(tenant_id: str) -> Path:
    info = get_tenant_info(tenant_id)
    data_dir = str(info.get("data_dir") or tenant_id).strip()
    return DATA_DIR / data_dir


def get_tenant_paths(tenant_id: str) -> dict[str, Path]:
    tenant_dir = get_tenant_dir(tenant_id)
    return {
        "root": tenant_dir,
        "domain_prior": tenant_dir / "domain_prior.json",
        "personas": tenant_dir / "personas.yaml",
        "logs_dir": tenant_dir / "logs",
        "debug_log": tenant_dir / "logs" / "dialogue_debug.jsonl",
    }


def ensure_tenant_files(tenant_id: str) -> dict[str, Path]:
    paths = get_tenant_paths(tenant_id)
    paths["root"].mkdir(parents=True, exist_ok=True)
    paths["logs_dir"].mkdir(parents=True, exist_ok=True)

    legacy_domain = CONFIGS_DIR / "domain_prior.json"
    legacy_personas = CONFIGS_DIR / "personas.yaml"
    legacy_log = BASE_DIR / "logs" / "dialogue_debug.jsonl"

    if not paths["domain_prior"].exists() and legacy_domain.exists():
        shutil.copy2(legacy_domain, paths["domain_prior"])
    if not paths["personas"].exists() and legacy_personas.exists():
        shutil.copy2(legacy_personas, paths["personas"])
    if not paths["debug_log"].exists() and legacy_log.exists():
        shutil.copy2(legacy_log, paths["debug_log"])
    if not paths["debug_log"].exists():
        paths["debug_log"].touch()
    return paths


def load_tenant_domain_prior(tenant_id: str) -> dict:
    path = ensure_tenant_files(tenant_id)["domain_prior"]
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_tenant_personas(tenant_id: str) -> dict:
    path = ensure_tenant_files(tenant_id)["personas"]
    data = load_yaml(path)
    return data.get("personas", {})
