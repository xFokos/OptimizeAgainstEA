/**
 * Maps a value t ∈ [0, 1] to an RGB colour spanning the full visible spectrum.
 *
 * Stop layout (low → high value):
 *   0.00  deep violet   #1a0050
 *   0.20  blue          #0040ff
 *   0.40  cyan          #00e5ff
 *   0.58  green         #00ff60
 *   0.74  yellow        #ffe000
 *   0.88  orange        #ff6000
 *   1.00  deep red      #cc0010
 *
 * The cool half deliberately holds most of the ramp. Because the heatmap spreads
 * colours across each surface's own value distribution, the share of a map
 * painted in a given band ends up close to that band's *span* here — so handing
 * the warm end 40% of the ramp (as an even layout does) drowns a big map in red.
 * Deep red is worth reserving for the last stretch: it should mean "nothing here",
 * not "somewhat far".
 *
 * Adjust the STOPS array to remap colours — no other code needs to change.
 */

interface Stop {
    t: number;
    r: number;
    g: number;
    b: number;
}

const STOPS: Stop[] = [
    { t: 0.00, r:  26, g:   0, b:  80 }, // deep violet
    { t: 0.20, r:   0, g:  64, b: 255 }, // blue
    { t: 0.40, r:   0, g: 229, b: 255 }, // cyan
    { t: 0.58, r:   0, g: 255, b:  96 }, // green
    { t: 0.74, r: 255, g: 224, b:   0 }, // yellow
    { t: 0.88, r: 255, g:  96, b:   0 }, // orange
    { t: 1.00, r: 204, g:   0, b:  16 }, // deep red
];

function lerp(a: number, b: number, s: number): number {
    return a + (b - a) * s;
}

/** Returns [r, g, b] each in 0–255 */
export function sampleGradient(t: number): [number, number, number] {
    const clamped = Math.max(0, Math.min(1, t));

    // Find the two surrounding stops
    let lo = STOPS[0];
    let hi = STOPS[STOPS.length - 1];

    for (let i = 0; i < STOPS.length - 1; i++) {
        if (clamped <= STOPS[i + 1].t) {
            lo = STOPS[i];
            hi = STOPS[i + 1];
            break;
        }
    }

    const span = hi.t - lo.t;
    const s    = span === 0 ? 0 : (clamped - lo.t) / span;

    return [
        Math.round(lerp(lo.r, hi.r, s)),
        Math.round(lerp(lo.g, hi.g, s)),
        Math.round(lerp(lo.b, hi.b, s)),
    ];
}

/** Convenience: returns an SVG/CSS rgb() string */
export function sampleGradientRgb(t: number): string {
    const [r, g, b] = sampleGradient(t);
    return `rgb(${r},${g},${b})`;
}