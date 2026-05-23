import { useState, useMemo, useCallback } from 'react';
import type { MapConfig, Coordinate } from '../../../types/map';
import { DEFAULT_EA_CONFIG } from '../../../types/ea';
import { createMapProblem } from '../../../engine/functionSurface';
import { decodeMap, encodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { useEARunner } from '../../../hooks/useEARunner';
import { GameMap } from '../shared/GameMap';
import { ProbeMarker } from '../play/ProbeMarker';
import { WinOverlay } from '../play/WinOverlay';

interface VsEAModeProps {
  onBack: () => void;
}

/**
 * How many EA generations to advance per player probe.
 * Raise for a faster EA, lower to give the player more of an edge.
 */
const EA_GENS_PER_PROBE = 1;

// ── Dual map loader ───────────────────────────────────────────────────────

interface DualLoaderState {
  playerCode: string;
  eaCode:     string;
  playerErr:  string;
  eaErr:      string;
}

interface DualLoaderProps {
  onStart: (playerMap: MapConfig, eaMap: MapConfig) => void;
  onBack:  () => void;
}

function DualMapLoader({ onStart, onBack }: DualLoaderProps) {
  const [s, setS] = useState<DualLoaderState>({
    playerCode: '', eaCode: '', playerErr: '', eaErr: '',
  });

  const set = (field: keyof DualLoaderState, value: string) =>
    setS((prev) => ({ ...prev, [field]: value }));

  const handleGenerate = () => {
    const map  = generateRandomMap(5 + Math.floor(Math.random() * 4)); // 5–8 minima

    const code = encodeMap(map);
    setS((prev) => ({ ...prev, playerCode: code, eaCode: code, playerErr: '', eaErr: '' }));
  };

  const handleStart = () => {
    let playerMap: MapConfig | null = null;
    let eaMap:     MapConfig | null = null;
    let playerErr = '';
    let eaErr     = '';

    try { playerMap = decodeMap(s.playerCode.trim()); }
    catch { playerErr = 'Invalid code'; }

    try { eaMap = decodeMap(s.eaCode.trim()); }
    catch { eaErr = 'Invalid code'; }

    setS((prev) => ({ ...prev, playerErr, eaErr }));
    if (playerMap && eaMap) onStart(playerMap, eaMap);
  };

  const canStart = s.playerCode.trim().length > 0 && s.eaCode.trim().length > 0;

  return (
    <div className="dual-loader">
      <h2 className="dual-loader__heading">Vs Evolutionary Algorithm</h2>
      <p className="dual-loader__desc">
        Load a map for yourself and one for the EA — or generate a random map
        and paste the same code into both.
      </p>

      <button className="btn btn--ghost dual-loader__random" onClick={handleGenerate}>
        Generate Random Map
      </button>

      <div className="dual-loader__grid">
        {/* Player input */}
        <div className="dual-loader__col">
          <div className="dual-loader__col-label">Your Map</div>
          <input
            className="map-loader__input"
            placeholder="Paste map code…"
            value={s.playerCode}
            spellCheck={false}
            onChange={(e) => set('playerCode', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
          {s.playerErr && <p className="map-loader__error">{s.playerErr}</p>}
        </div>

        {/* EA input */}
        <div className="dual-loader__col">
          <div className="dual-loader__col-label">EA Map</div>
          <input
            className="map-loader__input"
            placeholder="Paste map code…"
            value={s.eaCode}
            spellCheck={false}
            onChange={(e) => set('eaCode', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
          {s.eaErr && <p className="map-loader__error">{s.eaErr}</p>}
        </div>
      </div>

      <div className="dual-loader__actions">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <button className="btn btn--primary" disabled={!canStart} onClick={handleStart}>
          Start →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function VsEAMode({ onBack }: VsEAModeProps) {
  const [playerMap, setPlayerMap] = useState<MapConfig | null>(null);
  const [eaMap,     setEaMap]     = useState<MapConfig | null>(null);

  const playerProblem = useMemo(
    () => (playerMap ? createMapProblem(playerMap) : null),
    [playerMap],
  );

  const play = usePlaySession(playerProblem);
  const ea   = useEARunner();

  const handleStart = (pm: MapConfig, em: MapConfig) => {
    setPlayerMap(pm);
    setEaMap(em);
    play.reset();
    ea.init(em, DEFAULT_EA_CONFIG);
  };

  const handleReset = () => {
    play.reset();
    ea.reset();
    setPlayerMap(null);
    setEaMap(null);
  };

  // When the player places a probe, also step the EA
  const handleProbe = useCallback((coord: Coordinate) => {
    play.probe(coord);
    ea.step(EA_GENS_PER_PROBE);
  }, [play, ea]);

  // ── Loader ────────────────────────────────────────────────────────────────
  if (!playerMap || !eaMap) {
    return <DualMapLoader onStart={handleStart} onBack={onBack} />;
  }

  const playerWon = play.status === 'won';
  const eaWon     = ea.status === 'solved';
  const revealPoints = playerWon ? undefined : play.probes.map((p) => p.position);

  return (
    <div className="vsea-race">
      {/* Top bar */}
      <div className="vsea-race__topbar">
        <button className="btn btn--ghost btn--sm" onClick={handleReset}>← Change Maps</button>
        <div className="vsea-race__title">
          {!playerWon && !eaWon && 'Race in progress'}
          {playerWon  && !eaWon && '🏆 You won!'}
          {eaWon      && !playerWon && '🤖 EA won!'}
          {playerWon  && eaWon  && 'Both solved!'}
        </div>
        <button className="btn btn--ghost btn--sm btn--danger" onClick={handleReset}>Reset</button>
      </div>

      {/* Side-by-side panels */}
      <div className="vsea-race__panels">

        {/* ── Player panel ── */}
        <div className="vsea-panel">
          <div className="vsea-panel__header">
            <span className="vsea-panel__label">You</span>
            <span className="vsea-panel__meta">
              {play.probes.length} probe{play.probes.length !== 1 ? 's' : ''}
              {play.bestProbe && ` · best ${play.bestProbe.value.toFixed(4)}`}
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <GameMap
              evaluateFn={playerProblem?.evaluate}
              revealPoints={revealPoints}
              revealRadius={0.1}
              onMapClick={!playerWon ? handleProbe : undefined}
            >
              {play.probes.map((p, i) => (
                <ProbeMarker key={i} probe={p} index={i} isBest={p === play.bestProbe} />
              ))}
            </GameMap>

            {playerWon && play.bestProbe && (
              <WinOverlay
                probeCount={play.probes.length}
                bestProbe={play.bestProbe}
                mapId={playerMap.id}
                onPlayAgain={handleReset}
                onHome={onBack}
              />
            )}
          </div>

          {/* Player probe history */}
          {play.probes.length > 0 && (
            <div className="probe-history" style={{ marginTop: 8 }}>
              <div className="probe-history__label">History</div>
              <div className="probe-history__list">
                {[...play.probes].reverse().slice(0, 6).map((p, i) => (
                  <div key={i} className={`probe-row${p === play.bestProbe ? ' probe-row--best' : ''}`}>
                    <span className="probe-row__idx">#{play.probes.length - i}</span>
                    <div className="probe-row__swatch" style={{ background: swatchColor(p.value) }} />
                    <span className="probe-row__val">{p.value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── EA panel ── */}
        <div className="vsea-panel">
          <div className="vsea-panel__header">
            <span className="vsea-panel__label">EA</span>
            <span className="vsea-panel__meta">
              gen {ea.totalGenerations}
              {ea.best && ` · best ${ea.best.fitness.toFixed(4)}`}
            </span>
          </div>

          {/* EA status */}
          <div className="vsea-banner" style={{ marginBottom: 8 }}>
            {ea.status === 'running'   && <span className="vsea-banner__text vsea-banner__text--running">● Waiting for your move…</span>}
            {ea.status === 'solved'    && <span className="vsea-banner__text vsea-banner__text--solved">✓ Solved in {ea.totalGenerations} generations</span>}
            {ea.status === 'exhausted' && <span className="vsea-banner__text vsea-banner__text--exhausted">✗ Exhausted — no solution found</span>}
            {ea.status === 'idle'      && <span className="vsea-banner__text">Initialising…</span>}
            {ea.status === 'error'     && <span className="vsea-banner__text vsea-banner__text--error">Error: {ea.errorMessage}</span>}
          </div>

          {/* Live stats */}
          {ea.currentGeneration && (
            <div className="vsea-stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              <div className="vsea-stat">
                <div className="vsea-stat__label">Generation</div>
                <div className="vsea-stat__value">{ea.currentGeneration.index + 1}</div>
              </div>
              <div className="vsea-stat">
                <div className="vsea-stat__label">Best fitness</div>
                <div className="vsea-stat__value vsea-stat__value--accent">
                  {ea.currentGeneration.best.fitness.toFixed(5)}
                </div>
              </div>
              <div className="vsea-stat">
                <div className="vsea-stat__label">Mean fitness</div>
                <div className="vsea-stat__value">{ea.currentGeneration.meanFitness.toFixed(5)}</div>
              </div>
              <div className="vsea-stat">
                <div className="vsea-stat__label">Best position</div>
                <div className="vsea-stat__value vsea-stat__value--mono">
                  ({ea.currentGeneration.best.position.x.toFixed(3)},&nbsp;
                  {ea.currentGeneration.best.position.y.toFixed(3)})
                </div>
              </div>
            </div>
          )}

          {/* EA generation log */}
          {ea.generations.length > 0 && (
            <div className="vsea-log" style={{ marginTop: 8 }}>
              <div className="vsea-log__label">Generation log</div>
              <div className="vsea-log__list">
                {[...ea.generations].reverse().slice(0, 8).map((g) => (
                  <div key={g.index} className="vsea-log__row">
                    <span className="vsea-log__gen">#{g.index + 1}</span>
                    <span className="vsea-log__best">best {g.best.fitness.toFixed(5)}</span>
                    <span className="vsea-log__mean">mean {g.meanFitness.toFixed(5)}</span>
                    {g.best.isSolution && <span className="vsea-log__solved">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All-time EA best */}
          {ea.best && (
            <div className="vsea-best" style={{ marginTop: 8 }}>
              <span className="vsea-best__label">All-time best</span>
              <span className="vsea-best__value">
                {ea.best.fitness.toFixed(5)} @ ({ea.best.position.x.toFixed(3)}, {ea.best.position.y.toFixed(3)})
              </span>
              {ea.best.isSolution && <span className="vsea-best__badge">SOLUTION</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function swatchColor(value: number): string {
  const r = Math.round(Math.min(255, value * 2 * 255));
  const g = Math.round(Math.min(255, (1 - value) * 2 * 255));
  return `rgb(${r},${g},60)`;
}