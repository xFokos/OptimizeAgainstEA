import { useState, useMemo, useCallback, useEffect } from 'react';
import { valueToHeight } from '../../../engine/height';
import { decodeProblemOrNull, type DecodedProblem } from '../../../engine/problemCode';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { useHints } from '../../../../../components/hints';
import { GameMap } from '../shared/GameMap';
import { MapLoader } from './MapLoader';
import { ProbeMarker } from './ProbeMarker';
import { WinOverlay } from './WinOverlay';
import { FitnessChart } from '../shared/FitnessChart';

interface PlayModeProps {
  onBack: () => void;
  /** Optional map or function code to load straight into play, skipping the loader. */
  initialCode?: string;
}

export function PlayMode({ onBack, initialCode }: PlayModeProps) {
  const [loaded,       setLoaded]       = useState<DecodedProblem | null>(() => decodeProblemOrNull(initialCode));
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [dismissedWin, setDismissedWin] = useState(false);
  const [revealRadius, setRevealRadius] = useState(0.05);

  const problem = loaded?.problem ?? null;

  const { probes, status, bestProbe, probe, reset } = usePlaySession(problem);
  const { showHint } = useHints();

  // Blocking welcome modal the first time the play screen appears (problem loaded).
  useEffect(() => {
    if (problem) showHint('play.start');
  }, [problem, showHint]);

  // Blocking follow-up modal right after the player's first probe.
  useEffect(() => {
    if (probes.length === 1) showHint('play.firstProbe');
  }, [probes.length, showHint]);

  const handleLoad      = (next: DecodedProblem) => { setLoaded(next); reset(); setDismissedWin(false); };
  const handlePlayAgain = () => { setLoaded(null); reset(); setDismissedWin(false); };

  // Must be before early return
  const playerSeries = useMemo(() => probes.map((p) => valueToHeight(p.value)), [probes]);
  const handleHover  = useCallback((i: number) => setHoveredIndex(i), []);

  if (!loaded || !problem) {
    return <MapLoader onLoad={handleLoad} />;
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
        <span className="play-mode__mapid">{loaded.label}</span>
        <button className="btn btn--ghost btn--sm btn--danger" onClick={reset}>Reset</button>
      </div>

      {/* Explanation + reveal slider, above the map */}
      <div className="play-controls">
        <p className="play-controls__hint">
          {status === 'idle'    ? 'Click the map to place a probe.'
            : status === 'playing' ? 'Higher values are closer to the summit.'
              :                        'Summit reached!'}
        </p>

        <div className="play-controls__reveal">
          <label className="play-controls__reveal-label">
            Reveal radius
            <span className="play-controls__reveal-value">{revealRadius.toFixed(2)}</span>
          </label>
          <input
            type="range"
            className="slider"
            min={0.02} max={0.25} step={0.01}
            value={revealRadius}
            onChange={(e) => setRevealRadius(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* map | chart */}
      <div className="play-layout">

        {/* Map */}
        <div className="play-map-wrap" style={{ position: 'relative' }}>
          <GameMap
            evaluateFn={problem.evaluate}
            revealPoints={revealPoints}
            heatmapConfig={{ revealRadius, valueExponent: problem.displayExponent }}
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
              subtitle={loaded.label}
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