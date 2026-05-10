const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const isViteDevServer = window.location.port === '5173'

const apiOrigin = isViteDevServer
  ? ''
  : isLocalHost
  ? 'http://127.0.0.1:8000'
  : window.location.origin

function wsUrl(localPort: number, deployedPath: string) {
  if (isViteDevServer) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}${deployedPath}`
  }
  if (isLocalHost) return `ws://127.0.0.1:${localPort}`
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${deployedPath}`
}

export const API_BASE = apiOrigin
export const ASR_WS_URL = wsUrl(9001, '/asr-ws')
export const TTS_WS_URL = wsUrl(8765, '/tts-ws')
export const LIVETALKING_BASE_URL =
  (import.meta.env.VITE_LIVETALKING_BASE_URL as string | undefined) ||
  (isViteDevServer ? '/livetalking' : isLocalHost ? 'http://127.0.0.1:8010' : `${window.location.origin}/livetalking`)
