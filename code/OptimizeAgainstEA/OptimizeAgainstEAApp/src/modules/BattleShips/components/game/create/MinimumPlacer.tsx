import { useMemo } from 'react';
import type { Minimum, Coordinate, MapConfig } from '../../../types/map.ts';
import { createMapProblem } from '../../../engine/functionSurface';
import { MAP_SIZES, type MapSizeId } from '../../../engine/mapCodec';
import { GameMap } from '../shared/GameMap';
import { MapSizePicker } from '../shared/MapSizePicker';

interface MinimumPlacerProps {
    minima: Minimum[];
    maxMinima: number;
    minSpacing: number;
    isFull: boolean;
    size: MapSizeId;
    onSizeChange: (size: MapSizeId) => void;
    onPlace: (coord: Coordinate) => void;
    onRemove: (id: string) => void;
    onNext: () => void;
}

const DUMMY_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

export function MinimumPlacer({
                                  minima,
                                  maxMinima,
                                  minSpacing,
                                  isFull,
                                  size,
                                  onSizeChange,
                                  onPlace,
                                  onRemove,
                                  onNext,
                              }: MinimumPlacerProps) {
    // Build a live evaluate function from whatever minima exist so far.
    // Re-computes only when minima array changes.
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
                    <span className="badge">01</span>
                    Place Mountains
                </h2>
                <p className="create-step__desc">
                    Click anywhere on the map to place a mountain.
                    Click a dot to remove it.
                </p>

                <MapSizePicker value={size} onChange={onSizeChange} />

                <div className="create-step__stats">
          <span className="stat">
            <span className="stat__value">
              {minima.length}
                <span style={{ fontSize: '1rem', opacity: 0.4 }}>/{maxMinima}</span>
            </span>
            <span className="stat__label">placed</span>
          </span>
                </div>

                {isFull && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--accent-global)' }}>
                        {minima.length > maxMinima
                            ? 'Over this size’s limit — pick a bigger size, or remove a dot.'
                            : 'Maximum reached — remove a dot, or pick a bigger size.'}
                    </p>
                )}

                <button
                    className="btn btn--primary"
                    disabled={minima.length < 2}
                    onClick={onNext}
                >
                    {minima.length < 2
                        ? `Place at least ${2 - minima.length} more`
                        : 'Pick Global Peak →'}
                </button>
            </div>

            <div className="create-step__map-wrap">
                <GameMap
                    minima={minima}
                    showMinima
                    evaluateFn={evaluateFn}
                    exclusionRadius={minSpacing / 2}
                    onMapClick={isFull ? undefined : onPlace}
                    onMinimumClick={onRemove}
                    overlayLabel={minima.length === 0 ? 'Click to place mountains' : undefined}
                />
                <p className="map-hint">Click a dot to remove it</p>
            </div>
        </div>
    );
}