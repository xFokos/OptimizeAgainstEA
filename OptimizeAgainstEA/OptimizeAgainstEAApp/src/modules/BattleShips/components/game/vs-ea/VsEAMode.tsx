import { useState, useMemo, useCallback } from 'react';
import type { MapConfig, Coordinate } from '../../../types/map';
import { type EAConfig, DEFAULT_EA_CONFIG } from '../../../types/ea';
import { createMapProblem } from '../../../engine/functionSurface';
import { decodeMap, encodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { useEARunner } from '../../../hooks/useEARunner';
import { GameMap } from '../shared/GameMap';
import { ProbeMarker } from '../play/ProbeMarker';
import { WinOverlay } from '../play/WinOverlay';
import { EASettingsPanel } from './EASettingsPanel';
import { FitnessChart, type FitnessSeries } from '../shared/FitnessChart';

interface VsEAModeProps {
  onBack: () => void;
}

// ── Dual map loader ───────────────────────────────────────────────────────

interface DualLoaderState {
  generatedCode: string;
  playerCode:    string;
  eaCode:        string;
  playerErr:     string;
  eaErr:         string;
}

interface DualLoaderProps {
  eaConfig:             EAConfig;
  gensPerProbe:         number;
  onConfigChange:       (patch: Partial<EAConfig>) => void;
  onGensPerProbeChange: (n: number) => void;
  onStart:              (playerMap: MapConfig, eaMap: MapConfig) => void;
  onBack:               () => void;
}

function DualMapLoader({
                         eaConfig, gensPerProbe, onConfigChange, onGensPerProbeChange,
                         onStart, onBack,
                       }: DualLoaderProps) {
  const [s, setS] = useState<DualLoaderState>({
    playerCode: '', eaCode: '', playerErr: '', eaErr: '', generatedCode: '',
  });
  const [showSettings, setShowSettings] = useState(false);

  const set = (field: keyof DualLoaderState, value: string) =>
    setS((prev) => ({ ...prev, [field]: value }));

  const handleGenerate = () => {
    const map  = generateRandomMap(5 + Math.floor(Math.random() * 4));
    const code = encodeMap(map);
    setS((prev) => ({ ...prev, generatedCode: code, playerErr: '', eaErr: '' }));
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

      <div className="dual-loader__generate-row">
        <button className="btn btn--ghost" onClick={handleGenerate}>
          Generate Random Map
        </button>
        {s.generatedCode && (
          <div className="dual-loader__codebox">
            <input
              className="map-loader__input dual-loader__codebox-input"
              readOnly
              value={s.generatedCode}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigator.clipboard.writeText(s.generatedCode)}
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <div className="dual-loader__grid">
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
        <button className="btn btn--ghost btn--sm" onClick={() => setShowSettings((v) => !v)}>
          ⚙ EA Settings
        </button>
        <button className="btn btn--primary" disabled={!canStart} onClick={handleStart}>
          Start →
        </button>
      </div>

      {showSettings && (
        <EASettingsPanel
          config={eaConfig}
          gensPerProbe={gensPerProbe}
          onConfigChange={onConfigChange}
          onGensPerProbeChange={onGensPerProbeChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function VsEAMode({ onBack }: VsEAModeProps) {
  const [playerMap,    setPlayerMap]    = useState<MapConfig | null>(null);
  const [eaMap,        setEaMap]        = useState<MapConfig | null>(null);
  const [eaConfig,     setEaConfig]     = useState<EAConfig>(DEFAULT_EA_CONFIG);
  const [gensPerProbe, setGensPerProbe] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

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
    ea.init(em, eaConfig);
  };

  const handleReset = () => {
    play.reset();
    ea.reset();
    setPlayerMap(null);
    setEaMap(null);
    setHoveredIndex(-1);
  };

  const handleConfigChange = useCallback((patch: Partial<EAConfig>) => {
    setEaConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleProbe = useCallback((coord: Coordinate) => {
    play.probe(coord);
    ea.step(gensPerProbe);
  }, [play, ea, gensPerProbe]);

  const handleHover = useCallback((i: number) => setHoveredIndex(i), []);

  // Must be before early return
  const chartSeries = useMemo((): FitnessSeries[] => {
    const playerData = play.probes.map((p) => p.value);
    const sampledGens = ea.generations.filter((_, i) => (i + 1) % gensPerProbe === 0);
    const eaMeanData = sampledGens.map((g) => g.meanFitness);
    const eaBestData = sampledGens.map((g) => g.best.fitness);

    const series: FitnessSeries[] = [
      { label: 'You',      data: playerData, color: '#4af0a0' },
    ];
    if (sampledGens.length > 0) {
      series.push({ label: 'EA mean', data: eaMeanData, color: '#f0c44a' });
      series.push({ label: 'EA best', data: eaBestData, color: '#f07a4a' });
    }
    return series;
  }, [play.probes, ea.generations, gensPerProbe]);

  // ── Loader ────────────────────────────────────────────────────────────────
  if (!playerMap || !eaMap) {
    return (
      <DualMapLoader
        eaConfig={eaConfig}
        gensPerProbe={gensPerProbe}
        onConfigChange={handleConfigChange}
        onGensPerProbeChange={setGensPerProbe}
        onStart={handleStart}
        onBack={onBack}
      />
    );
  }

  const playerWon    = play.status === 'won';
  const eaWon        = ea.status === 'solved';
  const revealPoints = playerWon ? undefined : play.probes.map((p) => p.position);

  return (
    <div className="vsea-race">
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
              onMapClick={!playerWon ? handleProbe : undefined}
            >
              {play.probes.map((p, i) => (
                <ProbeMarker
                  key={i}
                  probe={p}
                  index={i}
                  isBest={p === play.bestProbe}
                  isHovered={i === hoveredIndex}
                  onHover={handleHover}
                />
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

          <div className="vsea-banner">
            {ea.status === 'running'   && <span className="vsea-banner__text vsea-banner__text--running">● Waiting for your move…</span>}
            {ea.status === 'solved'    && <span className="vsea-banner__text vsea-banner__text--solved">✓ Solved in {ea.totalGenerations} generations</span>}
            {ea.status === 'exhausted' && <span className="vsea-banner__text vsea-banner__text--exhausted">✗ Exhausted — no solution found</span>}
            {ea.status === 'idle'      && <span className="vsea-banner__text">Initialising…</span>}
            {ea.status === 'error'     && <span className="vsea-banner__text vsea-banner__text--error">Error: {ea.errorMessage}</span>}
          </div>

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

          {/* Chart — always shown, empty axes until first probe */}
          <FitnessChart
            series={chartSeries}
            hoveredIndex={hoveredIndex}
            onHover={handleHover}
          />

          {ea.best && (
            <div className="vsea-best">
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