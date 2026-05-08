from __future__ import annotations

from typing import Any, Dict, List

from museguide.llm.prompts import SYSTEM_PROMPT_CORE


def build_domain_prior_prompt(domain_cfg: dict) -> str:
    lines = ["以下是当前系统中可识别的展区与展品（包含空间信息）："]

    for zone in domain_cfg.get("zones", []):
        location = zone.get("location", {})
        floor = location.get("floor", "")
        area = location.get("area", "")
        description = location.get("description", "")
        zone_line = f"- 展区：{zone['name']}（{zone['id']}）"
        loc_parts = [part for part in [floor, area, description] if part]
        if loc_parts:
            zone_line += "｜位置：" + " / ".join(loc_parts)
        lines.append(zone_line)

        intro = zone.get("intro")
        if intro:
            lines.append(f"  简介：{intro}")

        summary = zone.get("summary")
        if summary:
            lines.append(f"  摘要：{summary}")

        key_points = [str(item).strip() for item in zone.get("key_points", []) if str(item).strip()]
        if key_points:
            lines.append("  导览重点：" + "；".join(key_points[:4]))

        historical_context = zone.get("historical_context")
        if historical_context:
            lines.append(f"  背景：{historical_context}")

        next_recommendation = zone.get("next_recommendation")
        if next_recommendation:
            lines.append(f"  讲完后可顺势推荐：{next_recommendation}")

        for exhibit in zone.get("exhibits", []):
            alias_str = "、".join(exhibit.get("aliases", []))
            lines.append(f"  - 展品：{exhibit['name']}（{exhibit['id']}），别名：{alias_str}")

            description = exhibit.get("description")
            if description:
                lines.append(f"    简介：{description}")

            summary = exhibit.get("summary")
            if summary:
                lines.append(f"    摘要：{summary}")

            key_points = [str(item).strip() for item in exhibit.get("key_points", []) if str(item).strip()]
            if key_points:
                lines.append("    可讲重点：" + "；".join(key_points[:4]))

            historical_context = exhibit.get("historical_context")
            if historical_context:
                lines.append(f"    背景：{historical_context}")

            craft = exhibit.get("craft")
            if craft:
                lines.append(f"    工艺/形式：{craft}")

            story = exhibit.get("story")
            if story:
                lines.append(f"    故事线索：{story}")

            observation = exhibit.get("observation")
            if observation:
                lines.append(f"    观察提示：{observation}")

            children_prompt = exhibit.get("children_prompt")
            if children_prompt:
                lines.append(f"    面向儿童可这样说：{children_prompt}")

            compare_to = exhibit.get("compare_to")
            if compare_to:
                lines.append(f"    可对比：{compare_to}")

            next_recommendation = exhibit.get("next_recommendation")
            if next_recommendation:
                lines.append(f"    讲完后可顺势推荐：{next_recommendation}")

    return "\n".join(lines)


def build_guide_state_prompt(guide_states: dict) -> str:
    lines = []
    lines.append("你只能从以下导览员【身体动作状态】中选择一个作为 guide_state：\n")

    for state_name, cfg in guide_states.items():
        desc = cfg.get("llm_desc", "")
        lines.append(f"- {state_name}")
        if desc:
            lines.append(f"  {desc}")

    lines.append("\nguide_state 只描述导览员当前的【身体行为意图】，不要考虑任何实现细节。")
    return "\n".join(lines)


def build_base_system_prompt(domain_cfg: dict, guide_states: dict) -> str:
    return "\n\n".join([
        SYSTEM_PROMPT_CORE.strip(),
        build_guide_state_prompt(guide_states),
        build_domain_prior_prompt(domain_cfg),
    ])


def build_system_prompt(
    *,
    persona: Dict[str, Any],
    persona_id: str,
    base_system_prompt: str,
    context_text: str = "",
    force_english: bool = False,
) -> str:
    prefix = (persona.get("prompt_prefix") or "").strip()
    self_ref = (persona.get("self_ref") or "").strip()
    user_address = (persona.get("user_address") or "").strip()
    if self_ref or user_address:
        prefix = "\n".join(filter(None, [
            prefix,
            "称呼与自称约束：",
            f"- 自称：{self_ref}" if self_ref else "",
            f"- 称呼用户：{user_address}" if user_address else "",
            "在 tts_text 中优先使用以上自称与称呼。",
        ]))

    if _persona_requires_english(persona_id, persona):
        prefix = "\n".join(filter(None, [
            prefix,
            "Language constraint: output JSON with tts_text in English only. Do not use Chinese.",
        ]))
        english_example = (
            '{\n'
            '  "guide_state": "GREETING_SELF",\n'
            '  "tts_text": "Hello, I am your museum guide. What would you like to explore today?",\n'
            '  "confidence": 0.9\n'
            '}'
        )
        prefix = "\n\n".join(filter(None, [
            prefix,
            "English example (follow this language):\n" + english_example,
        ]))
        if force_english:
            prefix = "\n".join(filter(None, [
                prefix,
                "Hard requirement: If any non-English appears in tts_text, the output is invalid.",
            ]))

    parts = [prefix, context_text, base_system_prompt]
    return "\n\n".join([part for part in parts if part])


def build_tour_progress_context(
    *,
    state: Dict[str, Any],
    user_text: str,
    domain_cfg: Dict[str, Any],
    normalize_text,
    recent_dialogue: str = "",
    pending_action: str = "",
    pending_action_confirmed: bool = False,
) -> str:
    if not state:
        return ""

    current_zone = str(state.get("current_zone", "")).strip()
    current_exhibit = str(state.get("current_exhibit", "")).strip()
    current_focus_status = str(state.get("current_focus_status", "")).strip()
    guide_stage = str(state.get("guide_stage", "")).strip()
    zone_progress = dict(state.get("zone_progress", {}) or {})
    exhibit_progress = dict(state.get("exhibit_progress", {}) or {})
    visited_zones = set(state.get("visited_zones", []) or [])
    visited_exhibits = set(state.get("visited_exhibits", []) or [])

    if not any([current_zone, current_exhibit, guide_stage, zone_progress, exhibit_progress]):
        return ""

    lines: List[str] = ["【导览进程】"]

    # 已涉及展区（压缩为一行）
    visited_zone_summaries = [
        f"{str(zone.get('name','')).strip()}（{_zone_status_label(str(zone_progress.get(str(zone.get('name','')).strip(), 'unseen')).strip())}）"
        for zone in domain_cfg.get("zones", [])
        if zone.get("category") != "facility"
        and str(zone_progress.get(str(zone.get("name", "")).strip(), "unseen")).strip() != "unseen"
    ]
    if visited_zone_summaries:
        lines.append("已涉及展区：" + "；".join(visited_zone_summaries))

    # 当前焦点
    if current_zone:
        lines.append(f"当前展区：{current_zone}｜阶段：{guide_stage or '未知'}")
    if current_exhibit:
        focus_label = _exhibit_status_label(
            current_focus_status or exhibit_progress.get(current_exhibit, "brief")
        )
        lines.append(f"当前展品：{current_exhibit}（{focus_label}）")

    # 当前展区展品进度
    current_zone_cfg = _zone_by_name(domain_cfg, current_zone)
    if current_zone_cfg:
        detailed: List[str] = []
        brief: List[str] = []
        unseen: List[str] = []
        for exhibit in current_zone_cfg.get("exhibits", []) or []:
            exhibit_name = str(exhibit.get("name", "")).strip()
            status = str(exhibit_progress.get(exhibit_name, "unseen")).strip()
            if status == "detailed":
                detailed.append(exhibit_name)
            elif status == "brief":
                brief.append(exhibit_name)
            else:
                unseen.append(exhibit_name)
        parts = []
        if detailed:
            parts.append("已深入：" + "、".join(detailed))
        if brief:
            parts.append("已简述：" + "、".join(brief))
        if unseen:
            parts.append("未讲：" + "、".join(unseen))
        else:
            parts.append("本展区展品已全部讲完")
        lines.append("展品进度：" + "；".join(parts))

    # 系统建议执行（pending action 结构化注入）
    if pending_action_confirmed and pending_action:
        lines.append(f"【系统建议执行】用户已确认：{pending_action}")

    if _is_next_item_request(user_text, normalize_text):
        lines.append("用户要求看下一件：优先选当前展区未讲展品；若已全部讲完，告知并询问是否前往下一展厅。")

    if recent_dialogue:
        lines.append(recent_dialogue)

    lines.append("基于以上进程推进讲解，避免重复已讲内容。")
    return "\n".join(lines)


def _zone_by_name(domain_cfg: Dict[str, Any], zone_name: str) -> Dict[str, Any]:
    name = str(zone_name or "").strip()
    if not name:
        return {}
    for zone in domain_cfg.get("zones", []):
        if name == str(zone.get("name", "")).strip():
            return zone
    return {}


def _persona_requires_english(persona_id: str, persona: Dict[str, Any]) -> bool:
    return persona.get("language") == "en" or persona_id.startswith("eu_")


def _is_next_item_request(user_text: str, normalize_text) -> bool:
    normalized = normalize_text(user_text)
    if not normalized:
        return False
    keywords = [
        "下一件",
        "下一個",
        "下一个",
        "下个",
        "下一個展品",
        "下一个展品",
        "继续看",
        "继续往下看",
        "继续下一件",
        "next exhibit",
        "next one",
        "what next",
    ]
    return any(keyword in normalized for keyword in keywords)


def _zone_status_label(status: str) -> str:
    return {
        "unseen": "未讲解",
        "entered": "已进入",
        "overview": "已概览",
        "detailed": "已深入",
    }.get(str(status or "").strip(), "未知")


def _exhibit_status_label(status: str) -> str:
    return {
        "unseen": "未讲解",
        "brief": "简要介绍",
        "detailed": "深入讲解",
    }.get(str(status or "").strip(), "未知")


def _build_zone_progress_lines(
    *,
    domain_cfg: Dict[str, Any],
    zone_progress: Dict[str, str],
    exhibit_progress: Dict[str, str],
    visited_zones: set[str],
    visited_exhibits: set[str],
) -> List[str]:
    lines: List[str] = []
    for zone in domain_cfg.get("zones", []):
        if zone.get("category") == "facility":
            continue
        zone_name = str(zone.get("name", "")).strip()
        if not zone_name:
            continue
        zone_status = str(zone_progress.get(zone_name, "unseen")).strip()
        seen_exhibits: List[str] = []
        unseen_exhibits: List[str] = []
        for exhibit in zone.get("exhibits", []) or []:
            exhibit_name = str(exhibit.get("name", "")).strip()
            if not exhibit_name:
                continue
            exhibit_status = str(exhibit_progress.get(exhibit_name, "unseen")).strip()
            if exhibit_name in visited_exhibits or exhibit_status in {"brief", "detailed"}:
                seen_exhibits.append(
                    f"{exhibit_name}（{_exhibit_status_label(exhibit_status or 'brief')}）"
                )
            else:
                unseen_exhibits.append(exhibit_name)
        zone_seen = zone_name in visited_zones or zone_status not in {"", "unseen"}
        line = f"- {zone_name}：{_zone_status_label(zone_status if zone_seen else 'unseen')}"
        line += "；已看展品：" + ("、".join(seen_exhibits) if seen_exhibits else "无")
        line += "；未看展品：" + (
            "、".join(unseen_exhibits) if unseen_exhibits else "无（本展厅已看完）"
        )
        lines.append(line)
    return lines
