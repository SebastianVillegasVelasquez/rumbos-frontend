import { useQuery } from '@tanstack/react-query'
import { useEmbed } from '../embed/EmbedContext.ts'
import { courseMapApi } from '../course-map/data/index.ts'
import { retryTransient } from '../course-map/data/queryKeys.ts'
import type { AuthMe } from '../course-map/data/types.ts'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true'

// Absent `features`, or a request that fails, means no widgets: the optional
// features fail closed.
export const widgetsEnabledFrom = (me: Pick<AuthMe, 'features'> | undefined): boolean =>
  me?.features?.widgets === true

// What this token may use, from GET /auth/me. Only embedded sessions (and the
// mock) have a token to ask with.
export const useWidgetsEnabled = (): boolean => {
  const embed = useEmbed()
  const query = useQuery({
    queryKey: ['auth', 'me', embed?.courseId ?? null],
    queryFn: () => courseMapApi.getMe(),
    enabled: embed !== null || USE_MOCK,
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
  return widgetsEnabledFrom(query.data)
}
