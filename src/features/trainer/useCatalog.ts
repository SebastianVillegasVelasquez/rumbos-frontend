import { useQuery } from '@tanstack/react-query'
import { trainerApi } from './api.ts'

// The catalog, shared by the HUD button (which decides from it) and the stage (which
// shows it): one query key, so opening the stage does not ask the server twice.
export const CATALOG_KEY = ['trainer', 'catalog'] as const

export const useCatalog = (enabled = true) =>
  useQuery({
    queryKey: CATALOG_KEY,
    queryFn: trainerApi.catalog,
    retry: 1,
    staleTime: 30_000,
    enabled,
  })
