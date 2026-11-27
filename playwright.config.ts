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
  // Baselines are per engine, not per operating system (see docs/E2E.md).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{projectName}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport },
      // On a Linux CI runner WebKit runs several times slower than Chromium: elements that
      // are on their way miss the 5 s default.
      expect: { timeout: 15_000 },
    },
  ],
  webServer: {
    // Bound to IPv4 on purpose: the mock host loads the app from the other loopback name
    // (localhost <-> 127.0.0.1), and where `localhost` resolves to ::1 first (Linux CI)
    // 127.0.0.1 would be refused and every test through the mock host would time out.
    command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://localhost:${PORT}/mock-host/index.html`,
    env: { VITE_USE_MOCK_API: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
