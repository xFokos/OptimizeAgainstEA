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
    /**
     * Display-only colour curve: the pixel is coloured by `pow(value, this)`.
     * 1 = identity (the value goes straight to the ramp — the default, and what
     * surface maps use). Below 1 compresses the highs so more colour lands near
     * the optimum; benchmark functions pass 0.55 here (via their
     * `ProblemInstance.displayExponent`) to keep the look they had before the
     * old global heatmap curve was removed. Never affects readings, wins, or the
     * EA — it only changes what this canvas paints.
     */
    valueExponent: number;
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
    resolution:    1080,
    opacity:       0.82,
    revealRadius:  0.05,
    valueExponent: 1,
};

interface HeatmapLayerProps {
    evaluate: EvalFn;
    config?: Partial<HeatmapConfig>;
    revealPoints?: Coordinate[];
}

/**
 * Paints a problem's surface.
 *
 * By default the value goes straight to the colour ramp — no rescaling, no
 * spreading it across the surface's own distribution. Surface maps already
 * return a [0,1] value shaped by their basin scale, so re-tuning it here would
 * only fight the engine that produced it, and colouring by rank would make a
 * basin's size depend on how many other basins share the board.
 *
 * The one knob is `valueExponent` (default 1 = identity): a per-problem, display
 * -only curve of `pow(value, exponent)`. Benchmark functions pass 0.55 through it
 * to keep the look they had when the heatmap curved every problem — cosmetic
 * only, and opt-in, so it never touches a map.
 */
export function HeatmapLayer({ evaluate, config: configOverride, revealPoints }: HeatmapLayerProps) {
    const cfg: HeatmapConfig = {
        resolution:    configOverride?.resolution    ?? DEFAULT_HEATMAP_CONFIG.resolution,
        opacity:       configOverride?.opacity       ?? DEFAULT_HEATMAP_CONFIG.opacity,
        revealRadius:  configOverride?.revealRadius  ?? DEFAULT_HEATMAP_CONFIG.revealRadius,
        valueExponent: configOverride?.valueExponent ?? DEFAULT_HEATMAP_CONFIG.valueExponent,
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
        const exp = cfg.valueExponent;
        const rgb = new Uint8ClampedArray(res * res * 3);
        for (let py = 0; py < res; py++) {
            const ny = py / (res - 1);
            for (let px = 0; px < res; px++) {
                const raw = evaluate(px / (res - 1), ny);
                const c   = raw < 0 ? 0 : raw > 1 ? 1 : raw;
                // Display-only curve; exp === 1 leaves the value untouched.
                const v   = exp === 1 ? c : Math.pow(c, exp);
                const [r, g, b] = sampleGradient(v);
                const idx = (py * res + px) * 3;
                rgb[idx]     = r;
                rgb[idx + 1] = g;
                rgb[idx + 2] = b;
            }
        }
        return { rgb, res };
    }, [evaluate, cfg.resolution, cfg.valueExponent]);

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
