import type { MazeProblem, Move, Path, WalkResult } from '../../types/maze';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../../types/maze';
import type { Individual, RNG } from '../../types/ea';

/**
 * Simulates a path through the maze — the phenotype. Each move tries to step in
 * its direction; if a wall blocks it (or it would leave the grid) the agent
 * STAYS but still records the current cell, so the trail is always
 * path.length + 1 cells long (uniform for animation).
 *
 * The goal ABSORBS: once the agent reaches it, it stays there for the remaining
 * moves. This makes the final cell a meaningful fitness target — the agent that
 * threads the goal freezes there (final cell = goal) — while a path that merely
 * flies through some other cell gets no lasting credit for it. That distinction
 * is what keeps the deceptive (Manhattan) fitness genuinely deceptive: selection
 * rewards where the agent ENDS, not lucky transient fly-throughs.
 */
export function walkPath(problem: MazeProblem, path: Path): WalkResult {
  const { grid, cols, rows, start, goal } = problem;
  const goalIdx = cellIndex(goal.x, goal.y, cols);

  let cx = start.x;
  let cy = start.y;
  const visited = new Set<number>();
  const trail: { x: number; y: number }[] = [];

  let idx = cellIndex(cx, cy, cols);
  visited.add(idx);
  trail.push({ x: cx, y: cy });
  let reachedGoalAt = idx === goalIdx ? 0 : -1;

  for (let i = 0; i < path.length; i++) {
    if (reachedGoalAt >= 0) {
      // Absorbed at the goal — freeze here for the rest of the walk.
      trail.push({ x: cx, y: cy });
      continue;
    }
    const d = path[i];
    const curIdx = cellIndex(cx, cy, cols);
    const nx = cx + MOVE_DELTAS[d][0];
    const ny = cy + MOVE_DELTAS[d][1];
    const open = (grid.walls[curIdx] & MOVE_WALL_BIT[d]) !== 0;
    if (open && nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
      cx = nx;
      cy = ny;
    }
    idx = cellIndex(cx, cy, cols);
    visited.add(idx);
    trail.push({ x: cx, y: cy });
    if (idx === goalIdx) reachedGoalAt = i + 1;
  }

  return { visited, trail, finalCell: idx, reachedGoalAt };
}

/** Builds an Individual from a path: simulates the walk and scores it. */
export function evaluate(path: Path, problem: MazeProblem): Individual {
  const walk = walkPath(problem, path);
  const fitness = problem.evaluate(walk);
  const isSolution = problem.isWin(walk);
  return { path, walk, fitness, isSolution };
}

/** A random move 0..3. */
export function randomMove(rng: RNG): Move {
  return Math.floor(rng() * 4) as Move;
}

/** Creates a random individual whose genome is `problem.pathLength` moves long. */
export function createRandom(problem: MazeProblem, rng: RNG): Individual {
  const path: Path = Array.from({ length: problem.pathLength }, () => randomMove(rng));
  return evaluate(path, problem);
}

/**
 * Enforces the genome-length invariant after operators (clamp-equivalent).
 * Single-point/uniform crossover already preserve length when both parents are
 * length L; this is a safety net (truncate if long, pad with random moves if short).
 */
export function repair(path: Path, problem: MazeProblem, rng: RNG): Path {
  const L = problem.pathLength;
  if (path.length === L) return path;
  if (path.length > L) return path.slice(0, L);
  const out = path.slice();
  while (out.length < L) out.push(randomMove(rng));
  return out;
}
