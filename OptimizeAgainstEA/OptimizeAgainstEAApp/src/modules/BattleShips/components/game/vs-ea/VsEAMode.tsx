import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { MapConfig, Coordinate } from '../../../types/map';
import type { EAConfig} from '../../../types/ea';
import { DEFAULT_EA_CONFIG } from '../../../types/ea';
import { createMapProblem } from '../../../engine/functionSurface';
import { valueToHeight } from '../../../engine/height';
import { decodeMap, encodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { copyCode, pasteCode } from '../../../engine/codeClipboard';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { useEARunner } from '../../../hooks/useEARunner';
import { GameMap } from '../shared/GameMap';
import { SavedMapsSidebar } from '../shared/SavedMapsSidebar';
import { ProbeMarker } from '../play/ProbeMarker';
import { WinOverlay } from '../play/WinOverlay';
import { EASettingsPanel } from './EASettingsPanel';
import { FitnessChart } from '../shared/FitnessChart';
import type { FitnessSeries } from '../shared/FitnessChart';
import { EAReplayOverlay } from './EAReplayOverlay';
import { EAWinOverlay } from './EAWinOverlay';
import { SecondSolveOverlay } from './SecondSolveOverlay';
import { GenerationReplayOverlay } from './GenerationReplayOverlay';
import { HintPopover, useHints } from '../../../../../components/hints';

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
  revealRadius:         number;
  initialPlayerCode?:   string;
  initialEaCode?:       string;
  onConfigChange:       (patch: Partial<EAConfig>) => void;
  onGensPerProbeChange: (n: number) => void;
  onRevealRadiusChange: (r: number) => void;
  onStart:              (playerMap: MapConfig, eaMap: MapConfig, playerCode: string, eaCode: string) => void;
  onBack:               () => void;
}

function DualMapLoader({
                         eaConfig, gensPerProbe, revealRadius, initialPlayerCode, initialEaCode, onConfigChange,
                         onGensPerProbeChange, onRevealRadiusChange, onStart, onBack,
                       }: DualLoaderProps) {
  const [s, setS] = useState<DualLoaderState>({
    playerCode: initialPlayerCode ?? '', eaCode: initialEaCode ?? '', playerErr: '', eaErr: '', generatedCode: '',
  });
  const [showSettings, setShowSettings] = useState(false);

  const set = (field: keyof DualLoaderState, value: string) =>
    setS((prev) => ({ ...prev, [field]: value }));

  const pasteInto = async (field: 'playerCode' | 'eaCode') => {
    const text = await pasteCode();
    if (text) set(field, text);
  };

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
    if (playerMap && eaMap) onStart(playerMap, eaMap, s.playerCode.trim(), s.eaCode.trim());
  };

  const canStart = s.playerCode.trim().length > 0 && s.eaCode.trim().length > 0;

  return (
    <div className="loader-with-saved">
    <SavedMapsSidebar />
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
              onClick={() => void copyCode(s.generatedCode)}
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <div className="dual-loader__grid">
        <div className="dual-loader__col">
          <div className="dual-loader__col-label">Your Map</div>
          <div className="dual-loader__paste-row">
            <input
              className="map-loader__input"
              placeholder="Paste map code…"
              value={s.playerCode}
              spellCheck={false}
              onChange={(e) => set('playerCode', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => pasteInto('playerCode')}
              title="Paste from clipboard"
            >
              📋
            </button>
          </div>
          {s.playerErr && <p className="map-loader__error">{s.playerErr}</p>}
        </div>

        <div className="dual-loader__col">
          <div className="dual-loader__col-label">EA Map</div>
          <div className="dual-loader__paste-row">
            <input
              className="map-loader__input"
              placeholder="Paste map code…"
              value={s.eaCode}
              spellCheck={false}
              onChange={(e) => set('eaCode', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => pasteInto('eaCode')}
              title="Paste from clipboard"
            >
              📋
            </button>
          </div>
          {s.eaErr && <p className="map-loader__error">{s.eaErr}</p>}
        </div>
      </div>

      <div className="dual-loader__actions">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <HintPopover id="vsEa.settingsButton" placement="bottom" dismissAfter={6000}>
          <button className="btn btn--ghost btn--sm ea-settings-btn" onClick={() => setShowSettings((v) => !v)}>
            ⚙ EA Settings
          </button>
        </HintPopover>
        <button className="btn btn--primary" disabled={!canStart} onClick={handleStart}>
          Start →
        </button>
      </div>

      {showSettings && (
        <EASettingsPanel
          config={eaConfig}
          gensPerProbe={gensPerProbe}
          revealRadius={revealRadius}
          onConfigChange={onConfigChange}
          onGensPerProbeChange={onGensPerProbeChange}
          onRevealRadiusChange={onRevealRadiusChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function VsEAMode({ onBack, initialCode }: VsEAModeProps) {
  const [playerMap,    setPlayerMap]    = useState<MapConfig | null>(null);
  const [eaMap,        setEaMap]        = useState<MapConfig | null>(null);
  // The codes last loaded into the race, kept so a reset returns to the loader
  // with the same maps already pasted in.
  const [playerCode,   setPlayerCode]   = useState(initialCode ?? '');
  const [eaCode,       setEaCode]       = useState(initialCode ?? '');
  const [eaConfig,     setEaConfig]     = useState<EAConfig>(DEFAULT_EA_CONFIG);
  const [gensPerProbe, setGensPerProbe] = useState(1);
  const [revealRadius, setRevealRadius] = useState(0.05);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [showReplay,      setShowReplay]      = useState(false);
  const [showEAWin,       setShowEAWin]       = useState(false);
  const [eaWinPending,    setEaWinPending]    = useState(false);
  const [showGenReplay,   setShowGenReplay]   = useState(false);
  const [dismissedWin,    setDismissedWin]    = useState(false);
  // The first side to finish locks the race result; if the other side later
  // also reaches the optimum, it surfaces a separate "caught up" popup.
  const [winner,          setWinner]          = useState<'player' | 'ea' | null>(null);
  const [secondSolver,    setSecondSolver]    = useState<'player' | 'ea' | null>(null);
  // After winning the whole map is revealed; this toggles that reveal on/off.
  const [solutionMapVisible, setSolutionMapVisible] = useState(true);
  const winnerRef = useRef<'player' | 'ea' | null>(null);

  const playerProblem = useMemo(
    () => (playerMap ? createMapProblem(playerMap) : null),
    [playerMap],
  );

  const play = usePlaySession(playerProblem);
  const ea   = useEARunner();
  const { showHint, active } = useHints();

  const handleStart = (pm: MapConfig, em: MapConfig, pCode: string, eCode: string) => {
    setPlayerMap(pm);
    setEaMap(em);
    setPlayerCode(pCode);
    setEaCode(eCode);
    play.reset();
    ea.init(em, eaConfig);
  };

  useEffect(() => {
    if (playerMap && eaMap && play.probes.length === 0) showHint('vsEa.start');
  }, [playerMap, eaMap, play.probes.length, showHint]);

  // Claims the win for `who` unless the other side already finished. Uses a ref
  // so the lock is read/written synchronously within a single render pass.
  const claimWin = useCallback((who: 'player' | 'ea') => {
    if (winnerRef.current) return false;
    winnerRef.current = who;
    setWinner(who);
    return true;
  }, []);

  // When the EA solves, show the explanatory hint first and queue the win card.
  // showHint no-ops if hints are disabled or the hint was already seen — in
  // that case `active` never becomes 'vsEa.eaWon' and the win card shows at once.
  useEffect(() => {
    if (ea.status !== 'solved') return;
    if (claimWin('ea')) {
      setEaWinPending(true);
      showHint('vsEa.eaWon');
    } else if (winnerRef.current === 'player') {
      setSecondSolver('ea');   // player won the race, EA caught up afterwards
    }
  }, [ea.status, showHint, claimWin]);

  // Reveal the win overlay once the eaWon hint is gone (dismissed or hints off).
  useEffect(() => {
    if (eaWinPending && active?.id !== 'vsEa.eaWon') {
      setShowEAWin(true);
      setEaWinPending(false);
    }
  }, [eaWinPending, active]);

  useEffect(() => {
    if (play.status !== 'won') return;
    if (claimWin('player')) {
      showHint('vsEa.playerWon');
    } else if (winnerRef.current === 'ea') {
      setSecondSolver('player');   // EA won the race, player caught up afterwards
    }
  }, [play.status, showHint, claimWin]);

  const handleReset = () => {
    play.reset();
    ea.reset();
    setPlayerMap(null);
    setEaMap(null);
    setHoveredIndex(-1);
    setShowReplay(false);
    setShowEAWin(false);
    setEaWinPending(false);
    setShowGenReplay(false);
    setDismissedWin(false);
    setWinner(null);
    setSecondSolver(null);
    setSolutionMapVisible(true);
    winnerRef.current = null;
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
    const playerData  = play.probes.map((p) => valueToHeight(p.value));
    const sampledGens = ea.generations.filter((_g, i: number) => (i + 1) % gensPerProbe === 0);
    const eaMeanData  = sampledGens.map((g) => valueToHeight(g.meanFitness));
    const eaBestData  = sampledGens.map((g) => valueToHeight(g.best.fitness));

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
        revealRadius={revealRadius}
        initialPlayerCode={playerCode}
        initialEaCode={eaCode}
        onConfigChange={handleConfigChange}
        onGensPerProbeChange={setGensPerProbe}
        onRevealRadiusChange={setRevealRadius}
        onStart={handleStart}
        onBack={onBack}
      />
    );
  }

  // Outcome is driven by the locked `winner` so the loser's later win is ignored.
  const playerWon    = winner === 'player';
  const eaWon        = winner === 'ea';
  const showOverlay  = playerWon && !dismissedWin;
  // True whenever the player has reached the optimum, regardless of who won the
  // race (covers both winning and catching up after the EA won).
  const playerSolved = play.status === 'won';
  // `undefined` reveals the whole map (once the player has solved it); otherwise
  // only circles around placed probes. The player can toggle the reveal off.
  const revealPoints = playerSolved && solutionMapVisible
    ? undefined
    : play.probes.map((p) => p.position);

  return (
    <div className="vsea-race">
      <div className="vsea-race__topbar">
        <button className="btn btn--ghost btn--sm" onClick={handleReset}>← Change Maps</button>
        <div className="vsea-race__title">
          {!playerWon && !eaWon && 'Race in progress'}
          {playerWon  && '🏆 You won!'}
          {eaWon      && '🤖 EA won!'}
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
              {play.bestProbe && ` · best ${valueToHeight(play.bestProbe.value).toFixed(4)}`}
            </span>
            {playerSolved && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setSolutionMapVisible((v) => !v)}
              >
                {solutionMapVisible ? 'Hide Map' : 'Show Map'}
              </button>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <GameMap
              evaluateFn={playerProblem?.evaluate}
              revealPoints={revealPoints}
              heatmapConfig={{ revealRadius }}
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

          {/* Replay buttons — under the map so they're reachable without
              scrolling to the bottom of the EA panel on mobile. */}
          {(ea.latestReplay && ea.latestReplay.length > 0 || ea.status === 'solved') && (
            <div style={{ display: 'flex', gap: 8 }}>
              {ea.latestReplay && ea.latestReplay.length > 0 && (
                <HintPopover id="vsEa.replayButton" placement="top-start">
                  <button
                    className="btn btn--blue btn--sm"
                    onClick={() => setShowReplay(true)}
                  >
                    ▶ Evolution Step
                  </button>
                </HintPopover>
              )}
              {ea.generations.length > 0 && (
                <HintPopover
                  id="vsEa.eaMovementButton"
                  placement="top-start"
                  show={play.probes.length >= 3 && !playerWon && !eaWon}
                >
                  <button
                    className="btn btn--blue btn--sm"
                    onClick={() => setShowGenReplay(true)}
                  >
                    ▶ EA Movement
                  </button>
                </HintPopover>
              )}
            </div>
          )}
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

      {secondSolver && (
        <SecondSolveOverlay
          who={secondSolver}
          onClose={() => setSecondSolver(null)}
        />
      )}
    </div>
  );
}