import type { Cell, Grid } from '../types/maze';
import type { RNG } from '../types/ea';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../types/maze';
import { makeLCG } from './rng';
import { computeGeodesic } from './geodesic';

/** Opposite move direction (up<->down, right<->left). */
const OPPOSITE = [2, 3, 0, 1] as const;

export interface MazeGenOptions {
  /** Fraction of dead-ends opened into loops (0..1). Shortens solution paths. */
  braid?: number;
  /**
   * Fraction of the interior walls that remain after braiding to knock out
   * (0..1). Braiding only touches dead-ends, so the backtracker's long
   * corridors survive it; this pass punches side doors into them, creating
   * parallel routes the population can split across.
   */
  openness?: number;
}

/** Carve the passage between (x,y) and its neighbour in direction d, both ways. */
function carve(walls: Uint8Array, cols: number, x: number, y: number, d: number): void {
  walls[cellIndex(x, y, cols)] |= MOVE_WALL_BIT[d];
  walls[cellIndex(x + MOVE_DELTAS[d][0], y + MOVE_DELTAS[d][1], cols)] |= MOVE_WALL_BIT[OPPOSITE[d]];
}

/**
 * Generates a maze via an iterative recursive backtracker seeded by `seed`.
 * Every cell is reachable. Start is implicitly (0,0), goal (cols-1, rows-1).
 *
 * Post-passes (all seeded, all only ever REMOVE walls, so connectivity is
 * preserved): `braid` closes dead-ends into loops, `openness` removes a
 * fraction of the remaining interior walls.
 */
export function generateMaze(cols: number, rows: number, seed: number, opts: MazeGenOptions = {}): Grid {
  const { braid = 0, openness = 0 } = opts;
  const rng = makeLCG(seed);
  const walls = new Uint8Array(cols * rows); // all passages closed
  const visited = new Uint8Array(cols * rows);

  const stack: number[] = [];
  const startIdx = cellIndex(0, 0, cols);
  visited[startIdx] = 1;
  stack.push(startIdx);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const cx = current % cols;
    const cy = Math.floor(current / cols);

    // Collect unvisited neighbours.
    const candidates: number[] = []; // move directions 0..3
    for (let d = 0; d < 4; d++) {
      const nx = cx + MOVE_DELTAS[d][0];
      const ny = cy + MOVE_DELTAS[d][1];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (visited[cellIndex(nx, ny, cols)]) continue;
      candidates.push(d);
    }

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const d = candidates[Math.floor(rng() * candidates.length)];
    const nx = cx + MOVE_DELTAS[d][0];
    const ny = cy + MOVE_DELTAS[d][1];
    const neighbour = cellIndex(nx, ny, cols);

    // Carve the passage both ways.
    walls[current] |= MOVE_WALL_BIT[d];
    walls[neighbour] |= MOVE_WALL_BIT[OPPOSITE[d]];

    visited[neighbour] = 1;
    stack.push(neighbour);
  }

  if (braid > 0) braidMaze(cols, rows, walls, braid, rng);
  if (openness > 0) openWalls(cols, rows, walls, openness, rng);

  return { cols, rows, walls };
}

/**
 * Removes a random fraction of the closed interior walls. Unlike braiding this
 * also hits corridor cells, breaking long single-file passages into a lattice
 * of alternative routes.
 */
function openWalls(cols: number, rows: number, walls: Uint8Array, fraction: number, rng: RNG): void {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = cellIndex(x, y, cols);
      // East + South visit every interior edge exactly once.
      if (x + 1 < cols && !(walls[i] & MOVE_WALL_BIT[1]) && rng() < fraction) carve(walls, cols, x, y, 1);
      if (y + 1 < rows && !(walls[i] & MOVE_WALL_BIT[2]) && rng() < fraction) carve(walls, cols, x, y, 2);
    }
  }
}

/**
 * Seeded random start/goal placement: the goal lands anywhere, the start is
 * drawn from the cells whose corridor (BFS) distance to the goal is at least
 * `minFrac` of the maze's diameter — so the pair is never trivially close.
 * The BFS diameter cell itself always qualifies, so a candidate always exists.
 */
export function pickRandomStartGoal(grid: Grid, rng: RNG, minFrac = 0.6): { start: Cell; goal: Cell } {
  const { cols, rows } = grid;
  const goal: Cell = { x: Math.floor(rng() * cols), y: Math.floor(rng() * rows) };
  const geo = computeGeodesic(grid, goal, goal);
  const minDist = geo.diameter * minFrac;

  const candidates: number[] = [];
  let farthest = 0;
  for (let i = 0; i < geo.field.length; i++) {
    if (geo.field[i] > geo.field[farthest]) farthest = i;
    if (geo.field[i] >= minDist) candidates.push(i);
  }
  const idx = candidates.length > 0
    ? candidates[Math.floor(rng() * candidates.length)]
    : farthest;
  return { start: { x: idx % cols, y: Math.floor(idx / cols) }, goal };
}

/**
 * Opens a fraction of dead-ends (cells with a single passage) by carving one
 * extra wall to a random walled neighbour, creating loops.
 */
function braidMaze(cols: number, rows: number, walls: Uint8Array, braid: number, rng: () => number): void {
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const i = cellIndex(cx, cy, cols);
      // Count open passages (popcount of low 4 bits).
      let open = 0;
      for (let d = 0; d < 4; d++) if (walls[i] & MOVE_WALL_BIT[d]) open++;
      if (open !== 1) continue; // only dead-ends
      if (rng() >= braid) continue;

      // Collect walled in-bounds neighbours and open one at random.
      const closed: number[] = [];
      for (let d = 0; d < 4; d++) {
        if (walls[i] & MOVE_WALL_BIT[d]) continue;
        const nx = cx + MOVE_DELTAS[d][0];
        const ny = cy + MOVE_DELTAS[d][1];
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        closed.push(d);
      }
      if (closed.length === 0) continue;
      const d = closed[Math.floor(rng() * closed.length)];
      const nx = cx + MOVE_DELTAS[d][0];
      const ny = cy + MOVE_DELTAS[d][1];
      walls[i] |= MOVE_WALL_BIT[d];
      walls[cellIndex(nx, ny, cols)] |= MOVE_WALL_BIT[OPPOSITE[d]];
    }
  }
}

/**
 * Builds a Grid from edge walls (the maze creator's model): every passage is
 * open unless an explicit wall sits on the edge between two cells. The outer
 * border is always closed. `isHWall(x, y)` is the wall between (x,y) and
 * (x,y+1); `isVWall(x, y)` the wall between (x,y) and (x+1,y).
 */
export function gridFromEdgeWalls(
  cols: number,
  rows: number,
  isHWall: (x: number, y: number) => boolean,
  isVWall: (x: number, y: number) => boolean,
): Grid {
  const walls = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let bits = 0;
      if (y > 0 && !isHWall(x, y - 1)) bits |= MOVE_WALL_BIT[0];    // N
      if (x < cols - 1 && !isVWall(x, y)) bits |= MOVE_WALL_BIT[1]; // E
      if (y < rows - 1 && !isHWall(x, y)) bits |= MOVE_WALL_BIT[2]; // S
      if (x > 0 && !isVWall(x - 1, y)) bits |= MOVE_WALL_BIT[3];    // W
      walls[cellIndex(x, y, cols)] = bits;
    }
  }
  return { cols, rows, walls };
}

/**
 * Debug helper: renders a maze as ASCII art. Used to eyeball generation while
 * developing; not referenced by the running app.
 */
export function mazeToAscii(grid: Grid): string {
  const { cols, rows, walls } = grid;
  let out = '+' + '---+'.repeat(cols) + '\n';
  for (let y = 0; y < rows; y++) {
    let top = '|';
    let bottom = '+';
    for (let x = 0; x < cols; x++) {
      const i = cellIndex(x, y, cols);
      const east = walls[i] & MOVE_WALL_BIT[1]; // east open?
      const south = walls[i] & MOVE_WALL_BIT[2]; // south open?
      top += '   ' + (east ? ' ' : '|');
      bottom += south ? '   +' : '---+';
    }
    out += top + '\n' + bottom + '\n';
  }
  return out;
}
