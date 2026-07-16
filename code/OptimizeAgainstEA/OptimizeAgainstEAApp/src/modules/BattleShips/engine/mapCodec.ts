import type {MapConfig, Minimum} from '../types/map.ts';

const DEFAULT_WIN_RADIUS = 0.04;
const DEFAULT_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

/**
 * Encodes a MapConfig into a compact URL-safe base64 string.
 * Format (JSON → base64url):
 * { v: 1, id: string, m: [x, y, isGlobal, floor?][], wr: number }
 *
 * The 4th tuple entry (floor) is only present for local minima with an
 * explicit floor; omitting it keeps older codes valid and round-trips
 * untouched (random-floor) nodes unchanged.
 */
export function encodeMap(config: MapConfig): string {
  const payload = {
    v: 1,
    id: config.id,
    m: config.minima.map((min) => {
      const entry = [
        parseFloat(min.position.x.toFixed(4)),
        parseFloat(min.position.y.toFixed(4)),
        min.isGlobal ? 1 : 0,
      ];
      if (!min.isGlobal && min.floor !== undefined) {
        entry.push(parseFloat(min.floor.toFixed(4)));
      }
      return entry;
    }),
    wr: config.winRadius,
    ...(config.basinScale !== undefined ? { bs: config.basinScale } : {}),
    t: config.createdAt,
  };

  const json = JSON.stringify(payload);
  const base64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64;
}

/**
 * Decodes a base64 map code back into a MapConfig.
 * Throws if the code is invalid.
 */
export function decodeMap(code: string): MapConfig {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload = JSON.parse(json);

    if (payload.v !== 1) throw new Error('Unknown version');

    const minima: Minimum[] = payload.m.map(
      (entry: [number, number, number, number?], idx: number) => ({
        id: `m_${idx}`,
        position: { x: entry[0], y: entry[1] },
        isGlobal: entry[2] === 1,
        ...(entry.length > 3 && entry[3] !== undefined ? { floor: entry[3] } : {}),
      })
    );

    return {
      id: payload.id,
      minima,
      bounds: DEFAULT_BOUNDS,
      winRadius: payload.wr ?? DEFAULT_WIN_RADIUS,
      // Codes minted before basins had a fixed size carry no `bs`; they were all
      // small, sparse maps, so the Medium scale reproduces how they used to look.
      basinScale: payload.bs ?? MAP_SIZES[DEFAULT_MAP_SIZE].basinScale,
      createdAt: payload.t ?? Date.now(),
    };
  } catch {
    throw new Error('Invalid map code');
  }
}

// ── Map sizes ─────────────────────────────────────────────────────────────
//
// The play area is always the same normalized [0,1] square, so what makes a map
// "big" is how much there is to search in it: more minima (more terrain, more
// decoys) and a tighter summit to actually land on. The surface auto-normalises
// its value range per map (see createMapProblem), so denser maps still use the
// full colour ramp.

export type MapSizeId = 'small' | 'medium' | 'large' | 'huge';

export interface MapSizePreset {
  id: MapSizeId;
  label: string;
  /** Inclusive range of minima placed on a random map of this size. */
  minima: [number, number];
  /** Win radius, normalized — shrinks as maps grow, so a big map stays a hunt. */
  winRadius: number;
  /** Closest two minima may be placed (normalized), keeping cones distinguishable. */
  minSpacing: number;
  /**
   * How wide one basin is (normalized distance to the middle of the value range).
   * The size of a mountain is fixed here, by the map's size — it does not depend
   * on how many other mountains share the map. Kept a little under `minSpacing`
   * so neighbouring basins stay legible as separate features.
   */
  basinScale: number;
}

export const MAP_SIZES: Record<MapSizeId, MapSizePreset> = {
  small:  { id: 'small',  label: 'Small',  minima: [4, 6],   winRadius: 0.05,  minSpacing: 0.20,  basinScale: 0.18 },
  medium: { id: 'medium', label: 'Medium', minima: [8, 11],  winRadius: 0.04,  minSpacing: 0.13,  basinScale: 0.12 },
  large:  { id: 'large',  label: 'Large',  minima: [13, 17], winRadius: 0.03,  minSpacing: 0.10,  basinScale: 0.09 },
  huge:   { id: 'huge',   label: 'Huge',   minima: [20, 26], winRadius: 0.022, minSpacing: 0.075, basinScale: 0.068 },
};

export const MAP_SIZE_IDS: MapSizeId[] = ['small', 'medium', 'large', 'huge'];

export const DEFAULT_MAP_SIZE: MapSizeId = 'medium';

/**
 * Generates a random MapConfig of the given size, one minimum of which is global.
 *
 * Minima are placed by rejection sampling against the size's `minSpacing`, so a
 * dense map still reads as distinct basins instead of one merged blob. If the
 * sampler can't fit the full count (unlucky layout), it settles for what it got
 * rather than looping forever.
 */
export function generateRandomMap(size: MapSizeId = DEFAULT_MAP_SIZE): MapConfig {
  const preset = MAP_SIZES[size] ?? MAP_SIZES[DEFAULT_MAP_SIZE];
  const [lo, hi] = preset.minima;
  const target = lo + Math.floor(Math.random() * (hi - lo + 1));

  const positions: { x: number; y: number }[] = [];
  const maxAttempts = target * 200;
  for (let attempt = 0; attempt < maxAttempts && positions.length < target; attempt++) {
    const candidate = {
      x: 0.05 + Math.random() * 0.9,
      y: 0.05 + Math.random() * 0.9,
    };
    const tooClose = positions.some((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < preset.minSpacing);
    if (!tooClose) positions.push(candidate);
  }

  const globalIndex = Math.floor(Math.random() * positions.length);
  const minima: Minimum[] = positions.map((position, i) => ({
    id: `m_${i}`,
    position,
    isGlobal: i === globalIndex,
  }));

  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    minima,
    bounds: DEFAULT_BOUNDS,
    winRadius: preset.winRadius,
    basinScale: preset.basinScale,
    createdAt: Date.now(),
  };
}
