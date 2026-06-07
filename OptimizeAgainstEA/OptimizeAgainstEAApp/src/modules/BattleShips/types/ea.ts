import type { Coordinate } from './map';

export interface Individual {
  position: Coordinate;
  fitness: number;
  isSolution: boolean;
}

export interface Generation {
  index: number;
  individuals: Individual[];
  best: Individual;
  meanFitness: number;
}

export type SelectionFn = (population: Individual[], rng: RNG) => Individual;
export type CrossoverFn = (a: Individual, b: Individual, rng: RNG) => Coordinate;
export type MutationFn = (
  coord: Coordinate,
  generationIndex: number,
  config: EAConfig,
  rng: RNG,
) => Coordinate;

export type RNG = () => number;

export interface EAConfig {
  populationSize:   number;
  maxGenerations:   number;
  crossoverRate:    number;
  mutationRate:     number;
  mutationStrength: number;
  mutationDecay:    number;
  selectionStrategy:  SelectionStrategy;
  crossoverStrategy:  CrossoverStrategy;
  mutationStrategy:   MutationStrategy;
}

export type SelectionStrategy = 'tournament' | 'roulette' | 'elitist';
export type CrossoverStrategy = 'uniform'    | 'arithmetic' | 'singlePoint';
export type MutationStrategy  = 'gaussian'   | 'uniform'    | 'cauchy';

export const DEFAULT_EA_CONFIG: EAConfig = {
  populationSize:     40,
  maxGenerations:     200,
  crossoverRate:      0.8,
  mutationRate:       0.3,
  mutationStrength:   0.25,
  mutationDecay:      0.97,
  selectionStrategy:  'tournament',
  crossoverStrategy:  'arithmetic',
  mutationStrategy:   'gaussian',
};

export interface SerializedMinima {
  positions: Array<{ x: number; y: number; isGlobal: boolean }>;
}

export type WorkerInMessage =
  | { type: 'START'; config: EAConfig; minima: SerializedMinima; winRadius: number }
  | { type: 'STEP';  count: number }
  | { type: 'STOP' };

export type WorkerOutMessage =
  | { type: 'GENERATION'; generation: Generation; replay?: import('../engine/ea/eaReplayLog').ReplayFrame[] }
  | { type: 'SOLVED';     generation: Generation; totalGenerations: number; replay?: import('../engine/ea/eaReplayLog').ReplayFrame[] }
  | { type: 'EXHAUSTED';  totalGenerations: number; best: Individual }
  | { type: 'ERROR';      message: string };