import { useState, useMemo, useCallback, useEffect } from 'react';
import type { MapConfig, Coordinate } from '../../../types/map';
import type { EAConfig} from '../../../types/ea';
import { DEFAULT_EA_CONFIG } from '../../../types/ea';
import { createMapProblem } from '../../../engine/functionSurface';
import { decodeMap, encodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { useEARunner } from '../../../hooks/useEARunner';
import { GameMap } from '../shared/GameMap';
import { ProbeMarker } from '../play/ProbeMarker';
import { WinOverlay } from '../play/WinOverlay';
import { EASettingsPanel } from './EASettingsPanel';
import { FitnessChart } from '../shared/FitnessChart';
import type { FitnessSeries } from '../shared/FitnessChart';
import { EAReplayOverlay } from './EAReplayOverlay';
import { EAWinOverlay } from './EAWinOverlay';
import { GenerationReplayOverlay } from './GenerationReplayOverlay';
import { HintPopover } from '../../../hints/HintPopover';

interface VsEAModeProps {
  onBack: () => void;
  /** Optional map code to prefill both the player and EA code fields. */
  initialCode?: string;
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
  initialCode?:         string;
  onConfigChange:       (patch: Partial<EAConfig>) => void;
  onGensPerProbeChange: (n: number) => void;
  onStart:              (playerMap: MapConfig, eaMap: MapConfig) => void;
  onBack:               () => void;
}

function DualMapLoader({
                         eaConfig, gensPerProbe, initialCode, onConfigChange, onGensPerProbeChange,
                         onStart, onBack,
                       }: DualLoaderProps) {
  const [s, setS] = useState<DualLoaderState>({
    playerCode: initialCode ?? '', eaCode: initialCode ?? '', playerErr: '', eaErr: '', generatedCode: '',
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

export function VsEAMode({ onBack, initialCode }: VsEAModeProps) {
  const [playerMap,    setPlayerMap]    = useState<MapConfig | null>(null);
  const [eaMap,        setEaMap]        = useState<MapConfig | null>(null);
  const [eaConfig,     setEaConfig]     = useState<EAConfig>(DEFAULT_EA_CONFIG);
  const [gensPerProbe, setGensPerProbe] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [showReplay,      setShowReplay]      = useState(false);
  const [showEAWin,       setShowEAWin]       = useState(false);
  const [showGenReplay,   setShowGenReplay]   = useState(false);
  const [dismissedWin,    setDismissedWin]    = useState(false);

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

  useEffect(() => {
    if (ea.status === 'solved') setShowEAWin(true);
  }, [ea.status]);

  const handleReset = () => {
    play.reset();
    ea.reset();
    setPlayerMap(null);
    setEaMap(null);
    setHoveredIndex(-1);
    setShowReplay(false);
    setShowEAWin(false);
    setShowGenReplay(false);
    setDismissedWin(false);
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
    const playerData  = play.probes.map((p) => p.value);
    const sampledGens = ea.generations.filter((_g, i: number) => (i + 1) % gensPerProbe === 0);
    const eaMeanData  = sampledGens.map((g) => g.meanFitness);
    const eaBestData  = sampledGens.map((g) => g.best.fitness);

    const series: FitnessSeries[] = [
      { label: 'You',      data: playerData,  color: '#4af0a0' },
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
        initialCode={initialCode}
        onConfigChange={handleConfigChange}
        onGensPerProbeChange={setGensPerProbe}
        onStart={handleStart}
        onBack={onBack}
      />
    );
  }

  const playerWon    = play.status === 'won';
  const eaWon        = ea.status === 'solved';
  const showOverlay  = playerWon && !dismissedWin;
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
              onMapClick={!showOverlay ? handleProbe : undefined}
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

            {showOverlay && play.bestProbe && (
              <WinOverlay
                probeCount={play.probes.length}
                bestProbe={play.bestProbe}
                mapId={playerMap.id}
                onPlayAgain={handleReset}
                onHome={onBack}
                onKeepPlaying={() => setDismissedWin(true)}
              />
            )}
          </div>
        </div>

        {/* ── EA panel ── */}
        <div className="vsea-panel">
          <div className="vsea-panel__header">
            <span className="vsea-panel__label">EA</span>
            <span className="vsea-panel__meta">gen {ea.totalGenerations}</span>
          </div>

          <div className="vsea-banner">
            {ea.status === 'running'   && <span className="vsea-banner__text vsea-banner__text--running">● Waiting for your move…</span>}
            {ea.status === 'solved'    && <span className="vsea-banner__text vsea-banner__text--solved">✓ Solved in {ea.totalGenerations} generations</span>}
            {ea.status === 'exhausted' && <span className="vsea-banner__text vsea-banner__text--exhausted">✗ Exhausted — no solution found</span>}
            {ea.status === 'idle'      && <span className="vsea-banner__text">Initialising…</span>}
            {ea.status === 'error'     && <span className="vsea-banner__text vsea-banner__text--error">Error: {ea.errorMessage}</span>}
          </div>

          {/* Chart — always shown, empty axes until first probe */}
          <FitnessChart
            series={chartSeries}
            hoveredIndex={hoveredIndex}
            onHover={handleHover}
          />

          {/* Replay buttons */}
          {(ea.latestReplay && ea.latestReplay.length > 0 || ea.status === 'solved') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ea.latestReplay && ea.latestReplay.length > 0 && (
                <HintPopover id="vsEa.replayButton" placement="top">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setShowReplay(true)}
                  >
                    ▶ Watch Last Replay
                  </button>
                </HintPopover>
              )}
              {ea.status === 'solved' && ea.generations.length > 0 && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setShowGenReplay(true)}
                >
                  ▶ Watch Full Replay
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Replay overlay — rendered outside panels so it covers everything */}
      {showReplay && ea.latestReplay && (
        <EAReplayOverlay
          frames={ea.latestReplay}
          onClose={() => setShowReplay(false)}
        />
      )}

      {showEAWin && eaMap && (
        <EAWinOverlay
          generationCount={ea.totalGenerations}
          best={ea.best}
          mapId={eaMap.id}
          onWatchReplay={() => { setShowEAWin(false); setShowGenReplay(true); }}
          onDismiss={() => setShowEAWin(false)}
        />
      )}

      {showGenReplay && eaMap && (
        <GenerationReplayOverlay
          generations={ea.generations}
          eaMap={eaMap}
          onClose={() => setShowGenReplay(false)}
        />
      )}
    </div>
  );
}