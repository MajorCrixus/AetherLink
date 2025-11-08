import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import cesium from 'vite-plugin-cesium'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cesium()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3001,  // Changed from 3000 to avoid potential blocking
    strictPort: true,
    hmr: {
      host: '192.168.68.135',  // Use IP for HMR from remote
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9000',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
  },
})