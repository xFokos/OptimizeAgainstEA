import { useMemo } from 'react';
import type { Minimum, MapConfig } from '../../../types/map.ts';
import { createMapProblem } from '../../../engine/functionSurface';
import { MAP_SIZES, type MapSizeId } from '../../../engine/mapCodec';
import { GameMap } from '../shared/GameMap';

interface GlobalMinimumPickerProps {
  minima: Minimum[];
  selectedId: string | null;
  size: MapSizeId;
  onSelect: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
}

const DUMMY_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

export function GlobalMinimumPicker({
                                      minima,
                                      selectedId,
                                      size,
                                      onSelect,
                                      onBack,
                                      onFinish,
                                    }: GlobalMinimumPickerProps) {
  const preset = MAP_SIZES[size];
  const evaluateFn = useMemo(() => {
    if (minima.length === 0) return undefined;
    const config: MapConfig = {
      id: 'preview',
      minima,
      bounds: DUMMY_BOUNDS,
      winRadius: preset.winRadius,
      basinScale: preset.basinScale,
      createdAt: 0,
    };
    return createMapProblem(config).evaluate;
  }, [minima, preset.winRadius, preset.basinScale]);

  return (
      <div className="create-step">
        <div className="create-step__info">
          <h2 className="create-step__heading">
            <span className="badge">02</span>
            Pick the Global Peak
          </h2>
          <p className="create-step__desc">
            Click the dot that should be the global peak — the one the
            player must find to win.
          </p>

          {selectedId && (
              <div className="selection-preview">
                <span className="selection-preview__dot" />
                <span>Global peak selected</span>
              </div>
          )}

          <div className="create-step__actions">
            <button
                className="btn btn--primary"
                disabled={!selectedId}
                onClick={onFinish}
            >
              Generate Code →
            </button>
            <button className="btn btn--ghost" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>

        <div className="create-step__map-wrap">
          <GameMap
              minima={minima}
              showMinima
              highlightGlobal
              evaluateFn={evaluateFn}
              heatmapConfig={{ colorSpread: 0 }}
              onMinimumClick={onSelect}
              selectedId={selectedId}
              overlayLabel={!selectedId ? 'Click a dot to select it as the global peak' : undefined}
          />
          <p className="map-hint">Click a dot to mark it as the global peak</p>
        </div>
      </div>
  );
}