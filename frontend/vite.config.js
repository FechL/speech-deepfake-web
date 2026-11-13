import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/detect': 'http://127.0.0.1:5001',
      '/health': 'http://127.0.0.1:5001',
      '/api': 'http://127.0.0.1:5001',
    }
  }
})
