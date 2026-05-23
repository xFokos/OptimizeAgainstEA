import { useRef, useEffect} from 'react';
import type { Coordinate } from '../../../types/map.ts';

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
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
    resolution:    1000,
    opacity:       1,
    revealRadius:  0.1,
    valueExponent: 0.3,
};

/** Maps a curved value [0,1] to an RGBA colour */
function valueToRgba(v: number): [number, number, number, number] {
  const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
  let r: number, g: number, b: number;
  if (v < 0.5) {
    const s = v / 0.5;
    r = lerp(0,   255, s);
    g = lerp(80,  220, s);
    b = lerp(255, 0,   s);
  } else {
    const s = (v - 0.5) / 0.5;
    r = lerp(255, 180, s);
    g = lerp(220, 0,   s);
    b = lerp(0,   0,   s);
  }
  return [r, g, b, 255];
}

interface HeatmapLayerProps {
    evaluate: EvalFn;
    config?: Partial<HeatmapConfig>;
    revealPoints?: Coordinate[];
}

export function HeatmapLayer({ evaluate, config: configOverride, revealPoints }: HeatmapLayerProps) {
    const cfg = { ...DEFAULT_HEATMAP_CONFIG, ...configOverride };
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hasReveal = revealPoints && revealPoints.length > 0;
    const revealR2  = (cfg.revealRadius) ** 2; // squared, in normalized space

    // Recompute whenever evaluate or config changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const res = cfg.resolution;
        canvas.width  = res;
        canvas.height = res;

        const imgData = ctx.createImageData(res, res);
        const data    = imgData.data;

        for (let py = 0; py < res; py++) {
            const ny = py / (res - 1); // normalized y
            for (let px = 0; px < res; px++) {
                const nx = px / (res - 1); // normalized x

                // Reveal mask — skip pixel if not inside any reveal circle
                if (hasReveal) {
                    const inside = revealPoints!.some((pt) => {
                        const dx = pt.x - nx;
                        const dy = pt.y - ny;
                        return dx * dx + dy * dy <= revealR2;
                    });
                    if (!inside) continue; // leave transparent
                }

                const raw    = evaluate(nx, ny);
                const curved = Math.pow(Math.max(0, Math.min(1, raw)), cfg.valueExponent);
                const [r, g, b, a] = valueToRgba(curved);

                const idx = (py * res + px) * 4;
                data[idx]     = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evaluate, cfg.resolution, cfg.valueExponent, hasReveal,
        revealPoints?.map(p => `${p.x},${p.y}`).join('|'), cfg.revealRadius]);

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