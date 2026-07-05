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
 *
 * `problem.wallRule` decides what a blocked move does:
 *  - 'waste':  the gene is lost — the agent stays put (behaviour described above).
 *  - 'break':  the agent CRASHES and freezes at that cell for the rest of the
 *              walk (recorded in `crashedAt`) — one bad move truncates the genome.
 *  - 'repair': the blocked gene is REWRITTEN in `path` to a random open
 *              direction and taken (Lamarckian — pass a copy you own; `rng` is
 *              required, otherwise the move is wasted).
 */
export function walkPath(problem: MazeProblem, path: Path, rng?: RNG): WalkResult {
  const { grid, cols, rows, start, goal, wallRule } = problem;
  const goalIdx = cellIndex(goal.x, goal.y, cols);

  let cx = start.x;
  let cy = start.y;
  const visited = new Set<number>();
  const trail: { x: number; y: number }[] = [];

  let idx = cellIndex(cx, cy, cols);
  visited.add(idx);
  trail.push({ x: cx, y: cy });
  let reachedGoalAt = idx === goalIdx ? 0 : -1;
  let crashedAt = -1;

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
    const canMove = open && nx >= 0 && nx < cols && ny >= 0 && ny < rows;
    if (canMove) {
      cx = nx;
      cy = ny;
    } else if (wallRule === 'break') {
      // Crash: freeze at the current cell for every remaining move.
      crashedAt = i;
      for (let j = i; j < path.length; j++) trail.push({ x: cx, y: cy });
      break;
    } else if (wallRule === 'repair' && rng) {
      // Lamarckian repair: rewrite the blocked gene to a random open direction
      // and take it. A fully sealed cell (creator block) leaves nothing to
      // repair to, so the gene is wasted as in 'waste' mode.
      const options: Move[] = [];
      for (let m = 0; m < 4; m++) {
        const mv = m as Move;
        const ox = cx + MOVE_DELTAS[mv][0];
        const oy = cy + MOVE_DELTAS[mv][1];
        const mvOpen = (grid.walls[curIdx] & MOVE_WALL_BIT[mv]) !== 0;
        if (mvOpen && ox >= 0 && ox < cols && oy >= 0 && oy < rows) options.push(mv);
      }
      if (options.length > 0) {
        const pick = options[Math.floor(rng() * options.length)];
        path[i] = pick;
        cx += MOVE_DELTAS[pick][0];
        cy += MOVE_DELTAS[pick][1];
      }
    }
    idx = cellIndex(cx, cy, cols);
    visited.add(idx);
    trail.push({ x: cx, y: cy });
    if (idx === goalIdx) reachedGoalAt = i + 1;
  }

  return { visited, trail, finalCell: idx, reachedGoalAt, crashedAt };
}

/** Builds an Individual from a path: simulates the walk and scores it. Under
 * the 'repair' wall rule the walk rewrites blocked genes (Lamarckian), so the
 * genome is copied first — callers may pass shared arrays (e.g. a parent's). */
export function evaluate(path: Path, problem: MazeProblem, rng?: RNG): Individual {
  const genome = problem.wallRule === 'repair' && rng ? path.slice() : path;
  const walk = walkPath(problem, genome, rng);
  const fitness = problem.evaluate(walk);
  const isSolution = problem.isWin(walk);
  return { path: genome, walk, fitness, isSolution };
}

/** A random move 0..3. */
export function randomMove(rng: RNG): Move {
  return Math.floor(rng() * 4) as Move;
}

/** Creates a random individual whose genome is `problem.pathLength` moves long. */
export function createRandom(problem: MazeProblem, rng: RNG): Individual {
  const path: Path = Array.from({ length: problem.pathLength }, () => randomMove(rng));
  return evaluate(path, problem, rng);
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
