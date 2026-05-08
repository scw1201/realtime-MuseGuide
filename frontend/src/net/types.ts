// 🔊 来自 TTS worker 的 meta 信息
export interface TTSMeta {
  type: 'meta'
  format: 'pcm_s16le'
  sample_rate: number
  channels: number
}

// 🔊 PCM chunk（已经 decode 成 Int16Array）
export type PCMChunk = Int16Array

// 回调签名
export type OnMeta = (meta: TTSMeta) => void
export type OnPCM = (pcm: PCMChunk) => void

export interface SuggestedAction {
  label: string
  text: string
}

export type InputSource = 'text' | 'voice' | 'chip' | 'start' | 'auto'

export interface LLMResponse {
  guide_state: string
  video_state?: string
  video_dir?: string
  video_prefix?: string
  tts_text: string
  guide_zone: string
  guide_floor: string
  guide_area: string
  focus_exhibit: string
  guide_stage: string
  user_intent: string
  tts_voice_type?: string
  tour_event?: string
  current_zone?: string
  current_exhibit?: string
  visited_zones?: string[]
  visited_exhibits?: string[]
  next_step_type?: string
  next_step_target?: string
  pending_action_label?: string
  pending_action_text?: string
  pending_action_type?: string
  pending_action_target?: string
  suggested_actions?: SuggestedAction[]
}

export interface AnalyticsNamedCount {
  name: string
  count: number
}

export interface AnalyticsOverview {
  total_sessions: number
  total_requests: number
  total_responses: number
  avg_turns_per_session: number
  suggestion_accept_rate: number
  auto_advance_count: number
}

export interface AnalyticsZoneStageRow {
  zone: string
  [stage: string]: string | number
}

export interface AnalyticsRecentSession {
  session_id: string
  persona_id?: string
  last_ts?: string
  last_user_text?: string
  current_zone?: string
  current_exhibit?: string
  guide_stage?: string
}

export interface AnalyticsResponse {
  overview: AnalyticsOverview
  top_zones: AnalyticsNamedCount[]
  top_exhibits: AnalyticsNamedCount[]
  guide_stage_counts: AnalyticsNamedCount[]
  persona_counts: AnalyticsNamedCount[]
  source_counts: AnalyticsNamedCount[]
  zone_stage_matrix: AnalyticsZoneStageRow[]
  recent_sessions: AnalyticsRecentSession[]
}
