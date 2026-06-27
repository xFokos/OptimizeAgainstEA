import type { Grid } from '../types/maze';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../types/maze';
import { makeLCG } from './rng';

/** Opposite move direction (up<->down, right<->left). */
const OPPOSITE = [2, 3, 0, 1] as const;

/**
 * Generates a maze via an iterative recursive backtracker seeded by `seed`.
 * Every cell is reachable. Start is implicitly (0,0), goal (cols-1, rows-1).
 *
 * `braid` (0..1) is the fraction of dead-ends to open up afterward, adding loops
 * to the otherwise-perfect maze. Braiding shortens the corner-to-corner solution
 * path dramatically (a perfect maze's is near worst-case windy), which keeps the
 * EA reliably solvable, and gives the population trails richer routes to explore.
 */
export function generateMaze(cols: number, rows: number, seed: number, braid = 0): Grid {
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

  return { cols, rows, walls };
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
 * Builds a Grid from a hand-painted cell map (the maze creator's model): each
 * cell is either floor or a solid wall block. A floor cell opens a passage to
 * every in-bounds neighbour that is ALSO floor; wall cells stay fully closed
 * and isolated. This turns the touch-friendly "paint cells" editor into the
 * edge-bitmask Grid the EA/geodesic already understand.
 */
export function gridFromWallCells(
  cols: number,
  rows: number,
  isWall: (x: number, y: number) => boolean,
): Grid {
  const walls = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isWall(x, y)) continue; // solid block — no passages
      let bits = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + MOVE_DELTAS[d][0];
        const ny = y + MOVE_DELTAS[d][1];
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (isWall(nx, ny)) continue;
        bits |= MOVE_WALL_BIT[d];
      }
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
