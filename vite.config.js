import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/measles-dashboard/',
  plugins: [react()],
  build: {
    // The registry and state metadata are loaded asynchronously at module
    // initialization; keep top-level await in the output for supported browsers.
    target: 'esnext',
  },
})
