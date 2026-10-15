import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx'
import { es } from '../../i18n/es.ts'
import type { MapViewKind } from './mapViewPreference.ts'

// "2D | 3D", shown only when the map has a 3D view.
export const MapViewToggle = ({
  value,
  onChange,
}: {
  value: MapViewKind
  onChange: (view: MapViewKind) => void
}) => (
  <SegmentedControl
    aria-label={es.view3d.toggleLabel}
    value={value}
    onChange={onChange}
    options={[
      { value: '2d', label: es.view3d.view2d },
      { value: '3d', label: es.view3d.view3d },
    ]}
  />
)
