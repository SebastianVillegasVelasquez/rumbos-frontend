import { createContext } from 'react'
import { createScrollMemory, type ScrollMemory } from './sections.ts'

// One memory per editor shell; a region used outside a shell still works, with its own.
export const ScrollMemoryContext = createContext<ScrollMemory>(createScrollMemory())
