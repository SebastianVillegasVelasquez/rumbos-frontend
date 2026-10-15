export type MapViewKind = '2d' | '3d'

const STORAGE_KEY = 'rumbos.mapView'

// localStorage is a per-viewer convenience only: it can be empty, blocked or
// throw (private windows, cleared data), and the app must work without it.
export const readStoredMapView = (): MapViewKind => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

export const rememberMapView = (view: MapViewKind) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

// ?view=3d deep-links straight into the 3D view; otherwise the last choice
// wins, and 2D is the default.
export const initialMapView = (search = window.location.search): MapViewKind =>
  new URLSearchParams(search).get('view') === '3d' ? '3d' : readStoredMapView()
