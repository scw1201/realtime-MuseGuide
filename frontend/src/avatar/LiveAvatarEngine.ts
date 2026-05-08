import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionDisconnectReason,
  SessionEvent,
  SessionState,
} from '@heygen/liveavatar-web-sdk'
import { API_BASE } from '../net/runtime'

type LiveAvatarCallbacks = {
  onState?: (state: string) => void
  onStreamReady?: () => void
  onSpeakStart?: () => void
  onSpeakEnd?: () => void
  onError?: (message: string) => void
  onLog?: (entry: LiveAvatarLogEntry) => void
}

type TokenResponse = {
  session_token?: string
  token?: string
  session_id?: string
}

export type LiveAvatarLogEntry = {
  ts: string
  event: string
  detail?: string
}

export class LiveAvatarEngine {
  private video: HTMLVideoElement
  private callbacks: LiveAvatarCallbacks
  private session: LiveAvatarSession | null = null
  private keepAliveTimer: number | null = null
  private connected = false
  private starting = false

  constructor(video: HTMLVideoElement, callbacks: LiveAvatarCallbacks = {}) {
    this.video = video
    this.callbacks = callbacks
  }

  get isConnected() {
    return this.connected
  }

  get isStarting() {
    return this.starting
  }

  async start() {
    if (this.connected || this.starting) return
    this.starting = true
    this.callbacks.onState?.('CONNECTING')
    this.log('start_requested')

    try {
      const { token, sessionId } = await this.fetchSessionToken()
      this.log('token_created', sessionId ? `session_id=${sessionId}` : '')
      const session = new LiveAvatarSession(token, {
        voiceChat: false,
      })

      session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
        this.log('state_changed', state)
        this.callbacks.onState?.(state)
      })

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        this.log('stream_ready')
        session.attach(this.video)
        this.video.muted = false
        this.video.play().catch(() => {})
        this.callbacks.onStreamReady?.()
      })

      session.on(SessionEvent.SESSION_DISCONNECTED, (reason: SessionDisconnectReason) => {
        this.log('disconnected', reason || 'UNKNOWN_REASON')
        this.connected = false
        this.stopKeepAlive()
        this.callbacks.onState?.('DISCONNECTED')
      })

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        this.log('avatar_speak_started')
        this.callbacks.onSpeakStart?.()
      })

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        this.log('avatar_speak_ended')
        this.callbacks.onSpeakEnd?.()
      })

      await session.start()
      this.session = session
      this.connected = true
      this.startKeepAlive()
      this.log('session_started')
      this.callbacks.onState?.('CONNECTED')
    } catch (err) {
      this.connected = false
      const message = err instanceof Error ? err.message : String(err)
      this.log('start_failed', message)
      this.callbacks.onError?.(message)
      throw err
    } finally {
      this.starting = false
    }
  }

  async stop() {
    this.log('stop_requested')
    this.stopKeepAlive()
    const session = this.session
    this.session = null
    this.connected = false
    if (!session) return
    await session.stop().catch(() => {})
    this.log('session_stopped')
    this.callbacks.onState?.('DISCONNECTED')
  }

  speak(text: string) {
    const clean = text.trim()
    if (!clean || !this.session || !this.connected) return false
    this.log('speak_text', `${clean.length} chars`)
    this.session.repeat(clean)
    return true
  }

  interrupt() {
    if (!this.session || !this.connected) return
    this.log('interrupt')
    this.session.interrupt()
  }

  private async fetchSessionToken() {
    const res = await fetch(`${API_BASE}/api/liveavatar/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(detail || `LiveAvatar token failed with ${res.status}`)
    }
    const data = (await res.json()) as TokenResponse
    const token = data.session_token || data.token
    if (!token) {
      throw new Error('LiveAvatar token response did not include session_token')
    }
    return { token, sessionId: data.session_id || '' }
  }

  private startKeepAlive() {
    this.stopKeepAlive()
    this.keepAliveTimer = window.setInterval(() => {
      if (!this.session || !this.connected) return
      this.session.keepAlive()
        .then(() => this.log('keep_alive_ok'))
        .catch((err) => this.log('keep_alive_failed', err instanceof Error ? err.message : String(err)))
    }, 30000)
  }

  private stopKeepAlive() {
    if (!this.keepAliveTimer) return
    window.clearInterval(this.keepAliveTimer)
    this.keepAliveTimer = null
  }

  private log(event: string, detail = '') {
    const entry = {
      ts: new Date().toLocaleTimeString(),
      event,
      detail,
    }
    console.info('[LiveAvatar]', entry)
    this.callbacks.onLog?.(entry)
  }
}
