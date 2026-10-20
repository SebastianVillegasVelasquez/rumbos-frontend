import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// "<short commit>@<build time>", stamped into index.html as
// <meta name="rumbos-build"> so two deployments (or /embed and /) can be
// compared with curl. The commit comes from the RUMBOS_BUILD_COMMIT build arg
// (the Docker build has no .git), else from git, else "unknown".
const buildStamp = () => {
  let commit = process.env.RUMBOS_BUILD_COMMIT?.trim()
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      commit = 'unknown'
    }
  }
  return `${commit}@${new Date().toISOString()}`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const stamp = buildStamp()
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'rumbos-build-stamp',
        transformIndexHtml: {
          order: 'pre',
          handler(html, ctx) {
            // Only the app's page; the 3D world is a separate document.
            if (!/^\/?index\.html$/.test(ctx.path)) return html
            return html.replace(
              '</head>',
              `  <meta name="rumbos-build" content="${stamp}" />
  </head>`
            )
          },
        },
      },
    ],
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
