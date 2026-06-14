export interface Coordinate {
  x: number; // normalized 0–1
  y: number; // normalized 0–1
}

export interface Minimum {
  id: string;
  position: Coordinate;
  isGlobal: boolean;
  /**
   * Explicit depth of this local minimum — the surface "floor" added to the
   * distance term in `createMapProblem`. Lower = deeper / more deceptive.
   * When omitted, a position-seeded pseudo-random floor is used instead.
   * Ignored for the global minimum (always 0). Range: [0, ~0.3].
   */
  floor?: number;
}

export interface MapConfig {
  id: string;
  minima: Minimum[];
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  winRadius: number; // normalized radius around global min to trigger win
  createdAt: number;
}

export interface ProblemInstance {
  evaluate: (x: number, y: number) => number;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  isWin: (x: number, y: number) => boolean;
  metadata?: {
    name?: string;
    description?: string;
    globalMinimum?: { x: number; y: number; value: number };
  };
}

export interface ProbeResult {
  position: Coordinate;
  value: number;
  isWin: boolean;
}
