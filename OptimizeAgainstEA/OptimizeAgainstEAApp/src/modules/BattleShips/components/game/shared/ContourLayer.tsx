import { useMemo } from 'react';
import { buildContours } from '../../../engine/contours';
import type { Coordinate } from '../../../types/map.ts';

type EvalFn = (x: number, y: number) => number;

// ─────────────────────────────────────────────────────────────
// CONTOUR CONFIG — adjust these to change the line distribution
// ─────────────────────────────────────────────────────────────
export interface ContourConfig {
    /** Number of contour lines to generate */
    lineCount: number;
    /**
     * Spacing curve exponent.
     * 1.0 = linear spacing (uniform)
     * 2–4 = power curve (denser near minima at low values)
     * Use values between 1.5 and 3 for a natural topographic feel.
     */
    spacingExponent: number;
    /** Grid resolution for marching squares — higher = smoother lines */
    resolution: number;
    /** Radius of the reveal window around each probe (normalized 0–1) */
    revealRadius: number;
}

export const DEFAULT_CONTOUR_CONFIG: ContourConfig = {
    lineCount:       24,
    spacingExponent: 1,
    resolution:      100,
    revealRadius:    0.1,
};

/** Generates levels densely packed near 0, sparse near 1 */
function buildLevels(count: number, exponent: number): number[] {
    return Array.from({ length: count }, (_, i) => {
        const t = (i + 1) / (count + 1); // skip 0 and 1 themselves
        return parseFloat((1 - Math.pow(1 - t, 1 / exponent)).toFixed(4));
    });
}

const LABEL_TARGETS = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const MAJOR_THRESHOLD = 0.06; // levels within this of a label target get a label

function levelToColor(t: number): string {
  const lerp = (a: number, b: number, s: number) => Math.round(a + (b - a) * s);
  if (t < 0.5) {
    const s = t / 0.5;
    return `rgb(${lerp(0, 255, s)},${lerp(80, 220, s)},${lerp(255, 0, s)})`;
  } else {
    const s = (t - 0.5) / 0.5;
    return `rgb(${lerp(255, 180, s)},${lerp(220, 0, s)},${lerp(0, 0, s)})`;
  }
}

function isMajorLevel(level: number): boolean {
    return LABEL_TARGETS.some((t) => Math.abs(t - level) < MAJOR_THRESHOLD);
}

interface ContourLayerProps {
    evaluate: EvalFn;
    config?: Partial<ContourConfig>;
    revealPoints?: Coordinate[];
}

export function ContourLayer({
                                 evaluate,
                                 config: configOverride,
                                 revealPoints,
                             }: ContourLayerProps) {
    const cfg = { ...DEFAULT_CONTOUR_CONFIG, ...configOverride };
    const levels = useMemo(
        () => buildLevels(cfg.lineCount, cfg.spacingExponent),
        [cfg.lineCount, cfg.spacingExponent]
    );

    const contours = useMemo(
        () => buildContours(evaluate, levels, cfg.resolution),
        [evaluate, levels, cfg.resolution]
    );

    const hasReveal = revealPoints && revealPoints.length > 0;
    const clipId = useMemo(() => `cl-${Math.random().toString(36).slice(2, 7)}`, []);
    const rSvg = cfg.revealRadius * 100;

    return (
        <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
            {hasReveal && (
                <defs>
                    <clipPath id={clipId}>
                        {revealPoints!.map((pt, i) => (
                            <circle key={i} cx={pt.x * 100} cy={pt.y * 100} r={rSvg} />
                        ))}
                    </clipPath>
                </defs>
            )}

            <g clipPath={hasReveal ? `url(#${clipId})` : undefined}>
                {contours.map(({ level, segments }) => {
                    const major   = isMajorLevel(level);
                    const color   = levelToColor(Math.pow(level, 0.3));
                    const opacity = major ? 0.85 : 0.38;
                    const width   = major ? 0.6  : 0.25;

                    return (
                        <g key={level}>
                            {segments.map((seg, i) => (
                                <line
                                    key={i}
                                    x1={seg.x1 * 100} y1={seg.y1 * 100}
                                    x2={seg.x2 * 100} y2={seg.y2 * 100}
                                    stroke={color}
                                    strokeWidth={width}
                                    strokeOpacity={opacity}
                                    strokeLinecap="round"
                                />
                            ))}

                            {major && (() => {
                                const long = segments.find(
                                    (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.015
                                );
                                if (!long) return null;
                                const mx = ((long.x1 + long.x2) / 2) * 100;
                                const my = ((long.y1 + long.y2) / 2) * 100;
                                if (mx < 3 || mx > 97 || my < 3 || my > 97) return null;
                                return (
                                    <text
                                        key="lbl"
                                        x={mx} y={my}
                                        fontSize="2.6"
                                        fill={color}
                                        fillOpacity={0.95}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontFamily="monospace"
                                        style={{ userSelect: 'none' }}
                                    >
                                        {level.toFixed(2)}
                                    </text>
                                );
                            })()}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}