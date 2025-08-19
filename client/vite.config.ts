import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/progress-manager/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['localhost', 'com3887', '.com3887', 'ids5053', '.ids5053'],
    proxy: {
      '/progress-manager/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace('/progress-manager', '')
      },
      '/progress-manager/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
        rewrite: (path) => path.replace('/progress-manager', '')
      }
    }
  }
})