export interface Coordinate {
  x: number; // normalized 0–1
  y: number; // normalized 0–1
}

export interface Minimum {
  id: string;
  position: Coordinate;
  isGlobal: boolean;
  /**
   * Explicit depth of this local minimum, as a fraction of the map's
   * `basinScale` — the surface "floor" added to the distance term in
   * `createMapProblem`. Lower = deeper / more deceptive. Expressed relative to
   * the basin scale so a local minimum is equally deceptive on a Small map and
   * on a Huge one. When omitted, a position-seeded pseudo-random floor is used.
   * Ignored for the global minimum (always 0). Range: [0, ~0.6].
   */
  floor?: number;
}

export interface MapConfig {
  id: string;
  minima: Minimum[];
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  winRadius: number; // normalized radius around global min to trigger win
  /**
   * How wide one minimum's basin is, in normalized map units — the distance from
   * a minimum at which the surface reaches the middle of its value range.
   *
   * This is what makes a basin's size a property of the *map*, not of how many
   * minima happen to be on it. The alternative (normalising each surface against
   * its own min/max) means adding minima shrinks every basin, because the map's
   * value range collapses as nowhere is left far from anything — so the same
   * mountain looked different depending on its neighbours. Comes from the size
   * preset (see MAP_SIZES): a Small map gets wide basins, a Huge map narrow ones.
   */
  basinScale?: number;
  createdAt: number;
}

export interface ProblemInstance {
  /**
   * The surface: [0,1], 0 at the global optimum. This single value is what the
   * player reads, what the EA minimises, and what the heatmap colours — it goes
   * to the ramp untouched, so a problem is responsible for returning a value
   * that already spans the range sensibly.
   */
  evaluate: (x: number, y: number) => number;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  isWin: (x: number, y: number) => boolean;
  /**
   * Optional **display-only** colour curve for the heatmap: the layer paints
   * `pow(evaluate, displayExponent)` instead of `evaluate`. Purely cosmetic — it
   * touches neither the player's reading, the win check, nor the EA, all of which
   * always read `evaluate` directly.
   *
   * Surface maps leave this unset (their engine already shapes `evaluate` to be
   * display-ready, so it goes to the ramp untouched — exponent 1). Benchmark
   * functions set it below 1 to compress the highs and keep more colour near the
   * optimum — the look they had when the heatmap applied this curve to every
   * problem, before that global curve was removed. See `functionProblem.ts`.
   */
  displayExponent?: number;
  metadata?: {
    name?: string;
    description?: string;
    globalMinimum?: { x: number; y: number; value: number };
    /** Approximate extent of the win zone, for drawing the win ring in replays. */
    winRadius?: number;
  };
}

export interface ProbeResult {
  position: Coordinate;
  value: number;
  isWin: boolean;
}
