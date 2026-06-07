import { useState, useEffect, useRef, useCallback } from 'react';
import type { Generation } from '../../../types/ea';
import type { MapConfig } from '../../../types/map';
import { sampleGradientRgb } from '../../../engine/colorScale';

interface GenerationReplayOverlayProps {
  generations: Generation[];
  eaMap:       MapConfig;
  onClose:     () => void;
}

export function GenerationReplayOverlay({ generations, eaMap, onClose }: GenerationReplayOverlayProps) {
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
    }, 600);
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

  const gen = generations[index];
  if (!gen) return null;

  const mapId = eaMap.id;
  const best  = gen.best;

  return (
    <div className="replay-backdrop" onClick={onClose}>
      <div className="genreplay-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="replay-header">
          <div className="replay-header__left">
            <span className="replay-phase-tag">Gen {gen.index + 1} / {total}</span>
            <h2 className="replay-headline">EA Population — Map #{mapId}</h2>
          </div>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        <p className="replay-description">
          Best fitness: <strong>{best.fitness.toFixed(5)}</strong> at ({best.position.x.toFixed(3)}, {best.position.y.toFixed(3)}) · Mean: {gen.meanFitness.toFixed(5)}
        </p>

        {/* Map */}
        <div className="genreplay-body">
          <GenerationMap gen={gen} />
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

function GenerationMap({ gen }: { gen: Generation }) {
  const sorted = [...gen.individuals].sort((a, b) => a.fitness - b.fitness);
  const worst  = sorted[sorted.length - 1]?.fitness ?? 1;

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
      </svg>

      {sorted.map((ind, rank) => {
        const isBest  = rank === 0;
        const color   = ind.isSolution ? 'var(--accent)' : sampleGradientRgb(ind.fitness / Math.max(worst, 1e-9));
        const size    = isBest ? 14 : ind.isSolution ? 12 : 9;
        const zIndex  = isBest ? 4 : ind.isSolution ? 3 : 1;

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
              : ind.isSolution
                ? '2px solid var(--accent)'
                : '1px solid rgba(255,255,255,.2)',
            boxShadow: isBest || ind.isSolution ? `0 0 8px ${color}` : 'none',
            transition: 'left 0.45s ease, top 0.45s ease',
            zIndex,
            pointerEvents: 'none',
          }}/>
        );
      })}
    </div>
  );
}