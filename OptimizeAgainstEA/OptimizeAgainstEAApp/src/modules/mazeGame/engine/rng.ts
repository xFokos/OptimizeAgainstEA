import type { RNG } from '../types/ea';

/**
 * Seeded linear congruential generator. Mirrors the (private) LCG inside
 * BattleShips' evolutionaryAlgorithm.ts, lifted into a shared module util so
 * maze generation, the operators and the stepper can all draw from a single
 * deterministic stream. Determinism is mandatory here: the visible-seed feature
 * re-runs the SAME maze under different fitness functions.
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
