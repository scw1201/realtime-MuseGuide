import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/healthz': 'http://127.0.0.1:8000',
      '/asr-ws': {
        target: 'ws://127.0.0.1:9001',
        ws: true,
      },
      '/tts-ws': {
        target: 'ws://127.0.0.1:8765',
        ws: true,
      },
      '/livetalking': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/livetalking/, ''),
      },
    },
  },
})
