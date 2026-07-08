import type { FitnessFnId, Path, SerializedMaze, WalkResult, WallRule } from './maze';

/**
 * Discrete-genome EA types. Mirrors BattleShips' types/ea.ts in shape, but an
 * Individual carries a `path` (+ cached `walk`) instead of an (x,y) position.
 */

export interface Individual {
  path: Path;
  /** Cached phenotype so renders / replay don't re-simulate the walk. */
  walk: WalkResult;
  fitness: number;
  isSolution: boolean;
}

export interface Generation {
  index: number;
  individuals: Individual[];
  best: Individual;
  meanFitness: number;
}

export type RNG = () => number;

export type SelectionFn = (population: Individual[], rng: RNG) => Individual;

export type SelectionStrategy = 'tournament' | 'roulette' | 'elitist';
export type CrossoverStrategy = 'singlePoint' | 'uniform';
export type MutationStrategy = 'point' | 'segment';

export interface EAConfig {
  populationSize: number;
  maxGenerations: number;
  crossoverRate: number;
  mutationRate: number;
  /** For maze mutation, strength is read as a per-gene re-pick probability. */
  mutationStrength: number;
  mutationDecay: number;
  /** Fraction of the population that must reach the goal for the EA to count as solved. */
  winPopulationFraction: number;
  selectionStrategy: SelectionStrategy;
  crossoverStrategy: CrossoverStrategy;
  mutationStrategy: MutationStrategy;
  /** Which fitness function the maze problem evaluates against. */
  fitnessFnId: FitnessFnId;
  /** How a blocked move is handled: waste it, crash, or repair the gene. */
  wallRule: WallRule;
  /**
   * Genome length as a multiple of the maze's shortest path (≥ 1; capped at
   * MAX_PATH_LENGTH). ×1 means the EA must evolve a perfect move string.
   * Baked into the problem at build time — changing it restarts the run.
   */
  pathLengthFactor: number;
}

/** Default genome-length multiplier — enough slack for wasted moves and detours. */
export const DEFAULT_PATH_LENGTH_FACTOR = 3.5;

export const DEFAULT_MAZE_EA_CONFIG: EAConfig = {
  populationSize: 100,
  maxGenerations: 300,
  crossoverRate: 0.85,
  mutationRate: 0.95,
  // For maze point-mutation, strength is the per-gene re-pick probability; a
  // small flat value (no decay) keeps exploration alive across generations.
  mutationStrength: 0.06,
  mutationDecay: 1.0,
  winPopulationFraction: 0.08,
  selectionStrategy: 'tournament',
  crossoverStrategy: 'singlePoint',
  mutationStrategy: 'point',
  fitnessFnId: 'geodesic',
  wallRule: 'waste',
  pathLengthFactor: DEFAULT_PATH_LENGTH_FACTOR,
};

import type { ReplayFrame } from '../engine/ea/eaReplayLog';

export type WorkerInMessage =
  // `maze` (a hand-built creator maze) takes precedence; otherwise the maze is
  // generated procedurally from seed + cols/rows.
  | { type: 'START'; config: EAConfig; seed: number; cols: number; rows: number; maze?: SerializedMaze }
  | { type: 'STEP'; count: number }
  // Apply new tuning to the running EA; takes effect on the next generation.
  | { type: 'UPDATE_CONFIG'; config: EAConfig }
  | { type: 'STOP' };

export type WorkerOutMessage =
  | { type: 'GENERATION'; generation: Generation; replay?: ReplayFrame[] }
  | { type: 'SOLVED'; generation: Generation; totalGenerations: number; replay?: ReplayFrame[] }
  | { type: 'EXHAUSTED'; totalGenerations: number; best: Individual }
  | { type: 'ERROR'; message: string };
