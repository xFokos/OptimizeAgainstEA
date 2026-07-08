import type { Cell, FitnessFnId, Grid, MazeProblem, WalkResult, WallRule } from '../types/maze';
import { DEFAULT_PATH_LENGTH_FACTOR } from '../types/ea';
import { generateMaze } from './mazeGen';
import { computeGeodesic } from './geodesic';

/** Genome-length fallback when the goal is unreachable (shortest path unknown). */
const MIN_PATH_LENGTH = 30;
/** Hard genome-length cap (worker cost, replay display). Exported so the maze
 * creator can warn when a maze's shortest path exceeds what a genome can hold. */
export const MAX_PATH_LENGTH = 600;

/**
 * MazeProblem carries an extra `diameterNorm` (the BFS diameter used to
 * normalize geodesic scores). We stash it on the object so the fitness fns
 * stay pure closures over the problem.
 */
type MazeProblemInternal = MazeProblem & { diameterNorm: number };

type FitnessFn = (walk: WalkResult, problem: MazeProblemInternal) => number;

/**
 * Three fitness functions, all "lower = better", normalized to roughly [0, 1]
 * so they share the fixed-yMax fitness chart.
 */
/**
 * Three fitness functions, all "lower = better", normalized to roughly [0, 1]
 * so they share the fixed-yMax fitness chart. All score the agent's FINAL cell
 * (the goal absorbs, so a path that threads the goal ends there). Scoring the
 * endpoint rather than the closest approach is what preserves deception: the
 * Manhattan-deceptive run can't earn credit for a lucky fly-through, only for
 * where the agent actually settles.
 */
const FITNESS_FNS: Record<FitnessFnId, FitnessFn> = {
  /**
   * Straight-line distance of the final cell to the goal — ignores walls, so it
   * is DECEPTIVE: agents are rewarded for ending at the cell that is closest
   * "as the crow flies", which is typically a dead-end against the wall nearest
   * the goal. The population piles up there and stalls.
   */
  manhattan: (walk, problem) => {
    const x = walk.finalCell % problem.cols;
    const y = Math.floor(walk.finalCell / problem.cols);
    const dist = Math.abs(x - problem.goal.x) + Math.abs(y - problem.goal.y);
    return dist / (problem.cols + problem.rows);
  },

  /**
   * Corridor (BFS) distance of the final cell to the goal — smooth and solvable.
   * The same EA that stalls under `manhattan` now climbs cleanly toward the
   * goal. 0 exactly at the goal.
   */
  geodesic: (walk, problem) => {
    const d = problem.geodesicField[walk.finalCell];
    if (d < 0) return 1;
    return problem.diameterNorm > 0 ? d / problem.diameterNorm : 0;
  },

  /**
   * Geodesic, plus a reward for reaching the goal in fewer steps. A path that
   * never reaches the goal always scores worse (>= 0.5) than any path that does
   * (< 0.5), so reaching the goal dominates; among solvers, shorter wins.
   */
  length: (walk, problem) => {
    if (walk.reachedGoalAt < 0) {
      const d = problem.geodesicField[walk.finalCell];
      const norm = d < 0 ? 1 : problem.diameterNorm > 0 ? d / problem.diameterNorm : 0;
      return 0.5 + 0.5 * norm;
    }
    return 0.5 * (walk.reachedGoalAt / problem.pathLength);
  },

  /**
   * Placeholder — novelty depends on the whole population + an archive, so it
   * can't be scored per-individual here. The stepper applies a NoveltyScorer
   * (see engine/ea/novelty.ts) that overwrites each individual's fitness. This
   * neutral value is only what an individual carries before that pass.
   */
  novelty: () => 1,
};

export interface BuildMazeOptions {
  cols: number;
  rows: number;
  fitnessFnId: FitnessFnId;
  /** Seed for procedural generation (ignored when `grid` is supplied). */
  seed?: number;
  /** Fraction of dead-ends to open (0 = perfect maze). Shortens solution paths. */
  braid?: number;
  /** Fraction of remaining interior walls to remove — opens parallel routes. */
  openness?: number;
  /** Use this exact grid instead of generating one (hand-built creator mazes). */
  grid?: Grid;
  /** Start cell. Defaults to the top-left corner. */
  start?: Cell;
  /** Goal cell. Defaults to the bottom-right corner. */
  goal?: Cell;
  /** How a blocked move is handled during walks. Defaults to 'waste'. */
  wallRule?: WallRule;
  /**
   * Genome length as a multiple of the shortest start→goal path (≥ 1). Roughly
   * half of a random agent's moves bump a wall and waste a step, and it
   * backtracks, so it needs several times the corridor distance to reliably
   * thread its way to the goal — the ~3.5× default gives reliable solving
   * without bloating the genome.
   */
  pathLengthFactor?: number;
}

/** Default braiding — keeps the maze solvable and exploration-rich. */
export const DEFAULT_BRAID = 0.5;
/**
 * Default openness — the fraction of interior walls removed after braiding.
 * Braiding only opens dead-ends, so the backtracker's long corridors survive
 * it and the whole population files down one path; this breaks them up.
 * Too high and the deceptive Manhattan fitness stops being deceptive.
 */
export const DEFAULT_OPENNESS = 0.15;

/**
 * Builds a complete maze problem from a seed: generates the maze, floods the
 * geodesic field from the goal, auto-sizes the genome length, and wires up the
 * chosen fitness function. Changing only `fitnessFnId` for the same seed yields
 * the SAME maze with a different `evaluate` — the comparison demo.
 */
export function createMazeProblem(opts: BuildMazeOptions): MazeProblem {
  const {
    cols, rows, fitnessFnId, seed = 0,
    braid = DEFAULT_BRAID, openness = DEFAULT_OPENNESS,
    pathLengthFactor = DEFAULT_PATH_LENGTH_FACTOR,
  } = opts;
  const grid: Grid = opts.grid ?? generateMaze(cols, rows, seed, { braid, openness });
  const start: Cell = opts.start ?? { x: 0, y: 0 };
  const goal: Cell = opts.goal ?? { x: cols - 1, y: rows - 1 };

  const geo = computeGeodesic(grid, goal, start);
  // ×1 = exactly the shortest possible path (a perfect string is required).
  const shortest = geo.shortestFromStart > 0 ? geo.shortestFromStart : MIN_PATH_LENGTH;
  const pathLength = Math.min(MAX_PATH_LENGTH, Math.ceil(shortest * Math.max(pathLengthFactor, 1)));

  const fn = FITNESS_FNS[fitnessFnId];

  const problem: MazeProblemInternal = {
    grid,
    cols,
    rows,
    start,
    goal,
    geodesicField: geo.field,
    diameterNorm: geo.diameter,
    pathLength,
    fitnessFnId,
    wallRule: opts.wallRule ?? 'waste',
    evaluate: (walk) => fn(walk, problem),
    isWin: (walk) => walk.reachedGoalAt >= 0,
    metadata: {
      seed,
      shortestPath: geo.shortestFromStart,
    },
  };

  return problem;
}
