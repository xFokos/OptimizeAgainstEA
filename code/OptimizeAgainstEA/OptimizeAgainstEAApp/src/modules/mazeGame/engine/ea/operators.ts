import type {
  Individual, EAConfig, RNG,
  SelectionStrategy, CrossoverStrategy, MutationStrategy,
  SelectionFn,
} from '../../types/ea';
import type { Move, Path } from '../../types/maze';
import { randomMove } from './individual';

// ─────────────────────────────────────────────
// SELECTION  (ported verbatim from BattleShips — only reads .fitness)
// ─────────────────────────────────────────────

/** Tournament: pick k random candidates, return the fittest (lowest fitness). */
const tournamentSelection: SelectionFn = (population, rng) => {
  const k = 3;
  let best = population[Math.floor(rng() * population.length)];
  for (let i = 1; i < k; i++) {
    const candidate = population[Math.floor(rng() * population.length)];
    if (candidate.fitness < best.fitness) best = candidate;
  }
  return best;
};

/** Roulette: invert fitness (lower is better) then select proportionally. */
const rouletteSelection: SelectionFn = (population, rng) => {
  const maxFit = Math.max(...population.map((i) => i.fitness));
  const weights = population.map((ind) => maxFit - ind.fitness + 1e-6);
  const total = weights.reduce((s, w) => s + w, 0);
  let pick = rng() * total;
  for (let i = 0; i < population.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return population[i];
  }
  return population[population.length - 1];
};

/** Elitist: always returns one of the top 20%. */
const elitistSelection: SelectionFn = (population, rng) => {
  const eliteSize = Math.max(1, Math.floor(population.length * 0.2));
  return population[Math.floor(rng() * eliteSize)];
};

export const SELECTION_STRATEGIES: Record<SelectionStrategy, SelectionFn> = {
  tournament: tournamentSelection,
  roulette:   rouletteSelection,
  elitist:    elitistSelection,
};

// ─────────────────────────────────────────────
// CROSSOVER  (on the move sequence)
// ─────────────────────────────────────────────

/**
 * Crossover result plus the random choices it made, surfaced for the replay log
 * (the splice cut / per-gene mask can't be reverse-engineered after mutation).
 */
export interface CrossoverResult {
  path: Path;
  cut?: number;        // single-point: child = A[0..cut) ++ B[cut..]
  geneMask?: boolean[]; // uniform: true → gene came from parent A
}

export type CrossoverRecordingFn = (a: Individual, b: Individual, rng: RNG) => CrossoverResult;

/** Single-point: follow parent A up to a cut, then switch to parent B. */
const singlePointCrossover: CrossoverRecordingFn = (a, b, rng) => {
  const L = a.path.length;
  const cut = 1 + Math.floor(rng() * Math.max(1, L - 1)); // 1..L-1
  const path: Path = [...a.path.slice(0, cut), ...b.path.slice(cut)];
  return { path, cut };
};

/** Uniform: each gene independently drawn from either parent. */
const uniformCrossover: CrossoverRecordingFn = (a, b, rng) => {
  const L = a.path.length;
  const geneMask: boolean[] = new Array(L);
  const path: Path = new Array(L);
  for (let i = 0; i < L; i++) {
    const fromA = rng() < 0.5;
    geneMask[i] = fromA;
    path[i] = fromA ? a.path[i] : b.path[i];
  }
  return { path, geneMask };
};

export const CROSSOVER_STRATEGIES_RECORDING: Record<CrossoverStrategy, CrossoverRecordingFn> = {
  singlePoint: singlePointCrossover,
  uniform:     uniformCrossover,
};

// ─────────────────────────────────────────────
// MUTATION  (re-pick moves; strength = per-gene flip probability)
// ─────────────────────────────────────────────

export interface MutationResult {
  path: Path;
  mutatedIndices: number[];
}

export type MutationRecordingFn = (
  path: Path,
  generationIndex: number,
  config: EAConfig,
  rng: RNG,
) => MutationResult;

/** Per-gene flip probability after decay. */
function decayedStrength(gen: number, config: EAConfig): number {
  return config.mutationStrength * Math.pow(config.mutationDecay, gen);
}

/** Point: each gene independently re-picked with probability `decayedStrength`. */
const pointMutation: MutationRecordingFn = (path, gen, config, rng) => {
  const p = decayedStrength(gen, config);
  const out = path.slice();
  const mutatedIndices: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (rng() < p) {
      out[i] = randomMove(rng);
      mutatedIndices.push(i);
    }
  }
  return { path: out, mutatedIndices };
};

/** Segment: re-randomize one contiguous block (a "kink" the path forks at). */
const segmentMutation: MutationRecordingFn = (path, gen, config, rng) => {
  const out = path.slice();
  const L = out.length;
  const maxLen = Math.max(1, Math.round(L * decayedStrength(gen, config)) + 1);
  const segLen = 1 + Math.floor(rng() * maxLen);
  const startStr = Math.floor(rng() * Math.max(1, L - segLen + 1));
  const mutatedIndices: number[] = [];
  for (let i = startStr; i < Math.min(L, startStr + segLen); i++) {
    out[i] = randomMove(rng) as Move;
    mutatedIndices.push(i);
  }
  return { path: out, mutatedIndices };
};

export const MUTATION_STRATEGIES: Record<MutationStrategy, MutationRecordingFn> = {
  point:   pointMutation,
  segment: segmentMutation,
};
