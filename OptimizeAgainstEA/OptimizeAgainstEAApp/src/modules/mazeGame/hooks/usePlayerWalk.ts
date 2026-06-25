import { useCallback, useMemo, useState } from 'react';
import type { Cell, Grid, Move } from '../types/maze';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../types/maze';

export type PlayerStatus = 'playing' | 'won';

export interface PlayerWalkState {
  pos: Cell;
  /** Cell indices the player has stood on. */
  visited: Set<number>;
  /** Cell indices reachable from `pos` in one legal move (open neighbours). */
  frontier: Set<number>;
  /** The route walked so far (length = number of moves + 1). */
  trail: Cell[];
  status: PlayerStatus;
  /** Try to move; ignores walls and out-of-bounds. No-op once won. */
  move: (dir: Move) => void;
  reset: () => void;
}

/** Open neighbours of a cell — the corridors the player can currently step into. */
function openNeighbours(grid: Grid, cell: Cell): Set<number> {
  const { cols, rows, walls } = grid;
  const i = cellIndex(cell.x, cell.y, cols);
  const out = new Set<number>();
  for (let d = 0; d < 4; d++) {
    if (!(walls[i] & MOVE_WALL_BIT[d])) continue;
    const nx = cell.x + MOVE_DELTAS[d][0];
    const ny = cell.y + MOVE_DELTAS[d][1];
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    out.add(cellIndex(nx, ny, cols));
  }
  return out;
}

/**
 * Blind player exploration of a maze. The player moves cell-by-cell with the
 * arrow/WASD keys; only visited cells and their open neighbours are ever
 * revealed (fog-of-war). Mirrors BattleShips' usePlaySession in spirit but the
 * "probe" is a step through a corridor.
 */
export function usePlayerWalk(grid: Grid, start: Cell, goal: Cell): PlayerWalkState {
  const goalIdx = cellIndex(goal.x, goal.y, grid.cols);

  const initial = useCallback(() => {
    const startIdx = cellIndex(start.x, start.y, grid.cols);
    return {
      pos: { ...start },
      visited: new Set<number>([startIdx]),
      trail: [{ ...start }] as Cell[],
      status: startIdx === goalIdx ? ('won' as PlayerStatus) : ('playing' as PlayerStatus),
    };
  }, [start, grid.cols, goalIdx]);

  const [core, setCore] = useState(initial);

  const frontier = useMemo(() => openNeighbours(grid, core.pos), [grid, core.pos]);

  const move = useCallback((dir: Move) => {
    setCore((prev) => {
      if (prev.status === 'won') return prev;
      const i = cellIndex(prev.pos.x, prev.pos.y, grid.cols);
      if (!(grid.walls[i] & MOVE_WALL_BIT[dir])) return prev; // wall blocks
      const nx = prev.pos.x + MOVE_DELTAS[dir][0];
      const ny = prev.pos.y + MOVE_DELTAS[dir][1];
      if (nx < 0 || nx >= grid.cols || ny < 0 || ny >= grid.rows) return prev;

      const ni = cellIndex(nx, ny, grid.cols);
      const visited = new Set(prev.visited);
      visited.add(ni);
      const pos = { x: nx, y: ny };
      return {
        pos,
        visited,
        trail: [...prev.trail, pos],
        status: ni === goalIdx ? 'won' : 'playing',
      };
    });
  }, [grid, goalIdx]);

  const reset = useCallback(() => setCore(initial()), [initial]);

  return { ...core, frontier, move, reset };
}
