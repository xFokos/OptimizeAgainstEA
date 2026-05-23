import type {
  Individual, EAConfig, RNG,
  SelectionStrategy, CrossoverStrategy, MutationStrategy,
  SelectionFn, CrossoverFn, MutationFn,
} from '../../types/ea';

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

/** Uniform: each gene independently drawn from either parent */
const uniformCrossover: CrossoverFn = (a, b, rng) => ({
  x: rng() < 0.5 ? a.position.x : b.position.x,
  y: rng() < 0.5 ? a.position.y : b.position.y,
});

/** Arithmetic: weighted average with random blend factor */
const arithmeticCrossover: CrossoverFn = (a, b, rng) => {
  const alpha = rng();
  return {
    x: alpha * a.position.x + (1 - alpha) * b.position.x,
    y: alpha * a.position.y + (1 - alpha) * b.position.y,
  };
};

/** Single-point: treat (x,y) as a 2-gene chromosome, split after x or y */
const singlePointCrossover: CrossoverFn = (a, b, rng) =>
  rng() < 0.5
    ? { x: a.position.x, y: b.position.y }
    : { x: b.position.x, y: a.position.y };

export const CROSSOVER_STRATEGIES: Record<CrossoverStrategy, CrossoverFn> = {
  uniform:     uniformCrossover,
  arithmetic:  arithmeticCrossover,
  singlePoint: singlePointCrossover,
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