import { defineConfig } from 'vite'

export default defineConfig({
  root: 'client',
  server: {
    port: 5173,
    proxy: {
      // All /api requests from the frontend get forwarded to the Express server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist'
  }
})
