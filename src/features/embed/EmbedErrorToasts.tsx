import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/toastContext.ts'
import { ApiError } from '../course-map/data/client.ts'
import { classifyFeatureError } from './escalation.ts'
import { friendlyApiMessage } from './localErrors.ts'

// A feature that cannot reach the backend is told to the person here, in the
// app: the map and everything else keep working, and nothing goes to the host
// (see escalation.ts). 4xx answers are not toasted: the component that asked
// shows its own state for them. Repeats of the same message are held back.
const REPEAT_GAP_MS = 15_000

export const EmbedErrorToasts = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    const lastShown = new Map<string, number>()
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      const error = event.action.error
      if (!(error instanceof ApiError)) return
      const kind = classifyFeatureError(error.status, error.detail.code)
      if (kind === 'moodle_source_not_provided' && import.meta.env.DEV) {
        console.error(
          '[rumbos-embed] a Moodle-backed endpoint answered 501 in embed mode: this is a bug,',
          event.query.queryKey
        )
      }
      if (kind === 'feature_api_error' && error.status !== 0 && error.status < 500) return
      const message = friendlyApiMessage(error.status, error.detail.code, import.meta.env.DEV)
      const now = Date.now()
      if (now - (lastShown.get(message) ?? -Infinity) < REPEAT_GAP_MS) return
      lastShown.set(message, now)
      toast.show(message, 'error')
    })
  }, [queryClient, toast])

  return null
}
