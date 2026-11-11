import { defineConfig, devices } from '@playwright/test'

// Browser tests for layout only. They never ship in the bundle. Playwright's
// WebKit is NOT Safari: it is good for CSS and layout, and says nothing about
// codecs, autoplay, ITP or fullscreen (see docs/E2E.md).
const PORT = 5174
const viewport = { width: 1800, height: 1200 }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/mock-host/index.html`,
    env: { VITE_USE_MOCK_API: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
