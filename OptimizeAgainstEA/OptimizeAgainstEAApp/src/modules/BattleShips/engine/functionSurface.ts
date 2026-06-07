import type { MapConfig, ProblemInstance } from '../types/map';
import { euclideanDistance, isWithinRadius } from './geometry';

/**
 * Controls how fast values rise with distance from a minimum.
 *
 * The raw distance is divided by DISTANCE_SCALE before clamping to [0, 1].
 * Lower  = values rise faster (reach 1.0 closer to the minimum)
 * Higher = values rise slower (map feels flatter)
 *
 * With a 480px map and typical minima spacing, a value of 0.25 means
 * a probe ~¼ of the map width away from all minima already reads ≈ 1.0.
 */
const DISTANCE_SCALE = 0.7;

/**
 * Range for the randomised floor applied to each local minimum.
 * Each local minimum gets a random floor in [MIN, MAX] assigned once
 * at problem-creation time, seeded from the minimum's position so the
 * same map code always produces the same floors.
 *
 * LOCAL_MIN_FLOOR_MIN — closest a local min can feel to the global (more deceptive)
 * LOCAL_MIN_FLOOR_MAX — furthest a local min can feel from the global (easier to dismiss)
 */
const LOCAL_MIN_FLOOR_MIN = 0.03;
const LOCAL_MIN_FLOOR_MAX = 0.1;

/** Cheap deterministic hash into [0, 1) — seeds per-minimum randomness from position */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createMapProblem(config: MapConfig): ProblemInstance {
  const globalMin = config.minima.find((m) => m.isGlobal);

  // Assign a stable random floor to each local minimum, seeded from its position
  const floorMap = new Map<string, number>();
  for (const minimum of config.minima) {
    if (!minimum.isGlobal) {
      const seed  = minimum.position.x * 1000 + minimum.position.y;
      const t     = pseudoRandom(seed);
      const floor = LOCAL_MIN_FLOOR_MIN + t * (LOCAL_MIN_FLOOR_MAX - LOCAL_MIN_FLOOR_MIN);
      floorMap.set(minimum.id, floor);
    }
  }

  const evaluate = (x: number, y: number): number => {
    if (config.minima.length === 0) return 1;

    let minVal = Infinity;

    for (const minimum of config.minima) {
      const dist  = euclideanDistance({ x, y }, minimum.position);
      const floor = minimum.isGlobal ? 0 : (floorMap.get(minimum.id) ?? LOCAL_MIN_FLOOR_MIN);
      const val   = dist + floor;
      if (val < minVal) minVal = val;
    }

    return Math.min(minVal / DISTANCE_SCALE, 1);
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
        ? { x: globalMin.position.x, y: globalMin.position.y, value: 0 }
        : undefined,
    },
  };
}