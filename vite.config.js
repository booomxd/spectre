import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // Figma code layers supply PORT / FIGMA_DEV_SERVER_HOST; everywhere else the dev server stays on 5173.
  server: {
    port: process.env.FIGMA ? Number(process.env.PORT) : 5173,
    host: process.env.FIGMA ? (process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0') : undefined,
    strictPort: true,
    // Never watch the Rust side: cargo locks target/*.exe while compiling, which crashes Vite's watcher (EBUSY).
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 2000,
  }
})
