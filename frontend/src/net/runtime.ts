const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const apiOrigin = isLocalHost
  ? 'http://127.0.0.1:8000'
  : window.location.origin

function wsUrl(localPort: number, deployedPath: string) {
  if (isLocalHost) return `ws://127.0.0.1:${localPort}`
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${deployedPath}`
}

export const API_BASE = apiOrigin
export const ASR_WS_URL = wsUrl(9001, '/asr-ws')
export const TTS_WS_URL = wsUrl(8765, '/tts-ws')
