import { useEffect, useState } from 'react'

export const IDLE_MS = 3000

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const

// True after IDLE_MS without any interaction with the page; false again at the
// first pointer movement, touch, key press or keyboard focus. `hold` keeps it
// awake (a panel is open, a popover is being used).
export const useIdleDim = (hold = false): boolean => {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (hold) return
    let timer = window.setTimeout(() => setIdle(true), IDLE_MS)
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), IDLE_MS)
    }
    WAKE_EVENTS.forEach((name) => window.addEventListener(name, wake, { passive: true }))
    window.addEventListener('focusin', wake)
    return () => {
      window.clearTimeout(timer)
      WAKE_EVENTS.forEach((name) => window.removeEventListener(name, wake))
      window.removeEventListener('focusin', wake)
    }
  }, [hold])

  // Holding wakes everything at once; derived so no effect has to set state.
  return idle && !hold
}
