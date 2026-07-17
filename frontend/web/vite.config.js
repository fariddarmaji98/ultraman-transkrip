import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api ke backend FastAPI -> satu origin di dev (mirror setup prod via Caddy).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
