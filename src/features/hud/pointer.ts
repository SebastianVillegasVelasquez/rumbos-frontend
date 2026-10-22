// A touch screen: the embedded map keeps one-finger scrolling for the page
// until the person opts in (see MapCanvas touchGuard).
export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
