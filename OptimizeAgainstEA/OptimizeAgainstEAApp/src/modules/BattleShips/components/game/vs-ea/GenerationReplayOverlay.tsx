import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Generation } from '../../../types/ea';
import { sampleGradientRgb } from '../../../engine/colorScale';
import { valueToHeight } from '../../../engine/height';
import { DOT_MOVE_DURATION, DOT_MOVE_DURATION_MS } from './replay/ReplayMap';

/**
 * Time each frame stays on screen during autoplay. Must be ≥ the dot glide
 * time so dots fully reach their new positions before the next frame starts;
 * the extra buffer gives a brief pause to read each generation.
 */
const AUTOPLAY_FRAME_MS = DOT_MOVE_DURATION_MS + 300;

/** Rasterization resolution for the win-area overlay (cells per axis). Rows are
 *  run-length merged into rectangles, so this can be fairly fine without a huge
 *  element count. */
const WIN_RASTER = 500;

/** A horizontal run of winning cells on one raster row (viewBox 0–100 units). */
interface WinRun { x: number; y: number; w: number; h: number; }

/**
 * Rasterizes the win region of *any* shape into horizontal rectangle runs, so
 * the replay can shade the exact area that counts as solved — a circle for
 * hand-built maps, or an arbitrary blob for benchmark/procedural functions
 * (whose win zone is value-based, not a radius). Shape-agnostic by construction.
 */
function computeWinRuns(isWin: (x: number, y: number) => boolean): WinRun[] {
  const cell = 100 / WIN_RASTER;
  // A hairline height overlap (a small fraction of a cell) closes anti-aliasing
  // seams between vertically-adjacent rows without visibly bloating the shape.
  // Width needs none — a run is already one contiguous rect within its row.
  const seam = cell * 0.08;
  const runs: WinRun[] = [];
  for (let j = 0; j < WIN_RASTER; j++) {
    const y = (j + 0.5) / WIN_RASTER;
    let start = -1;
    for (let i = 0; i <= WIN_RASTER; i++) {
      const inside = i < WIN_RASTER && isWin((i + 0.5) / WIN_RASTER, y);
      if (inside && start < 0) {
        start = i;
      } else if (!inside && start >= 0) {
        runs.push({ x: start * cell, y: j * cell, w: (i - start) * cell, h: cell + seam });
        start = -1;
      }
    }
  }
  return runs;
}

interface GenerationReplayOverlayProps {
  generations: Generation[];
  label:       string;
  /** Shape-agnostic win test for the loaded problem — used to shade the win area. */
  isWin:       (x: number, y: number) => boolean;
  /** Only reveal the win area + highlight solved probes once someone has won. */
  revealWin:   boolean;
  onClose:     () => void;
}

export function GenerationReplayOverlay({ generations, label, isWin, revealWin, onClose }: GenerationReplayOverlayProps) {
  const [index,     setIndex]     = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total   = generations.length;
  const isFirst = index === 0;
  const isLast  = index === total - 1;

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)),         []);
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, total - 1))), [total]);

  const play = useCallback(() => {
    stopInterval();
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) {
          stopInterval();
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, AUTOPLAY_FRAME_MS);
  }, [total, stopInterval]);

  const pause = useCallback(() => {
    stopInterval();
    setIsPlaying(false);
  }, [stopInterval]);

  useEffect(() => {
    if (isLast && isPlaying) {
      stopInterval();
      setIsPlaying(false);
    }
  }, [isLast, isPlaying, stopInterval]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  // The win area only depends on the problem, so rasterize it once — and only
  // when it's actually going to be shown (after someone wins).
  const winRuns = useMemo(() => (revealWin ? computeWinRuns(isWin) : []), [revealWin, isWin]);

  const gen = generations[index];
  if (!gen) return null;

  const best  = gen.best;

  return (
    <div className="replay-backdrop" onClick={onClose}>
      <div className="genreplay-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="replay-header">
          <div className="replay-header__left">
            <span className="replay-phase-tag">Gen {gen.index + 1} / {total}</span>
            <h2 className="replay-headline">EA Population — {label}</h2>
          </div>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        <p className="replay-description">
          Best height: <strong>{valueToHeight(best.fitness).toFixed(5)}</strong> at ({best.position.x.toFixed(3)}, {best.position.y.toFixed(3)}) · Mean: {valueToHeight(gen.meanFitness).toFixed(5)}
        </p>

        {/* Map */}
        <div className="genreplay-body">
          <GenerationMap gen={gen} winRuns={winRuns} revealWin={revealWin} />
        </div>

        {/* Controls */}
        <div className="replay-controls">
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(0)}      disabled={isFirst}>⏮</button>
          <button className="btn btn--ghost btn--sm" onClick={prev}               disabled={isFirst}>◀</button>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => isPlaying ? pause() : play()}
            style={{ minWidth: 64 }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={next}               disabled={isLast}>▶</button>
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(total - 1)} disabled={isLast}>⏭</button>

          <div className="replay-progress">
            <div
              className="replay-progress__fill"
              style={{ width: `${(index / Math.max(total - 1, 1)) * 100}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function GenerationMap({ gen, winRuns, revealWin }: { gen: Generation; winRuns: WinRun[]; revealWin: boolean }) {
  const sorted = [...gen.individuals].sort((a, b) => a.fitness - b.fitness);
  const worst  = sorted[sorted.length - 1]?.fitness ?? 1;

  // Solved probes (inside the win zone) are only surfaced once the race is
  // decided — otherwise the replay would give away where the summit is.
  const solutionCount = sorted.filter((ind) => ind.isSolution).length;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '1 / 1',
      background: 'var(--map-bg)',
      border: '1px solid var(--map-border)',
      overflow: 'hidden',
      borderRadius: 4,
    }}>
      {/* Grid */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[10,20,30,40,50,60,70,80,90].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,.04)" strokeWidth=".3"/>
            <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,.04)" strokeWidth=".3"/>
          </g>
        ))}

        {/* Win area — the exact region that counts as solved, shaded to match
            its true shape (a circle for maps, an arbitrary blob for functions).
            Only revealed once the race is over, so it doesn't spoil the summit. */}
        {revealWin && winRuns.map((r, i) => (
          <rect
            key={i}
            x={r.x} y={r.y} width={r.w} height={r.h}
            fill="var(--accent)"
            fillOpacity={0.4}
          />
        ))}
      </svg>

      {/* Count badge — how many probes are currently inside the win area */}
      {revealWin && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          background: 'rgba(0,0,0,.45)',
          border: '1px solid var(--accent)',
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          {solutionCount} in win area
        </div>
      )}

      {sorted.map((ind, rank) => {
        const isBest  = rank === 0;
        // Solved probes only get the accent highlight once the win is revealed.
        const solved  = revealWin && ind.isSolution;
        const color   = solved ? 'var(--accent)' : sampleGradientRgb(ind.fitness / Math.max(worst, 1e-9));
        const size    = isBest ? 14 : solved ? 12 : 9;
        const zIndex  = isBest ? 4 : solved ? 3 : 1;

        return (
          <div key={rank} style={{
            position:  'absolute',
            left:      `${ind.position.x * 100}%`,
            top:       `${ind.position.y * 100}%`,
            transform: 'translate(-50%,-50%)',
            width:  size,
            height: size,
            borderRadius: '50%',
            background: color,
            border: isBest
              ? '2px solid #fff'
              : solved
                ? '2px solid var(--accent)'
                : '1px solid rgba(255,255,255,.2)',
            boxShadow: isBest || solved ? `0 0 8px ${color}` : 'none',
            transition: `left ${DOT_MOVE_DURATION} ease, top ${DOT_MOVE_DURATION} ease`,
            zIndex,
            pointerEvents: 'none',
          }}/>
        );
      })}
    </div>
  );
}