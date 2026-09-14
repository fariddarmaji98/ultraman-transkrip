import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Proxy /api ke backend FastAPI -> satu origin di dev (mirror setup prod via Caddy).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Host tunnel (ngrok) harus di-allow; request /api tetap diproxy ke backend lokal.
    // true = izinkan semua host: dev-only, di belakang ngrok host-nya dinamis.
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
