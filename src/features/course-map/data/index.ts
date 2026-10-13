import { realCourseMapApi, type CourseMapApi } from './courseMapApi.ts'

// The mock is loaded on demand so a production build (VITE_USE_MOCK_API !==
// 'true') neither bundles nor preloads it: the whole branch is dead code once
// Vite inlines the env value.
const lazyMockApi = (): CourseMapApi =>
  new Proxy({} as CourseMapApi, {
    get:
      (_target, method: string) =>
      async (...args: unknown[]) => {
        const { mockCourseMapApi } = await import('./mockCourseMapApi.ts')
        return (mockCourseMapApi as unknown as Record<string, (...a: unknown[]) => unknown>)[
          method
        ](...args)
      },
  })

export const courseMapApi: CourseMapApi =
  import.meta.env.VITE_USE_MOCK_API === 'true' ? lazyMockApi() : realCourseMapApi
