import { MAP_SIZES, MAP_SIZE_IDS, type MapSizeId } from '../../../engine/mapCodec';

interface MapSizePickerProps {
  value: MapSizeId;
  onChange: (size: MapSizeId) => void;
}

/** Size of the next randomly generated map: more minima and a tighter summit as it grows. */
export function MapSizePicker({ value, onChange }: MapSizePickerProps) {
  return (
    <div className="map-size-picker">
      <span className="map-size-picker__label">Map size</span>
      <div className="map-size-picker__options">
        {MAP_SIZE_IDS.map((id) => {
          const preset = MAP_SIZES[id];
          const [lo, hi] = preset.minima;
          return (
            <button
              key={id}
              type="button"
              className={`btn btn--sm ${id === value ? 'btn--active' : 'btn--ghost'}`}
              onClick={() => onChange(id)}
              title={`${lo}–${hi} minima · win radius ${preset.winRadius}`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
