// window.localStorage itself can throw when site data is blocked; callers treat
// null as "nothing is remembered".
export const viewerStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
