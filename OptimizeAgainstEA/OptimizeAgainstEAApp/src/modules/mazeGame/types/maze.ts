/**
 * Maze types. An individual's genome is a discrete PATH (sequence of moves),
 * not an (x,y) point — this is what makes the EA legible on a maze.
 */

/** A cell coordinate in grid space. */
export interface Cell {
  x: number;
  y: number;
}

/**
 * A move direction. Indices line up with MOVE_ARROWS / MOVE_DELTAS /
 * MOVE_WALL_BIT below so a move can index straight into each table.
 *   0 = Up (north), 1 = Right (east), 2 = Down (south), 3 = Left (west)
 */
export type Move = 0 | 1 | 2 | 3;

/** A genome: a fixed-length sequence of moves. */
export type Path = Move[];

export const MOVE_ARROWS = ['↑', '→', '↓', '←'] as const;
/** dx, dy per move. y grows downward (screen/grid convention). */
export const MOVE_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // up
  [1, 0],  // right
  [0, 1],  // down
  [-1, 0], // left
];
/**
 * Wall open-bit that must be set on a cell for the corresponding move to be
 * legal. Bits: N=1, E=2, S=4, W=8 (a set bit means the passage is OPEN).
 */
export const MOVE_WALL_BIT: ReadonlyArray<number> = [1, 2, 4, 8];

/**
 * The maze grid. `walls[i]` holds the open-passage bitmask (N/E/S/W) for cell
 * `i = y * cols + x`. A set bit means you may leave the cell in that direction.
 */
export interface Grid {
  cols: number;
  rows: number;
  walls: Uint8Array;
}

/**
 * A maze ready to run, decoupled from procedural generation — used to hand a
 * hand-built (creator) maze to the EA worker. `walls` is the same edge-bitmask
 * layout as Grid; start/goal are arbitrary (not forced to the corners).
 */
export interface SerializedMaze {
  cols: number;
  rows: number;
  walls: Uint8Array;
  start: Cell;
  goal: Cell;
}

/** Result of simulating a path through the maze (the phenotype). */
export interface WalkResult {
  /** Set of visited cell indices (y*cols + x). */
  visited: Set<number>;
  /** Cell visited at each step, length = path.length + 1 (includes start). */
  trail: Cell[];
  /** Final cell index after the whole walk. */
  finalCell: number;
  /** Step index at which the agent first stood on the goal, or -1. */
  reachedGoalAt: number;
  /** Move index at which the agent crashed into a wall and stopped, or -1.
   * Only ever set when the problem's wall rule is 'break'. */
  crashedAt: number;
}

/**
 * How a blocked move (wall or grid edge) is handled — the three classic
 * constraint-handling strategies:
 *  - 'waste':  the move is lost; the agent stays put and continues.
 *  - 'break':  the agent crashes and freezes there (death penalty).
 *  - 'repair': the gene is rewritten to a random open direction and taken
 *              (Lamarckian — the repaired genome is what breeds on).
 */
export type WallRule = 'waste' | 'break' | 'repair';

export type FitnessFnId = 'manhattan' | 'geodesic' | 'length' | 'novelty';

export const FITNESS_FN_IDS: readonly FitnessFnId[] = ['manhattan', 'geodesic', 'length', 'novelty'];

export const FITNESS_FN_LABELS: Record<FitnessFnId, string> = {
  manhattan: 'Manhattan (naive objective)',
  geodesic:  'Geodesic (BFS field)',
  length:    'Length penalty',
  novelty:   'Novelty search',
};

/**
 * A maze optimization problem. Parallel to BattleShips' ProblemInstance, but
 * the genome is a path so `evaluate`/`isWin` take a simulated WalkResult rather
 * than an (x,y) coordinate.
 */
export interface MazeProblem {
  grid: Grid;
  cols: number;
  rows: number;
  start: Cell;
  goal: Cell;
  /** BFS distance-to-goal per cell; -1 = unreachable. */
  geodesicField: Int32Array;
  /** Auto-sized genome length L (>= shortest path). */
  pathLength: number;
  fitnessFnId: FitnessFnId;
  /** How a blocked move is handled during the walk (see WallRule). */
  wallRule: WallRule;
  /** Lower = better. 0 = at the goal, optimally. */
  evaluate: (walk: WalkResult) => number;
  isWin: (walk: WalkResult) => boolean;
  metadata: {
    seed: number;
    shortestPath: number;
  };
}

/** Index helper: cell (x,y) → flat array index. */
export function cellIndex(x: number, y: number, cols: number): number {
  return y * cols + x;
}
