import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Minimum, ProblemInstance } from '../modules/BattleShips/types/map';
import { GameMap } from '../modules/BattleShips/components/game/shared/GameMap';
import {
  BENCHMARK_FUNCTIONS,
  FUNCTION_CATEGORIES,
  functionsInCategory,
  createFunctionProblem,
  randomFunctionSpec,
  type FunctionSpec,
} from '../modules/BattleShips/engine/functionProblem';
import '../modules/BattleShips/styles/BattleShipsStyles.css';

/**
 * Debug-only page for tuning each benchmark function's `sharpen` exponent.
 *
 * Pick a function, drag the slider, and watch the heatmap + win zone update
 * live. Nothing here is wired into real play — once a value looks right, copy it
 * into the function's `sharpen` field in `engine/functionProblem.ts`.
 */

// A centered, untransformed spec so the function is shown the same way each time
// (the player normally sees a randomly transformed copy — the "Re-roll" button
// lets you sanity-check that the chosen sharpen still reads well when rotated).
function centeredSpec(id: string): FunctionSpec {
  return { fn: id, cx: 0.5, cy: 0.5, theta: 0, sx: 1, sy: 1, rx: 1, ry: 1 };
}

/**
 * Paints the exact winning region as a translucent overlay. Winning is value-
 * based (`problem.isWin`), so the zone can be non-circular (e.g. Rosenbrock's
 * valley) — we sample `isWin` per pixel rather than drawing a ring.
 */
function WinZoneOverlay({ problem }: { problem: ProblemInstance }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const res = 240;
    canvas.width = res;
    canvas.height = res;
    const img = ctx.createImageData(res, res);
    const data = img.data;

    for (let py = 0; py < res; py++) {
      const ny = py / (res - 1);
      for (let px = 0; px < res; px++) {
        const nx = px / (res - 1);
        if (problem.isWin(nx, ny)) {
          const idx = (py * res + px) * 4;
          data[idx] = 80;       // r
          data[idx + 1] = 220;  // g
          data[idx + 2] = 120;  // b
          data[idx + 3] = 150;  // a — translucent green
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [problem]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}

export default function FunctionTunerPage() {
  const navigate = useNavigate();
  const [fnId, setFnId] = useState(BENCHMARK_FUNCTIONS[0].id);
  const [sharpen, setSharpen] = useState(BENCHMARK_FUNCTIONS[0].sharpen);
  const [spec, setSpec] = useState<FunctionSpec>(() => centeredSpec(BENCHMARK_FUNCTIONS[0].id));
  const [showWinZone, setShowWinZone] = useState(true);
  const [showCenterDot, setShowCenterDot] = useState(true);
  // In random mode the picker shows "Random (any function)" and every re-roll
  // lands on a fresh random function + transform — a preview of what the game's
  // "Random every time" code feels like.
  const [randomMode, setRandomMode] = useState(false);

  const fnDef = useMemo(
    () => BENCHMARK_FUNCTIONS.find((f) => f.id === fnId) ?? BENCHMARK_FUNCTIONS[0],
    [fnId],
  );

  const problem = useMemo(() => createFunctionProblem(spec, sharpen), [spec, sharpen]);

  // Marker on the resolved summit so you can see where winning is centered.
  const summit = problem.metadata?.globalMinimum;
  const minima: Minimum[] = summit
    ? [{ id: 'summit', position: { x: summit.x, y: summit.y }, isGlobal: true }]
    : [];

  const RANDOM_OPT = '__random';

  // Roll a fresh random function + transform and sync the editor to land on it.
  const rollRandom = () => {
    const next = randomFunctionSpec();
    const def = BENCHMARK_FUNCTIONS.find((f) => f.id === next.fn) ?? BENCHMARK_FUNCTIONS[0];
    setFnId(next.fn);
    setSharpen(def.sharpen);
    setSpec(next);
  };

  const onPick = (value: string) => {
    if (value === RANDOM_OPT) {
      setRandomMode(true);
      rollRandom();
      return;
    }
    setRandomMode(false);
    const def = BENCHMARK_FUNCTIONS.find((f) => f.id === value) ?? BENCHMARK_FUNCTIONS[0];
    setFnId(value);
    setSharpen(def.sharpen);
    setSpec(centeredSpec(value));
  };

  const reroll = () =>
    randomMode ? rollRandom() : setSpec(randomFunctionSpec(Math.random, { id: fnId }));
  const recenter = () => setSpec(centeredSpec(fnId));
  const resetSharpen = () => setSharpen(fnDef.sharpen);

  const isDefault = Math.abs(sharpen - fnDef.sharpen) < 1e-6;

  return (
    // index.css locks #root to 100vh/overflow:hidden, so this page is its own
    // scroll container (same trick .app uses on the PeakFinder page).
    <div
      style={{
        height: '100dvh',
        overflowY: 'auto',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/PeakFinder')}>
          ⛰ PeakFinder
        </button>
        <strong style={{ letterSpacing: '0.04em' }}>Function Sharpen Tuner</strong>
        <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>(debug)</span>
      </header>

      <div
        style={{
          display: 'grid',
          width: '100%',
          maxWidth: 1000,
          margin: '0 auto',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ── Surface ── */}
        <div>
          <GameMap
            evaluateFn={problem.evaluate}
            minima={minima}
            showMinima={showCenterDot}
            highlightGlobal
          >
            {showWinZone && <WinZoneOverlay problem={problem} />}
          </GameMap>
        </div>

        {/* ── Controls ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--map-bg, rgba(0,0,0,0.25))',
            border: '1px solid var(--map-border, rgba(255,255,255,0.08))',
            borderRadius: 8,
            padding: 16,
          }}
        >
          {/* Function picker, grouped by difficulty */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>Function</span>
            <select
              value={randomMode ? RANDOM_OPT : fnId}
              onChange={(e) => onPick(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 6 }}
            >
              <option value={RANDOM_OPT}>🎲 Random (any function)</option>
              {FUNCTION_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {functionsInCategory(cat).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {randomMode && (
              <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>
                Showing <strong>{fnDef.label}</strong> — re-roll for a new one.
              </span>
            )}
          </label>

          {/* Sharpen slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>Sharpen</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {sharpen.toFixed(2)}
                {!isDefault && (
                  <span style={{ opacity: 0.5 }}> (default {fnDef.sharpen.toFixed(2)})</span>
                )}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.01}
              value={sharpen}
              onChange={(e) => setSharpen(parseFloat(e.target.value))}
            />
            <div style={{ fontSize: '0.72rem', opacity: 0.55, lineHeight: 1.4 }}>
              Lower = steeper, more localized peak. Higher = broader, gentler slope.
            </div>
          </div>

          {/* Win-zone overlay toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={showWinZone}
              onChange={(e) => setShowWinZone(e.target.checked)}
            />
            <span style={{ color: 'rgb(80,220,120)' }}>■</span> Highlight winning area
            <span style={{ opacity: 0.5 }}>(value ≤ win threshold)</span>
          </label>

          {/* Center (summit) dot toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={showCenterDot}
              onChange={(e) => setShowCenterDot(e.target.checked)}
            />
            Show center dot
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn--ghost btn--sm" onClick={resetSharpen} disabled={isDefault}>
              ↻ Reset to default
            </button>
            <button className="btn btn--ghost btn--sm" onClick={reroll}>
              {randomMode ? '🎲 Re-roll function' : '🎲 Re-roll transform'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={recenter}>
              ⊙ Re-center
            </button>
          </div>

          {/* Copy-paste snippet for functionProblem.ts */}
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <code>sharpen: {sharpen.toFixed(2)},</code>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigator.clipboard?.writeText(`sharpen: ${sharpen.toFixed(2)},`)}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
