import { useRef, useEffect, useMemo } from 'react';
import type { Coordinate } from '../../../types/map';
import { sampleGradient } from '../../../engine/colorScale.ts';

type EvalFn = (x: number, y: number) => number;

// ─────────────────────────────────────────────────────────────
// HEATMAP CONFIG — adjust these freely
// ─────────────────────────────────────────────────────────────
export interface HeatmapConfig {
    /** Canvas resolution in pixels — higher = sharper but slower */
    resolution: number;
    /** Overall opacity of the heatmap layer (0–1) */
    opacity: number;
    /** Reveal radius around each probe (normalized 0–1). 0 = full reveal */
    revealRadius: number;
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
    resolution:   1080,
    opacity:      0.82,
    revealRadius: 0.05,
};

interface HeatmapLayerProps {
    evaluate: EvalFn;
    config?: Partial<HeatmapConfig>;
    revealPoints?: Coordinate[];
}

/**
 * Paints a problem's surface.
 *
 * The value goes straight to the colour ramp — no curve, no rescaling, no
 * spreading it across the surface's own distribution. Every problem already
 * returns a [0,1] value designed to run through the ramp (a map by its basin
 * scale, a benchmark by its own normalisation), so re-tuning it here would only
 * fight the engine that produced it: a display curve that flatters a map's cones
 * mangles Rastrigin's ripples, and colouring by rank makes a basin's size depend
 * on how many other basins share the board.
 */
export function HeatmapLayer({ evaluate, config: configOverride, revealPoints }: HeatmapLayerProps) {
    const cfg: HeatmapConfig = {
        resolution:   configOverride?.resolution   ?? DEFAULT_HEATMAP_CONFIG.resolution,
        opacity:      configOverride?.opacity      ?? DEFAULT_HEATMAP_CONFIG.opacity,
        revealRadius: configOverride?.revealRadius ?? DEFAULT_HEATMAP_CONFIG.revealRadius,
    };
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Reveal mode is active whenever a points array is supplied (even if empty):
    // an empty array reveals nothing, `undefined` reveals the whole map.
    const hasReveal = revealPoints != null;

    // The coloured surface, computed once per problem. This is the expensive pass
    // — one evaluate() per pixel, and evaluate() itself walks every minimum on the
    // map — so it must not rerun when the player merely places another probe.
    const surface = useMemo(() => {
        const res = cfg.resolution;
        const rgb = new Uint8ClampedArray(res * res * 3);
        for (let py = 0; py < res; py++) {
            const ny = py / (res - 1);
            for (let px = 0; px < res; px++) {
                const raw = evaluate(px / (res - 1), ny);
                const v   = raw < 0 ? 0 : raw > 1 ? 1 : raw;
                const [r, g, b] = sampleGradient(v);
                const idx = (py * res + px) * 3;
                rgb[idx]     = r;
                rgb[idx + 1] = g;
                rgb[idx + 2] = b;
            }
        }
        return { rgb, res };
    }, [evaluate, cfg.resolution]);

    // Paint the cached surface through the reveal mask. Only the pixels inside a
    // probe's circle are touched — the rest stay transparent — so re-revealing on
    // every probe costs a few thousand writes instead of a full re-evaluation.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { rgb, res } = surface;
        canvas.width  = res;
        canvas.height = res;

        const imgData = ctx.createImageData(res, res);
        const data    = imgData.data;

        const writePixel = (idx: number) => {
            const s = idx * 3;
            const d = idx * 4;
            data[d]     = rgb[s];
            data[d + 1] = rgb[s + 1];
            data[d + 2] = rgb[s + 2];
            data[d + 3] = 255;
        };

        if (!hasReveal) {
            for (let i = 0; i < res * res; i++) writePixel(i);
        } else {
            const rPx = cfg.revealRadius * (res - 1);
            const r2  = rPx * rPx;
            for (const pt of revealPoints!) {
                const cx = pt.x * (res - 1);
                const cy = pt.y * (res - 1);
                const x0 = Math.max(0, Math.floor(cx - rPx));
                const x1 = Math.min(res - 1, Math.ceil(cx + rPx));
                const y0 = Math.max(0, Math.floor(cy - rPx));
                const y1 = Math.min(res - 1, Math.ceil(cy + rPx));
                for (let py = y0; py <= y1; py++) {
                    const dy = py - cy;
                    for (let px = x0; px <= x1; px++) {
                        const dx = px - cx;
                        if (dx * dx + dy * dy <= r2) writePixel(py * res + px);
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surface, hasReveal, cfg.revealRadius,
        revealPoints?.map(p => `${p.x},${p.y}`).join('|')]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                opacity: cfg.opacity,
                imageRendering: 'auto',
            }}
        />
    );
}
