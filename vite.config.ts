import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    // Two HTML entries: the app, and the self-contained 3D world at /3d/ that
    // the app embeds in an iframe (see docs/3d/BRIDGE.md).
    build: {
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          view3d: resolve(import.meta.dirname, '3d/index.html'),
        },
      },
    },
    // Dev-only: same-origin /api avoids CORS with the backend. Production needs
    // either a same-origin reverse proxy or CORS enabled on the backend.
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
