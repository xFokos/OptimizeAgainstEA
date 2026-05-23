import type {MapConfig, ProblemInstance} from '../types/map.ts';
import { euclideanDistance, isWithinRadius } from './geometry';

/**
 * Converts a MapConfig into a ProblemInstance.
 * The value returned at (x, y) is based on the distance to the closest minimum.
 * The global minimum has a steeper, more distinct well so it "feels" different.
 *
 * Lower value = closer to a minimum (0 = exactly on it).
 * This makes the game feel like minimizing a function.
 */
export function createMapProblem(config: MapConfig): ProblemInstance {
  const globalMin = config.minima.find((m) => m.isGlobal);

  const evaluate = (x: number, y: number): number => {
    if (config.minima.length === 0) return 1;

    let minVal = Infinity;

    for (const minimum of config.minima) {
      const dist = euclideanDistance({ x, y }, minimum.position);

      // Global minimum has a sharper, deeper well (×0.6 scaling factor)
      const floor = minimum.isGlobal ? 0.0 : 0.1;
      const val = dist + floor;

      if (val < minVal) minVal = val;
    }

    // Normalize to roughly 0–1 range (diagonal of unit square is ~1.41)
    return Math.min(minVal / 1.41, 1);
  };

  const isWin = (x: number, y: number): boolean => {
    if (!globalMin) return false;
    return isWithinRadius({ x, y }, globalMin.position, config.winRadius);
  };

  return {
    evaluate,
    bounds: config.bounds,
    isWin,
    metadata: {
      name: `Map ${config.id}`,
      globalMinimum: globalMin
        ? {
            x: globalMin.position.x,
            y: globalMin.position.y,
            value: 0,
          }
        : undefined,
    },
  };
}
