import { useState, useMemo, useCallback } from 'react';
import type { MapConfig } from '../../../types/map';
import { createMapProblem } from '../../../engine/functionSurface';
import { decodeMap } from '../../../engine/mapCodec';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { GameMap } from '../shared/GameMap';
import { MapLoader } from './MapLoader';
import { ProbeMarker } from './ProbeMarker';
import { WinOverlay } from './WinOverlay';
import { FitnessChart } from '../shared/FitnessChart';

interface PlayModeProps {
  onBack: () => void;
  /** Optional map code to load straight into play, skipping the loader. */
  initialCode?: string;
}

function decodeOrNull(code: string | undefined): MapConfig | null {
  if (!code) return null;
  try { return decodeMap(code.trim()); }
  catch { return null; }
}

export function PlayMode({ onBack, initialCode }: PlayModeProps) {
  const [mapConfig,    setMapConfig]    = useState<MapConfig | null>(() => decodeOrNull(initialCode));
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [dismissedWin, setDismissedWin] = useState(false);

  const problem = useMemo(
    () => (mapConfig ? createMapProblem(mapConfig) : null),
    [mapConfig],
  );

  const { probes, status, bestProbe, probe, reset } = usePlaySession(problem);

  const handleLoad      = (config: MapConfig) => { setMapConfig(config); reset(); setDismissedWin(false); };
  const handlePlayAgain = () => { setMapConfig(null); reset(); setDismissedWin(false); };

  // Must be before early return
  const playerSeries = useMemo(() => probes.map((p) => p.value), [probes]);
  const handleHover  = useCallback((i: number) => setHoveredIndex(i), []);

  if (!mapConfig || !problem) {
    return <MapLoader onLoad={handleLoad} onBack={onBack} />;
  }

  const hasWon       = status === 'won';
  const showOverlay  = hasWon && !dismissedWin;
  // `undefined` reveals the whole map (on win); otherwise only the circles around
  // placed probes are revealed — an empty array hides everything.
  const revealPoints = hasWon ? undefined : probes.map((p) => p.position);

  return (
    <div className="play-mode">
      <div className="play-mode__topbar">
        <button className="btn btn--ghost btn--sm" onClick={handlePlayAgain}>Change Map</button>
        <span className="play-mode__mapid">#{mapConfig.id}</span>
        <button className="btn btn--ghost btn--sm btn--danger" onClick={reset}>Reset</button>
      </div>

      {/* sidebar | map | chart */}
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

          {probes.length > 0 && (
            <div className="play-sidebar__section">
              <div className="play-sidebar__label">Last probe</div>
              <div className="play-sidebar__value">
                {probes[probes.length - 1].value.toFixed(4)}
              </div>
            </div>
          )}

          <div className="play-sidebar__hint">
            {status === 'idle'    ? 'Click the map to place a probe.'
              : status === 'playing' ? 'Lower values are closer to a minimum.'
                :                        'Global minimum found!'}
          </div>
        </div>

        {/* Map */}
        <div className="play-map-wrap" style={{ position: 'relative' }}>
          <GameMap
            evaluateFn={problem.evaluate}
            revealPoints={revealPoints}
            onMapClick={!showOverlay ? probe : undefined}
          >
            {probes.map((p, i) => (
              <ProbeMarker
                key={i}
                probe={p}
                index={i}
                isBest={p === bestProbe}
                isHovered={i === hoveredIndex}
                onHover={handleHover}
              />
            ))}
          </GameMap>

          {showOverlay && bestProbe && (
            <WinOverlay
              probeCount={probes.length}
              bestProbe={bestProbe}
              mapId={mapConfig.id}
              onPlayAgain={handlePlayAgain}
              onHome={onBack}
              onKeepPlaying={() => setDismissedWin(true)}
            />
          )}
        </div>

        {/* Chart — right side */}
        <div className="play-chart-col">
          <FitnessChart
            series={[{ label: 'You', data: playerSeries, color: '#4af0a0' }]}
            compact
            hoveredIndex={hoveredIndex}
            onHover={handleHover}
          />
        </div>

      </div>
    </div>
  );
}