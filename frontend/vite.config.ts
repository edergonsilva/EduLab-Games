import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        credentials: true,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        credentials: true,
      },
      // Socket.IO will connect directly to localhost:8000, not through this proxy
    },
  },
})
