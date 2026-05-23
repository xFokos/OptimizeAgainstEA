import React, { useRef, useCallback, useState } from 'react';
import type { Coordinate, Minimum } from '../../../types/map.ts';
import {type ContourConfig, ContourLayer} from "./ContourLayer.tsx";
import {type HeatmapConfig, HeatmapLayer} from "./HeatMapPlayer.tsx";

type EvalFn = (x: number, y: number) => number;
export type VizMode = 'contour' | 'heatmap';

interface GameMapProps {
    minima?: Minimum[];
    showMinima?: boolean;
    evaluateFn?: EvalFn;
    /** Starting visualization mode. Defaults to 'contour'. */
    defaultVizMode?: VizMode;
    contourConfig?: Partial<ContourConfig>;
    heatmapConfig?: Partial<HeatmapConfig>;
    revealPoints?: Coordinate[];
    exclusionRadius?: number;
    highlightGlobal?: boolean;
    onMapClick?: (coord: Coordinate) => void;
    onMinimumClick?: (id: string) => void;
    selectedId?: string | null;
    overlayLabel?: string;
    className?: string;
    children?: React.ReactNode;
}

export function GameMap({
                            minima = [],
                            showMinima = false,
                            evaluateFn,
                            defaultVizMode = 'contour',
                            contourConfig,
                            heatmapConfig,
                            revealPoints,
                            exclusionRadius,
                            highlightGlobal = false,
                            onMapClick,
                            onMinimumClick,
                            selectedId,
                            overlayLabel,
                            className = '',
                            children,
                        }: GameMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [vizMode, setVizMode] = useState<VizMode>(defaultVizMode);

    const toNormalized = useCallback((e: React.MouseEvent): Coordinate => {
        const rect = containerRef.current!.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    }, []);

    const handleMapClick = useCallback(
        (e: React.MouseEvent) => {
            if (!onMapClick) return;
            if ((e.target as HTMLElement).dataset.minimum) return;
            onMapClick(toNormalized(e));
        },
        [onMapClick, toNormalized]
    );

    const ringR = exclusionRadius != null ? exclusionRadius * 100 : null;

    return (
        <div
            ref={containerRef}
            onClick={handleMapClick}
            className={`game-map ${className}`}
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                background: 'var(--map-bg)',
                border: '1px solid var(--map-border)',
                cursor: onMapClick ? 'crosshair' : 'default',
                overflow: 'hidden',
                userSelect: 'none',
            }}
        >
            {/* ── Visualization layer ── */}
            {evaluateFn && vizMode === 'contour' && (
                <ContourLayer
                    evaluate={evaluateFn}
                    config={contourConfig}
                    revealPoints={revealPoints}
                />
            )}
            {evaluateFn && vizMode === 'heatmap' && (
                <HeatmapLayer
                    evaluate={evaluateFn}
                    config={heatmapConfig}
                    revealPoints={revealPoints}
                />
            )}

            {/* ── Grid + exclusion rings ── */}
            <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
                    <React.Fragment key={v}>
                        <line x1={v} y1={0} x2={v} y2={100} stroke="var(--map-grid)" strokeWidth="0.3" />
                        <line x1={0} y1={v} x2={100} y2={v} stroke="var(--map-grid)" strokeWidth="0.3" />
                    </React.Fragment>
                ))}

                {showMinima && ringR != null &&
                    minima.map((m) => (
                        <circle
                            key={`ring-${m.id}`}
                            cx={m.position.x * 100}
                            cy={m.position.y * 100}
                            r={ringR}
                            fill="rgba(74,144,240,0.04)"
                            stroke="rgba(74,144,240,0.18)"
                            strokeWidth="0.4"
                            strokeDasharray="2 2"
                        />
                    ))
                }
            </svg>

            {/* ── Minima dots ── */}
            {showMinima &&
                minima.map((m) => {
                    const isSelected = m.id === selectedId;
                    const isGlobal   = m.isGlobal && highlightGlobal;
                    return (
                        <div
                            key={m.id}
                            data-minimum="true"
                            onClick={(e) => { e.stopPropagation(); onMinimumClick?.(m.id); }}
                            style={{
                                position: 'absolute',
                                left: `${m.position.x * 100}%`,
                                top:  `${m.position.y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                width:  isGlobal ? 18 : 12,
                                height: isGlobal ? 18 : 12,
                                borderRadius: '50%',
                                background: isGlobal
                                    ? 'var(--accent-global)'
                                    : isSelected
                                        ? 'var(--accent-selected)'
                                        : 'var(--accent-min)',
                                border: isSelected
                                    ? '2px solid var(--accent-selected-border)'
                                    : '2px solid var(--map-dot-border)',
                                boxShadow: isGlobal
                                    ? '0 0 12px var(--accent-global-glow)'
                                    : isSelected
                                        ? '0 0 8px var(--accent-selected-glow)'
                                        : 'none',
                                cursor: onMinimumClick ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                                zIndex: isGlobal ? 3 : isSelected ? 2 : 1,
                            }}
                        />
                    );
                })}

            {/* ── Overlay label ── */}
            {overlayLabel && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--map-overlay-text)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.08em',
                    pointerEvents: 'none',
                    fontFamily: 'var(--font-mono)',
                }}>
                    {overlayLabel}
                </div>
            )}

            {/* ── Viz toggle button — only shown when evaluateFn is present ── */}
            {evaluateFn && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setVizMode((m) => m === 'contour' ? 'heatmap' : 'contour');
                    }}
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        zIndex: 10,
                        padding: '3px 8px',
                        background: 'rgba(13,15,18,0.82)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 3,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        letterSpacing: '0.06em',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        backdropFilter: 'blur(4px)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                    {vizMode === 'contour' ? 'HEATMAP' : 'CONTOUR'}
                </button>
            )}

            {children}
        </div>
    );
}