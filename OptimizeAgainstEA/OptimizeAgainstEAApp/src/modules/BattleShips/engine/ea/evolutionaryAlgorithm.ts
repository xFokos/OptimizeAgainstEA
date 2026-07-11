import type { ProblemInstance } from '../../types/map';
import { buildReplayFrames, type ReplayFrame, type BreedingRecord } from './eaReplayLog';
import type { EAConfig, Generation, Individual, RNG } from '../../types/ea';
import { makeLCG } from '../../../../utils/rng';
import { createRandom, evaluate, clamp } from './individual';
import {
  SELECTION_STRATEGIES,
  CROSSOVER_STRATEGIES_RECORDING,
  MUTATION_STRATEGIES,
  type CrossoverRecordingFn,
  type CrossoverResult,
} from './operators';

/**
 * Fraction of the population that must be inside the win radius
 * simultaneously for the EA to be considered solved.
 * Scales automatically with populationSize so the difficulty stays
 * consistent regardless of how many individuals are in the population.
 *
 * 0.10 = 10% -- e.g. 4 out of 40, near-impossible by chance but
 *               achieved quickly once the EA has genuinely converged.
 * Raise toward 0.25 for a stricter win condition.
 * Lower toward 0.05 for a looser one.
 *
 * This is now configurable per-race via `EAConfig.winPopulationFraction`;
 * the constant below is only a fallback for configs missing the field.
 */
const WIN_POPULATION_FRACTION = 0.10;

export interface EACallbacks {
  onGeneration: (generation: Generation) => void;
  onSolved:     (generation: Generation, totalGenerations: number) => void;
  onExhausted:  (totalGenerations: number, best: Individual) => void;
}

// ── Fix 1: correct union type syntax (was = instead of |) ─────────────────
export type StepResult =
  | { type: 'generation'; generation: Generation; replay?: ReplayFrame[] }
  | { type: 'solved';     generation: Generation; totalGenerations: number; replay?: ReplayFrame[] }
  | { type: 'exhausted';  totalGenerations: number; best: Individual };

export interface EAStepper {
  step: (n: number) => StepResult;
  currentGenIndex: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  crossover:   CrossoverRecordingFn,
  mutate:      (coord: import('../../types/map').Coordinate, gen: number, cfg: EAConfig, rng: RNG) => import('../../types/map').Coordinate,
  problem:     ProblemInstance,
  rng:         RNG,
): { next: Individual[]; record?: BreedingRecord } {
  const eliteCount = Math.max(1, Math.floor(config.populationSize * 0.05));
  const next: Individual[] = population.slice(0, eliteCount);
  let record: BreedingRecord | undefined;

  while (next.length < config.populationSize) {
    // The first non-elite child is the one the replay walks through.
    const isReplayChild = next.length === eliteCount;

    const parentA = select(population, rng);
    const parentB = select(population, rng);

    const didCrossover = rng() < config.crossoverRate;
    const crossed: CrossoverResult = didCrossover
      ? crossover(parentA, parentB, rng)
      : { coord: { ...parentA.position } };
    const beforeMutation = crossed.coord;

    const didMutate = rng() < config.mutationRate;
    const childCoord = didMutate
      ? mutate(beforeMutation, genIndex, config, rng)
      : beforeMutation;

    const child = evaluate(clamp(childCoord, problem), problem);
    next.push(child);

    if (isReplayChild) {
      record = {
        parentA,
        parentB,
        didCrossover,
        alpha:          crossed.alpha,
        geneSource:     crossed.geneSource,
        beforeMutation,
        didMutate,
        child,
      };
    }
  }

  return { next, record };
}

// ── Stateful stepper ──────────────────────────────────────────────────────

export function createEAStepper(
  problem: ProblemInstance,
  config:  EAConfig,
  seed?:   number,
): EAStepper {
  const rng       = makeLCG(seed);
  const select    = SELECTION_STRATEGIES[config.selectionStrategy];
  const crossover = CROSSOVER_STRATEGIES_RECORDING[config.crossoverStrategy];
  const mutate    = MUTATION_STRATEGIES[config.mutationStrategy];

  let population: Individual[] = Array.from(
    { length: config.populationSize },
    () => createRandom(problem, rng),
  );
  let genIndex  = 0;
  let hasSolved = false;
  // Replay frames for the breeding that produced the CURRENT `population`
  // (previous generation → current). Undefined for the initial random
  // generation, which was never bred. This is paired with each reported
  // generation so the replay's final frame shows exactly that generation's
  // dots — keeping "Watch Last Replay" aligned with "Watch EA Movement"
  // instead of one generation ahead.
  let producingReplay: ReplayFrame[] | undefined;

  const step = (n: number): StepResult => {
    // n = 0 just returns current state without advancing
    if (n === 0) {
      return { type: 'generation', generation: summarise(population, genIndex), replay: producingReplay };
    }

    let lastResult: StepResult = { type: 'generation', generation: summarise(population, genIndex), replay: producingReplay };

    for (let i = 0; i < n; i++) {
      if (genIndex >= config.maxGenerations) {
        population.sort((a, b) => a.fitness - b.fitness);
        return { type: 'exhausted', totalGenerations: genIndex, best: population[0] };
      }

      population.sort((a, b) => a.fitness - b.fitness);
      const generation = summarise(population, genIndex);

      // The replay paired with THIS generation is the one that produced it
      // (previous generation → this one), so its final frame matches these
      // dots. The breeding of this generation into the next is computed below
      // and carried forward to pair with the next generation.
      const replayForThisGen = producingReplay;

      const eliteCount = Math.max(1, Math.floor(config.populationSize * 0.05));
      const winFraction = config.winPopulationFraction ?? WIN_POPULATION_FRACTION;
      const threshold  = Math.max(2, Math.ceil(config.populationSize * winFraction));
      const { next: nextPop, record } = breedNext(population, config, genIndex, select, crossover, mutate, problem, rng);
      producingReplay  = buildReplayFrames(population, nextPop, eliteCount, config, threshold, record);
      population = nextPop;
      genIndex++;

      const solutionCount = generation.individuals.filter((ind) => ind.isSolution).length;
      if (solutionCount >= threshold && !hasSolved) {
        hasSolved = true;
        return { type: 'solved', generation, totalGenerations: genIndex, replay: replayForThisGen };
      }

      lastResult = { type: 'generation', generation, replay: replayForThisGen };
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