import { useState, useMemo } from 'react';
import type { MapConfig } from '../../../types/map.ts';
import { createMapProblem } from '../../../engine/functionSurface';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { GameMap } from '../shared/GameMap';
import { MapLoader } from './MapLoader';
import { ProbeMarker } from './ProbeMarker';
import { WinOverlay } from './WinOverlay';

interface PlayModeProps {
  onBack: () => void;
}

/** Reveal radius around each probe in normalized [0,1] units */
//const PROBE_REVEAL_RADIUS = 0.1;

export function PlayMode({ onBack }: PlayModeProps) {
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);

  const problem = useMemo(
      () => (mapConfig ? createMapProblem(mapConfig) : null),
      [mapConfig]
  );

  const { probes, status, bestProbe, probe, reset } = usePlaySession(problem);

  const handleLoad = (config: MapConfig) => {
    setMapConfig(config);
    reset();
  };

  const handlePlayAgain = () => {
    setMapConfig(null);
    reset();
  };

  if (!mapConfig || !problem) {
    return <MapLoader onLoad={handleLoad} onBack={onBack} />;
  }

  const lastProbe = probes[probes.length - 1] ?? null;
  const hasWon    = status === 'won';

  // During play: clip contours to circles around each probe.
  // On win: remove the clip so the full landscape is revealed.
  const revealPoints = hasWon ? undefined : probes.map((p) => p.position);

  return (
      <div className="play-mode">
        <div className="play-mode__topbar">
          <button className="btn btn--ghost btn--sm" onClick={handlePlayAgain}>
            Change Map
          </button>
          <span className="play-mode__mapid">#{mapConfig.id}</span>
          <button className="btn btn--ghost btn--sm btn--danger" onClick={reset}>
            Reset
          </button>
        </div>

        <div className="play-layout">
          <div className="play-sidebar">
            <div className="play-sidebar__section">
              <div className="play-sidebar__label">Probes placed</div>
              <div className="play-sidebar__value">{probes.length}</div>
            </div>

            {bestProbe && (
                <div className="play-sidebar__section">
                  <div className="play-sidebar__label">Best value</div>
                  <div className="play-sidebar__value play-sidebar__value--accent">
                    {bestProbe.value.toFixed(4)}
                  </div>
                </div>
            )}

            {lastProbe && (
                <div className="play-sidebar__section">
                  <div className="play-sidebar__label">Last probe</div>
                  <div className="play-sidebar__value">{lastProbe.value.toFixed(4)}</div>
                </div>
            )}

            <div className="play-sidebar__hint">
              {status === 'idle'
                  ? 'Click the map to place a probe.'
                  : status === 'playing'
                      ? 'Lower values are closer to a minimum.'
                      : 'Global minimum found!'}
            </div>

            {probes.length > 0 && (
                <div className="probe-history">
                  <div className="probe-history__label">History</div>
                  <div className="probe-history__list">
                    {[...probes].reverse().map((p, i) => {
                      const isBest = p === bestProbe;
                      return (
                          <div key={i} className={'probe-row' + (isBest ? ' probe-row--best' : '')}>
                            <span className="probe-row__idx">#{probes.length - i}</span>
                            <div className="probe-row__swatch" style={{ background: swatchColor(p.value) }} />
                            <span className="probe-row__val">{p.value.toFixed(4)}</span>
                          </div>
                      );
                    })}
                  </div>
                </div>
            )}
          </div>

          <div className="play-map-wrap" style={{ position: 'relative' }}>
            <GameMap
                evaluateFn={problem.evaluate}
                revealPoints={revealPoints}
                onMapClick={!hasWon ? probe : undefined}
            >
              {probes.map((p, i) => (
                  <ProbeMarker
                      key={i}
                      probe={p}
                      index={i}
                      isBest={p === bestProbe}
                  />
              ))}
            </GameMap>

            {hasWon && bestProbe && (
                <WinOverlay
                    probeCount={probes.length}
                    bestProbe={bestProbe}
                    mapId={mapConfig.id}
                    onPlayAgain={handlePlayAgain}
                    onHome={onBack}
                />
            )}
          </div>
        </div>
      </div>
  );
}

function swatchColor(value: number): string {
  const r = Math.round(Math.min(255, value * 2 * 255));
  const g = Math.round(Math.min(255, (1 - value) * 2 * 255));
  return 'rgb(' + r + ',' + g + ',60)';
}