import type {MapConfig, Minimum} from '../types/map.ts';

const DEFAULT_WIN_RADIUS = 0.04;
const DEFAULT_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

/**
 * Encodes a MapConfig into a compact URL-safe base64 string.
 * Format (JSON → base64url):
 * { v: 1, id: string, m: [x, y, isGlobal][], wr: number }
 */
export function encodeMap(config: MapConfig): string {
  const payload = {
    v: 1,
    id: config.id,
    m: config.minima.map((min) => [
      parseFloat(min.position.x.toFixed(4)),
      parseFloat(min.position.y.toFixed(4)),
      min.isGlobal ? 1 : 0,
    ]),
    wr: config.winRadius,
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
      (entry: [number, number, number], idx: number) => ({
        id: `m_${idx}`,
        position: { x: entry[0], y: entry[1] },
        isGlobal: entry[2] === 1,
      })
    );

    return {
      id: payload.id,
      minima,
      bounds: DEFAULT_BOUNDS,
      winRadius: payload.wr ?? DEFAULT_WIN_RADIUS,
      createdAt: payload.t ?? Date.now(),
    };
  } catch {
    throw new Error('Invalid map code');
  }
}

/**
 * Generates a random MapConfig with n minima, one of which is global.
 */
export function generateRandomMap(numMinima: number = 5): MapConfig {
  const globalIndex = Math.floor(Math.random() * numMinima);

  const minima: Minimum[] = Array.from({ length: numMinima }, (_, i) => ({
    id: `m_${i}`,
    position: {
      x: 0.05 + Math.random() * 0.9,
      y: 0.05 + Math.random() * 0.9,
    },
    isGlobal: i === globalIndex,
  }));

  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    minima,
    bounds: DEFAULT_BOUNDS,
    winRadius: DEFAULT_WIN_RADIUS,
    createdAt: Date.now(),
  };
}
