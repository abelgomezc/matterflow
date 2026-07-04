import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// MatterFlow - (c) 2026 Abel Gomez
// MediaPipe tasks-vision usa WebAssembly; se excluye de la pre-optimizacion
// de dependencias para que el .wasm se cargue correctamente en dev.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1600,
  },
})