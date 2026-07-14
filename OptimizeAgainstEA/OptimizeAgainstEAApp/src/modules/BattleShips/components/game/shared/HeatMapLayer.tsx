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
     * Value curve exponent applied before colouring.
     * 1.0 = linear  |  <1 = compress highs (more colour near minima)
     * 0.5 gives a square-root curve — good default for topographic feel.
     */
    valueExponent: number;
    /**
     * How far to spread the colours across the surface's own value distribution
     * (0 = off, 1 = full histogram equalisation).
     *
     * A fixed curve colours by value alone, which assumes values are spread
     * evenly across the map — and they aren't. On a dense map nearly all the
     * area sits on the ridges *between* basins, so ~85% of it lands in the top
     * third of the ramp and comes out one flat sheet of orange-red while the
     * whole violet-to-cyan half goes unused. Mixing in each value's quantile
     * rank pulls the crowded band apart and hands the idle colours to it, so
     * every map — 5 minima or 26 — uses the full ramp. Purely cosmetic: it
     * changes no reading and no EA fitness, and it's monotone, so lower still
     * looks lower everywhere.
     */
    colorSpread: number;
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
    resolution:    1080,
    opacity:       0.82,
    revealRadius:  0.05,
    valueExponent: 1.0,
    colorSpread:   0.95,
};

/** Bins used to estimate the surface's value distribution (values are in [0,1]). */
const HIST_BINS = 1024;

interface HeatmapLayerProps {
    evaluate: EvalFn;
    config?: Partial<HeatmapConfig>;
    revealPoints?: Coordinate[];
}

export function HeatmapLayer({ evaluate, config: configOverride, revealPoints }: HeatmapLayerProps) {
    // Resolved field by field: a spread `{...defaults, ...override}` lets an
    // explicitly-undefined key (which is what an absent problem hint looks like)
    // overwrite the default with undefined.
    const cfg: HeatmapConfig = {
        resolution:    configOverride?.resolution    ?? DEFAULT_HEATMAP_CONFIG.resolution,
        opacity:       configOverride?.opacity       ?? DEFAULT_HEATMAP_CONFIG.opacity,
        revealRadius:  configOverride?.revealRadius  ?? DEFAULT_HEATMAP_CONFIG.revealRadius,
        valueExponent: configOverride?.valueExponent ?? DEFAULT_HEATMAP_CONFIG.valueExponent,
        colorSpread:   configOverride?.colorSpread   ?? DEFAULT_HEATMAP_CONFIG.colorSpread,
    };
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Reveal mode is active whenever a points array is supplied (even if empty):
    // an empty array reveals nothing, `undefined` reveals the whole map.
    const hasReveal = revealPoints != null;

    // The coloured surface, computed once per problem. This is the expensive pass
    // — one evaluate() per pixel, and evaluate() itself walks every minimum on the
    // map — so it must not rerun when the player merely places another probe.
    const surface = useMemo(() => {
        const res   = cfg.resolution;
        const count = res * res;

        // Pass 1 — evaluate every pixel, and histogram the values on the way.
        const values = new Float32Array(count);
        const hist   = new Float64Array(HIST_BINS);
        for (let py = 0; py < res; py++) {
            const ny = py / (res - 1);
            for (let px = 0; px < res; px++) {
                const raw = evaluate(px / (res - 1), ny);
                const v   = raw < 0 ? 0 : raw > 1 ? 1 : raw;
                values[py * res + px] = v;
                hist[Math.round(v * (HIST_BINS - 1))]++;
            }
        }

        // Turn the histogram into a rank lookup: rank[bin] = fraction of the map
        // that reads lower than this bin — i.e. where this value sits in the
        // surface's own distribution.
        const rank = new Float64Array(HIST_BINS);
        let cumulative = 0;
        for (let b = 0; b < HIST_BINS; b++) {
            rank[b] = (cumulative + hist[b] / 2) / count;
            cumulative += hist[b];
        }

        // Pass 2 — colour by the blend of the fixed curve and the rank. The rank
        // is read with linear interpolation between bins: sampling it as 1024
        // discrete steps would quantise the ramp and band the gradient, which is
        // exactly the smoothness this is meant to deliver.
        const spread = Math.max(0, Math.min(1, cfg.colorSpread));
        const rgb    = new Uint8ClampedArray(count * 3);
        for (let i = 0; i < count; i++) {
            const v   = values[i];
            const pos = v * (HIST_BINS - 1);
            const b0  = Math.floor(pos);
            const b1  = Math.min(b0 + 1, HIST_BINS - 1);
            const f   = pos - b0;
            const r0  = rank[b0] + (rank[b1] - rank[b0]) * f;

            const curved = Math.pow(v, cfg.valueExponent);
            const t      = curved + (r0 - curved) * spread;
            const [r, g, b] = sampleGradient(t);
            const idx = i * 3;
            rgb[idx]     = r;
            rgb[idx + 1] = g;
            rgb[idx + 2] = b;
        }
        return { rgb, res };
    }, [evaluate, cfg.resolution, cfg.valueExponent, cfg.colorSpread]);

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
