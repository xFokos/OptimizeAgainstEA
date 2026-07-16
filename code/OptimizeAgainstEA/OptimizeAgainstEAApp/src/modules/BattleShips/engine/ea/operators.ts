import type {
  Individual, EAConfig, RNG,
  SelectionStrategy, CrossoverStrategy, MutationStrategy,
  SelectionFn, CrossoverFn, MutationFn,
} from '../../types/ea';
import type { Coordinate } from '../../types/map';

// ─────────────────────────────────────────────
// SELECTION
// ─────────────────────────────────────────────

/** Tournament: pick k random candidates, return the fittest */
const tournamentSelection: SelectionFn = (population, rng) => {
  const k = 3;
  let best = population[Math.floor(rng() * population.length)];
  for (let i = 1; i < k; i++) {
    const candidate = population[Math.floor(rng() * population.length)];
    if (candidate.fitness < best.fitness) best = candidate;
  }
  return best;
};

/**
 * Roulette (fitness-proportionate) — inverts fitness so lower is better,
 * then selects proportionally.
 */
const rouletteSelection: SelectionFn = (population, rng) => {
  const maxFit = Math.max(...population.map((i) => i.fitness));
  const weights = population.map((ind) => maxFit - ind.fitness + 1e-6);
  const total   = weights.reduce((s, w) => s + w, 0);
  let pick = rng() * total;
  for (let i = 0; i < population.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return population[i];
  }
  return population[population.length - 1];
};

/** Elitist: always returns one of the top 20% */
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
// CROSSOVER
// ─────────────────────────────────────────────

/**
 * Crossover result with the random choices it made. These choices
 * (blend factor / which parent each gene came from) cannot be reliably
 * reverse-engineered from the child position once mutation has been
 * applied, so the operators surface them here for the replay log.
 */
export interface CrossoverResult {
  coord:       Coordinate;
  alpha?:      number;                               // arithmetic
  geneSource?: { xFromA: boolean; yFromA: boolean }; // uniform / singlePoint
}

export type CrossoverRecordingFn = (a: Individual, b: Individual, rng: RNG) => CrossoverResult;

/** Uniform: each gene independently drawn from either parent */
const uniformCrossover: CrossoverRecordingFn = (a, b, rng) => {
  const xFromA = rng() < 0.5;
  const yFromA = rng() < 0.5;
  return {
    coord: {
      x: xFromA ? a.position.x : b.position.x,
      y: yFromA ? a.position.y : b.position.y,
    },
    geneSource: { xFromA, yFromA },
  };
};

/** Arithmetic: weighted average with random blend factor */
const arithmeticCrossover: CrossoverRecordingFn = (a, b, rng) => {
  const alpha = rng();
  return {
    coord: {
      x: alpha * a.position.x + (1 - alpha) * b.position.x,
      y: alpha * a.position.y + (1 - alpha) * b.position.y,
    },
    alpha,
  };
};

/** Single-point: treat (x,y) as a 2-gene chromosome, split after x or y */
const singlePointCrossover: CrossoverRecordingFn = (a, b, rng) => {
  const xFromA = rng() < 0.5; // true → x from A & y from B, false → the reverse
  return {
    coord: xFromA
      ? { x: a.position.x, y: b.position.y }
      : { x: b.position.x, y: a.position.y },
    geneSource: { xFromA, yFromA: !xFromA },
  };
};

/**
 * Recording variants — single source of truth for crossover. They draw
 * exactly the same `rng()` values, in the same order, as the plain
 * variants below, so swapping between them never changes the RNG stream.
 */
export const CROSSOVER_STRATEGIES_RECORDING: Record<CrossoverStrategy, CrossoverRecordingFn> = {
  uniform:     uniformCrossover,
  arithmetic:  arithmeticCrossover,
  singlePoint: singlePointCrossover,
};

/** Plain variants (coordinate only) — thin wrappers over the recording ones. */
export const CROSSOVER_STRATEGIES: Record<CrossoverStrategy, CrossoverFn> = {
  uniform:     (a, b, rng) => uniformCrossover(a, b, rng).coord,
  arithmetic:  (a, b, rng) => arithmeticCrossover(a, b, rng).coord,
  singlePoint: (a, b, rng) => singlePointCrossover(a, b, rng).coord,
};

// ─────────────────────────────────────────────
// MUTATION
// ─────────────────────────────────────────────

/** Current strength after decay */
function decayedStrength(gen: number, config: EAConfig): number {
  return config.mutationStrength * Math.pow(config.mutationDecay, gen);
}

/** Gaussian: normally-distributed perturbation (Box–Muller) */
const gaussianMutation: MutationFn = (coord, gen, config, rng) => {
  const std = decayedStrength(gen, config);
  const boxMuller = () => {
    // Box–Muller transform
    const u = 1 - rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    x: coord.x + boxMuller() * std,
    y: coord.y + boxMuller() * std,
  };
};

/** Uniform: flat random perturbation within ±strength */
const uniformMutation: MutationFn = (coord, gen, config, rng) => {
  const s = decayedStrength(gen, config);
  return {
    x: coord.x + (rng() * 2 - 1) * s,
    y: coord.y + (rng() * 2 - 1) * s,
  };
};

/**
 * Cauchy: heavy-tailed distribution — mostly small steps, occasional
 * large jumps. Good for escaping local minima.
 */
const cauchyMutation: MutationFn = (coord, gen, config, rng) => {
  const s = decayedStrength(gen, config);
  // Cauchy sample via inverse CDF
  const cauchy = () => Math.tan(Math.PI * (rng() - 0.5));
  return {
    x: coord.x + cauchy() * s,
    y: coord.y + cauchy() * s,
  };
};

export const MUTATION_STRATEGIES: Record<MutationStrategy, MutationFn> = {
  gaussian: gaussianMutation,
  uniform:  uniformMutation,
  cauchy:   cauchyMutation,
};