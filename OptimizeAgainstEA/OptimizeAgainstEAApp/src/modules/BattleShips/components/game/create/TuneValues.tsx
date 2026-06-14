import { useMemo, useState } from 'react';
import type { Minimum, MapConfig } from '../../../types/map.ts';
import {
  createMapProblem,
  effectiveFloor,
  floorToCenterValue,
  LOCAL_MIN_FLOOR_MIN,
  LOCAL_MIN_FLOOR_MAX,
} from '../../../engine/functionSurface';
import { GameMap } from '../shared/GameMap';

interface TuneValuesProps {
  minima: Minimum[];
  onSetFloor: (id: string, floor: number | undefined) => void;
  onBack: () => void;
  onNext: () => void;
}

const DUMMY_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

/** Slider bounds for a local minimum's floor (depth) — shared with the random-floor range. */
const FLOOR_MIN = LOCAL_MIN_FLOOR_MIN;
const FLOOR_MAX = LOCAL_MIN_FLOOR_MAX;
const FLOOR_STEP = 0.005;

export function TuneValues({ minima, onSetFloor, onBack, onNext }: TuneValuesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live preview surface — re-evaluates whenever any floor changes.
  const evaluateFn = useMemo(() => {
    if (minima.length === 0) return undefined;
    const config: MapConfig = {
      id: 'preview',
      minima,
      bounds: DUMMY_BOUNDS,
      winRadius: 0.04,
      createdAt: 0,
    };
    return createMapProblem(config).evaluate;
  }, [minima]);

  return (
      <div className="create-step">
        <div className="create-step__info">
          <h2 className="create-step__heading">
            <span className="step-badge">02</span>
            Tune Depths
          </h2>
          <p className="create-step__desc">
            Set how deep each minimum is — the value a probe reads at its
            center. Lower = deeper and more deceptive (looks almost as good as
            the global). Untouched nodes keep a random depth.
          </p>

          <div className="tune-list">
            {minima.map((m, i) => {
              const floor   = effectiveFloor(m);
              const center  = floorToCenterValue(floor);
              const isAuto  = m.floor === undefined;
              const isSel   = m.id === selectedId;
              return (
                  <div
                      key={m.id}
                      className={`ea-setting tune-row ${isSel ? 'tune-row--active' : ''}`}
                      onMouseEnter={() => setSelectedId(m.id)}
                      onMouseLeave={() => setSelectedId((cur) => (cur === m.id ? null : cur))}
                  >
                    <div className="ea-setting__header">
                      <span className="ea-setting__label">
                        Min #{i + 1}
                        {isAuto && <span className="tune-auto-tag"> · random</span>}
                      </span>
                      <span className="ea-setting__value">{center.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        className="ea-slider"
                        min={FLOOR_MIN} max={FLOOR_MAX} step={FLOOR_STEP}
                        value={floor}
                        onFocus={() => setSelectedId(m.id)}
                        onChange={(e) => onSetFloor(m.id, parseFloat(e.target.value))}
                    />
                    <div className="ea-setting__range">
                      <span>deep</span>
                      {!isAuto && (
                          <button
                              className="tune-reset"
                              onClick={() => onSetFloor(m.id, undefined)}
                          >
                            randomize
                          </button>
                      )}
                      <span>shallow</span>
                    </div>
                  </div>
              );
            })}
          </div>

          <div className="create-step__actions">
            <button className="btn btn--ghost" onClick={onBack}>
              ← Back
            </button>
            <button className="btn btn--primary" onClick={onNext}>
              Pick Global Minimum →
            </button>
          </div>
        </div>

        <div className="create-step__map-wrap">
          <GameMap
              minima={minima}
              showMinima
              evaluateFn={evaluateFn}
              onMinimumClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              selectedId={selectedId}
          />
          <p className="map-hint">Hover a slider — or click a dot — to highlight it</p>
        </div>
      </div>
  );
}
