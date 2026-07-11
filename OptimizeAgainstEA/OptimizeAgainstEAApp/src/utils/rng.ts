/** A deterministic pseudo-random source: call it for the next value in [0, 1). */
export type RNG = () => number;

/**
 * Seeded linear congruential generator — the single random source shared by the
 * PeakFinder (BattleShips) and Maze EAs and by maze generation. Same seed ⇒ same
 * stream on every device (pure integer math, no platform float drift), so a run
 * is fully reproducible. Pass no seed to get a fresh `Math.random()`-derived one
 * (a non-deterministic run).
 */
export function makeLCG(seed?: number): RNG {
  let s = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  // Avoid the degenerate all-zero state.
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
