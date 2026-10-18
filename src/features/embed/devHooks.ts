// Dev-only hooks for the mock host (mock-host/). Loaded only when running the
// dev server against the mock API, so none of this reaches a production build.

export const installDevHooks = (hostOrigin: string) => {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== hostOrigin || event.source !== window.parent) return
    const data = event.data as { type?: unknown } | null
    // "Expire token" button: every mock token stops working, so the next call
    // answers 401 and the session asks the host for a fresh assertion.
    if (data?.type === 'rumbos:dev-expire-token') {
      void import('../course-map/data/mockAuth.ts').then((mock) => mock.expireMockTokens())
    }
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
