import type { ProblemInstance } from '../../types/map';
import type { EAConfig, Generation, Individual, RNG } from '../../types/ea';
import { createRandom, evaluate, clamp } from './individual';
import {
  SELECTION_STRATEGIES,
  CROSSOVER_STRATEGIES,
  MUTATION_STRATEGIES,
} from './operators';

export interface EACallbacks {
  onGeneration: (generation: Generation) => void;
  onSolved:     (generation: Generation, totalGenerations: number) => void;
  onExhausted:  (totalGenerations: number, best: Individual) => void;
}

// ── Fix 1: correct union type syntax (was = instead of |) ─────────────────
export type StepResult =
  | { type: 'generation'; generation: Generation }
  | { type: 'solved';     generation: Generation; totalGenerations: number }
  | { type: 'exhausted';  totalGenerations: number; best: Individual };

export interface EAStepper {
  step: (n: number) => StepResult;
  currentGenIndex: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────

function makeLCG(seed?: number): RNG {
  let s = seed ?? Math.floor(Math.random() * 2 ** 32);
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function summarise(individuals: Individual[], index: number): Generation {
  const sorted = [...individuals].sort((a, b) => a.fitness - b.fitness);
  const mean   = individuals.reduce((s, i) => s + i.fitness, 0) / individuals.length;
  return { index, individuals: sorted, best: sorted[0], meanFitness: mean };
}

function breedNext(
  population:  Individual[],
  config:      EAConfig,
  genIndex:    number,
  // Fix 2: type the operators as plain functions, not indexed lookups
  select:      (pop: Individual[], rng: RNG) => Individual,
  crossover:   (a: Individual, b: Individual, rng: RNG) => import('../../types/map').Coordinate,
  mutate:      (coord: import('../../types/map').Coordinate, gen: number, cfg: EAConfig, rng: RNG) => import('../../types/map').Coordinate,
  problem:     ProblemInstance,
  rng:         RNG,
): Individual[] {
  const eliteCount = Math.max(1, Math.floor(config.populationSize * 0.05));
  const next: Individual[] = population.slice(0, eliteCount);

  while (next.length < config.populationSize) {
    const parentA = select(population, rng);
    const parentB = select(population, rng);

    let childCoord =
      rng() < config.crossoverRate
        ? crossover(parentA, parentB, rng)
        : { ...parentA.position };

    if (rng() < config.mutationRate) {
      childCoord = mutate(childCoord, genIndex, config, rng);
    }

    next.push(evaluate(clamp(childCoord, problem), problem));
  }

  return next;
}

// ── Stateful stepper ──────────────────────────────────────────────────────

export function createEAStepper(
  problem: ProblemInstance,
  config:  EAConfig,
  seed?:   number,
): EAStepper {
  const rng       = makeLCG(seed);
  const select    = SELECTION_STRATEGIES[config.selectionStrategy];
  const crossover = CROSSOVER_STRATEGIES[config.crossoverStrategy];
  const mutate    = MUTATION_STRATEGIES[config.mutationStrategy];

  let population: Individual[] = Array.from(
    { length: config.populationSize },
    () => createRandom(problem, rng),
  );
  let genIndex = 0;

  const step = (n: number): StepResult => {
    // n = 0 just returns current state without advancing
    if (n === 0) {
      return { type: 'generation', generation: summarise(population, genIndex) };
    }

    let lastResult: StepResult = { type: 'generation', generation: summarise(population, genIndex) };

    for (let i = 0; i < n; i++) {
      if (genIndex >= config.maxGenerations) {
        population.sort((a, b) => a.fitness - b.fitness);
        return { type: 'exhausted', totalGenerations: genIndex, best: population[0] };
      }

      population.sort((a, b) => a.fitness - b.fitness);
      const generation = summarise(population, genIndex);

      const solution = population.find((ind) => ind.isSolution);
      if (solution) {
        return { type: 'solved', generation, totalGenerations: genIndex + 1 };
      }

      population = breedNext(population, config, genIndex, select, crossover, mutate, problem, rng);
      genIndex++;
      lastResult = { type: 'generation', generation };
    }

    return lastResult;
  };

  return { step, currentGenIndex: () => genIndex };
}

// ── One-shot runner (standalone EA mode) ─────────────────────────────────

export function runEA(
  problem:   ProblemInstance,
  config:    EAConfig,
  callbacks: EACallbacks,
  seed?:     number,
): void {
  const runner = createEAStepper(problem, config, seed);

  for (let gen = 0; gen < config.maxGenerations; gen++) {
    const result = runner.step(1);
    if (result.type === 'generation') {
      callbacks.onGeneration(result.generation);
    } else if (result.type === 'solved') {
      callbacks.onSolved(result.generation, result.totalGenerations);
      return;
    } else if (result.type === 'exhausted') {
      callbacks.onExhausted(result.totalGenerations, result.best);
      return;
    }
  }
}