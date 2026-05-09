import { LIVETALKING_BASE_URL } from '../net/runtime'

type LiveAvatarCallbacks = {
  onState?: (state: string) => void
  onStreamReady?: () => void
  onSpeakStart?: () => void
  onSpeakEnd?: () => void
  onError?: (message: string) => void
  onLog?: (entry: LiveAvatarLogEntry) => void
}

type LiveTalkingAnswer = RTCSessionDescriptionInit & {
  sessionid?: string
}

type LiveTalkingJson = {
  code?: number
  msg?: string
  data?: unknown
}

export type LiveAvatarLogEntry = {
  ts: string
  event: string
  detail?: string
}

export class LiveAvatarEngine {
  private video: HTMLVideoElement
  private callbacks: LiveAvatarCallbacks
  private baseUrl: string
  private pc: RTCPeerConnection | null = null
  private sessionId = ''
  private connected = false
  private starting = false
  private speakingPollTimer: number | null = null

  constructor(video: HTMLVideoElement, callbacks: LiveAvatarCallbacks = {}) {
    this.video = video
    this.callbacks = callbacks
    this.baseUrl = LIVETALKING_BASE_URL.replace(/\/$/, '')
  }

  get isConnected() {
    return this.connected
  }

  get isStarting() {
    return this.starting
  }

  async start(personaId = 'woman_demo') {
    if (this.connected || this.starting) return
    this.starting = true
    this.callbacks.onState?.('CONNECTING')
    this.log('start_requested', personaId)

    try {
      const pc = new RTCPeerConnection({ sdpSemantics: 'unified-plan' } as RTCConfiguration)
      this.pc = pc

      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.addEventListener('track', (event) => {
        const [stream] = event.streams
        if (!stream) return
        this.video.srcObject = stream
        // Auto-started WebRTC streams are often blocked unless muted first.
        this.video.muted = true
        this.video.playsInline = true
        this.video.autoplay = true
        this.video.play().catch(() => {})
        this.callbacks.onStreamReady?.()
      })
      pc.addEventListener('connectionstatechange', () => {
        this.log('connection_state', pc.connectionState)
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          this.callbacks.onState?.('DISCONNECTED')
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.waitForIceGathering(pc)

      const local = pc.localDescription
      if (!local) throw new Error('LiveTalking local offer is empty')

      const res = await fetch(`${this.baseUrl}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: local.sdp,
          type: local.type,
          avatar: `${personaId}_IDLE`,
        }),
      })
      if (!res.ok) throw new Error(`LiveTalking /offer failed with ${res.status}`)

      const answer = (await res.json()) as LiveTalkingAnswer
      if (!answer.sdp || !answer.type || !answer.sessionid) {
        throw new Error('LiveTalking /offer did not return sdp/type/sessionid')
      }
      this.sessionId = String(answer.sessionid)
      await pc.setRemoteDescription(answer)

      this.connected = true
      this.callbacks.onState?.('CONNECTED')
      this.log('session_started', `sessionid=${this.sessionId}`)
    } catch (err) {
      await this.stop()
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
    this.stopSpeakingPoll()
    this.connected = false
    this.sessionId = ''
    const pc = this.pc
    this.pc = null
    if (pc) pc.close()
    this.video.removeAttribute('srcObject')
    this.video.srcObject = null
    this.callbacks.onState?.('DISCONNECTED')
  }

  async speak(text: string, videoState = 'IDLE', voiceType?: string, personaId = 'woman_demo') {
    const clean = text.trim()
    if (!clean || !this.connected || !this.sessionId) return false
    this.video.muted = false
    this.video.play().catch(() => {})
    this.log('speak_text', `${videoState} · ${clean.length} chars`)
    this.callbacks.onSpeakStart?.()

    const res = await fetch(`${this.baseUrl}/museguide/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionid: this.sessionId,
        text: clean,
        video_state: videoState || 'IDLE',
        persona_id: personaId || 'woman_demo',
        interrupt: true,
        tts: voiceType ? { ref_file: voiceType } : undefined,
      }),
    })
    if (!res.ok) throw new Error(`LiveTalking /museguide/speak failed with ${res.status}`)

    const data = (await res.json()) as LiveTalkingJson
    if (typeof data.code === 'number' && data.code !== 0) {
      throw new Error(data.msg || 'LiveTalking speak failed')
    }
    this.startSpeakingPoll()
    return true
  }

  async interrupt() {
    if (!this.connected || !this.sessionId) return
    this.log('interrupt')
    const res = await fetch(`${this.baseUrl}/interrupt_talk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid: this.sessionId }),
    })
    if (!res.ok) throw new Error(`LiveTalking /interrupt_talk failed with ${res.status}`)
    this.stopSpeakingPoll()
    this.callbacks.onSpeakEnd?.()
  }

  private waitForIceGathering(pc: RTCPeerConnection) {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve()
        return
      }
      const checkState = () => {
        if (pc.iceGatheringState !== 'complete') return
        pc.removeEventListener('icegatheringstatechange', checkState)
        resolve()
      }
      pc.addEventListener('icegatheringstatechange', checkState)
    })
  }

  private startSpeakingPoll() {
    this.stopSpeakingPoll()
    let sawSpeaking = false
    let idleTicks = 0
    const startedAt = Date.now()
    this.speakingPollTimer = window.setInterval(async () => {
      if (!this.connected || !this.sessionId) {
        this.stopSpeakingPoll()
        return
      }
      try {
        const res = await fetch(`${this.baseUrl}/is_speaking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionid: this.sessionId }),
        })
        const data = (await res.json()) as LiveTalkingJson
        const speaking = Boolean(data.data)
        if (speaking) {
          sawSpeaking = true
          idleTicks = 0
          return
        }
        idleTicks += 1
        const timedOutIdle = !sawSpeaking && Date.now() - startedAt > 8000
        if ((sawSpeaking && idleTicks >= 2) || timedOutIdle) {
          this.stopSpeakingPoll()
          this.callbacks.onSpeakEnd?.()
        }
      } catch (err) {
        this.log('speaking_poll_failed', err instanceof Error ? err.message : String(err))
      }
    }, 500)
  }

  private stopSpeakingPoll() {
    if (!this.speakingPollTimer) return
    window.clearInterval(this.speakingPollTimer)
    this.speakingPollTimer = null
  }

  private log(event: string, detail = '') {
    const entry = {
      ts: new Date().toLocaleTimeString(),
      event,
      detail,
    }
    console.info('[LiveTalking]', entry)
    this.callbacks.onLog?.(entry)
  }
}
