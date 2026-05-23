import type { Coordinate, ProblemInstance } from '../../types/map';
import type { Individual, RNG } from '../../types/ea';

/**
 * Creates a random individual within the problem bounds.
 */
export function createRandom(problem: ProblemInstance, rng: RNG): Individual {
  const { xMin, xMax, yMin, yMax } = problem.bounds;
  const position: Coordinate = {
    x: xMin + rng() * (xMax - xMin),
    y: yMin + rng() * (yMax - yMin),
  };
  return evaluate(position, problem);
}

/**
 * Evaluates a position against the problem and wraps it in an Individual.
 */
export function evaluate(position: Coordinate, problem: ProblemInstance): Individual {
  const fitness     = problem.evaluate(position.x, position.y);
  const isSolution  = problem.isWin(position.x, position.y);
  return { position, fitness, isSolution };
}

/**
 * Clamps a coordinate to the problem bounds.
 */
export function clamp(coord: Coordinate, problem: ProblemInstance): Coordinate {
  return {
    x: Math.max(problem.bounds.xMin, Math.min(problem.bounds.xMax, coord.x)),
    y: Math.max(problem.bounds.yMin, Math.min(problem.bounds.yMax, coord.y)),
  };
}