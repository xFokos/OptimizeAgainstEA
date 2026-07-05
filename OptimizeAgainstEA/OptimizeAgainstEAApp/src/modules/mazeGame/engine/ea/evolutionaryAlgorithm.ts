import type { MazeProblem } from '../../types/maze';
import type { EAConfig, Generation, Individual, RNG } from '../../types/ea';
import { createRandom, evaluate, repair } from './individual';
import {
  SELECTION_STRATEGIES,
  CROSSOVER_STRATEGIES_RECORDING,
  MUTATION_STRATEGIES,
} from './operators';
import { makeLCG } from '../rng';
import { createNoveltyScorer, type NoveltyScorer } from './novelty';
import { buildReplayFrames, type ReplayFrame, type BreedingRecord } from './eaReplayLog';

/** Fallback win fraction if a config is missing the field (see BattleShips). */
const WIN_POPULATION_FRACTION = 0.10;

export type StepResult =
  | { type: 'generation'; generation: Generation; replay?: ReplayFrame[] }
  | { type: 'solved';     generation: Generation; totalGenerations: number; replay?: ReplayFrame[] }
  | { type: 'exhausted';  totalGenerations: number; best: Individual };

export interface EAStepper {
  step: (n: number) => StepResult;
  currentGenIndex: () => number;
  /**
   * Swap in new tuning without discarding the population. If `nextProblem` is
   * given (fitness function or break-on-wall changed), the whole population is
   * re-walked and re-scored under it. The new config is used from the next step.
   */
  updateConfig: (nextConfig: EAConfig, nextProblem?: MazeProblem) => void;
}

function summarise(individuals: Individual[], index: number): Generation {
  const sorted = [...individuals].sort((a, b) => a.fitness - b.fitness);
  const mean = individuals.reduce((s, i) => s + i.fitness, 0) / individuals.length;
  return { index, individuals: sorted, best: sorted[0], meanFitness: mean };
}

function breedNext(
  population: Individual[],
  config: EAConfig,
  genIndex: number,
  problem: MazeProblem,
  rng: RNG,
): { next: Individual[]; record?: BreedingRecord } {
  const select = SELECTION_STRATEGIES[config.selectionStrategy];
  const crossover = CROSSOVER_STRATEGIES_RECORDING[config.crossoverStrategy];
  const mutate = MUTATION_STRATEGIES[config.mutationStrategy];

  const eliteCount = Math.max(1, Math.floor(config.populationSize * 0.05));
  const next: Individual[] = population.slice(0, eliteCount);
  let record: BreedingRecord | undefined;

  while (next.length < config.populationSize) {
    // The first non-elite child is the one the replay walks through.
    const isReplayChild = next.length === eliteCount;

    const parentA = select(population, rng);
    const parentB = select(population, rng);

    const didCrossover = rng() < config.crossoverRate;
    const crossed = didCrossover
      ? crossover(parentA, parentB, rng)
      : { path: parentA.path.slice() };
    const beforeMutation = crossed.path;

    const didMutate = rng() < config.mutationRate;
    const mutated = didMutate
      ? mutate(beforeMutation, genIndex, config, rng)
      : { path: beforeMutation, mutatedIndices: [] as number[] };

    const child = evaluate(repair(mutated.path, problem, rng), problem, rng);
    next.push(child);

    if (isReplayChild) {
      record = {
        parentA,
        parentB,
        didCrossover,
        cut: crossed.cut,
        geneMask: crossed.geneMask,
        beforeMutation,
        didMutate,
        mutatedIndices: mutated.mutatedIndices,
        child,
      };
    }
  }

  return { next, record };
}

export function createMazeEAStepper(
  initialProblem: MazeProblem,
  initialConfig: EAConfig,
  seed?: number,
): EAStepper {
  const rng = makeLCG(seed);

  // Mutable so tuning / the fitness function can change mid-run (see updateConfig).
  let problem = initialProblem;
  let config = initialConfig;

  // Novelty search scores the whole population against an archive, so it can't
  // be a pure per-individual evaluate(); apply a stateful scorer each gen.
  let noveltyScorer: NoveltyScorer | null =
    problem.fitnessFnId === 'novelty' ? createNoveltyScorer(problem.cols, problem.rows) : null;

  let population: Individual[] = Array.from(
    { length: config.populationSize },
    () => createRandom(problem, rng),
  );
  noveltyScorer?.score(population);
  let genIndex = 0;
  let hasSolved = false;

  const updateConfig = (nextConfig: EAConfig, nextProblem?: MazeProblem) => {
    config = nextConfig;
    if (nextProblem) {
      problem = nextProblem;
      // A changed objective / walk rule invalidates every cached fitness, so
      // re-walk and re-score the current population under the new problem. The
      // genomes are kept — only their phenotype and score are recomputed.
      noveltyScorer =
        problem.fitnessFnId === 'novelty' ? createNoveltyScorer(problem.cols, problem.rows) : null;
      population = population.map((ind) => evaluate(ind.path, problem, rng));
      noveltyScorer?.score(population);
    }
  };

  const step = (n: number): StepResult => {
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

      const eliteCount = Math.max(1, Math.floor(config.populationSize * 0.05));
      const winFraction = config.winPopulationFraction ?? WIN_POPULATION_FRACTION;
      // Novelty spreads the population out, so it never piles a fraction onto the
      // goal — for it, "solved" means a single explorer found the exit.
      const threshold = config.fitnessFnId === 'novelty'
        ? 1
        : Math.max(2, Math.ceil(config.populationSize * winFraction));
      const { next: nextPop, record } = breedNext(population, config, genIndex, problem, rng);
      noveltyScorer?.score(nextPop);
      const replay = buildReplayFrames(population, nextPop, eliteCount, config, threshold, record);
      population = nextPop;
      genIndex++;

      const solutionCount = generation.individuals.filter((ind) => ind.isSolution).length;
      if (solutionCount >= threshold && !hasSolved) {
        hasSolved = true;
        return { type: 'solved', generation, totalGenerations: genIndex, replay };
      }

      lastResult = { type: 'generation', generation, replay };
    }

    return lastResult;
  };

  return { step, currentGenIndex: () => genIndex, updateConfig };
}
