import type { Cell, Grid } from '../types/maze';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../types/maze';

export interface GeodesicResult {
  /** Shortest corridor distance from each cell to the goal; -1 = unreachable. */
  field: Int32Array;
  /** Largest finite distance in the field (the maze's geodesic diameter). */
  diameter: number;
  /** Distance from `start` to the goal. */
  shortestFromStart: number;
}

/**
 * BFS distance field measured through open corridors, flooded outward from the
 * goal. Used both for the geodesic fitness function and for auto-sizing the
 * genome length (diameter). On a perfect maze every cell is reachable, so -1
 * should not occur — but we keep it for robustness.
 */
export function computeGeodesic(grid: Grid, goal: Cell, start: Cell): GeodesicResult {
  const { cols, rows, walls } = grid;
  const field = new Int32Array(cols * rows).fill(-1);

  const goalIdx = cellIndex(goal.x, goal.y, cols);
  field[goalIdx] = 0;
  const queue: number[] = [goalIdx];
  let head = 0;
  let diameter = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    const dist = field[cur];

    for (let d = 0; d < 4; d++) {
      if (!(walls[cur] & MOVE_WALL_BIT[d])) continue; // wall blocks this edge
      const nx = cx + MOVE_DELTAS[d][0];
      const ny = cy + MOVE_DELTAS[d][1];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const ni = cellIndex(nx, ny, cols);
      if (field[ni] !== -1) continue;
      field[ni] = dist + 1;
      if (field[ni] > diameter) diameter = field[ni];
      queue.push(ni);
    }
  }

  return {
    field,
    diameter,
    shortestFromStart: field[cellIndex(start.x, start.y, cols)],
  };
}
