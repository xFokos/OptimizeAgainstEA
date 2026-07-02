import type { Coordinate } from './map';
import type { ProblemSource } from '../engine/problemCode';

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
  /** Fraction of the population that must sit inside the win radius for the EA to count as solved. */
  winPopulationFraction: number;
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
  winPopulationFraction: 0.10,
  selectionStrategy:  'tournament',
  crossoverStrategy:  'arithmetic',
  mutationStrategy:   'gaussian',
};

/**
 * A one-click difficulty preset for the Vs-EA race. Bundles the EA config plus
 * the player's probe reveal radius.
 *
 * Difficulty scales the *opponent*: harder presets give the EA a bigger, more
 * aggressive search (larger population, stronger mutation) and reveal less of
 * the surface to the player.
 *
 * `maxGenerations` and gens-per-probe are fixed app defaults (not part of a
 * preset), so the config here omits maxGenerations.
 */
export interface EAPreset {
  id:           'easy' | 'normal' | 'hard' | 'expert';
  label:        string;
  config:       Omit<EAConfig, 'maxGenerations'>;
  revealRadius: number;
}

export const EA_PRESETS: EAPreset[] = [
  {
    id: 'easy',
    label: 'Easy',
    revealRadius: 0.08,
    config: {
      populationSize: 30,
      crossoverRate: 0.6, mutationRate: 0.2,
      mutationStrength: 0.15, mutationDecay: 0.95,
      winPopulationFraction: 0.60,
      selectionStrategy: 'roulette', crossoverStrategy: 'singlePoint', mutationStrategy: 'uniform',
    },
  },
  {
    id: 'normal',
    label: 'Normal',
    revealRadius: 0.05,
    config: {
      populationSize: 30,
      crossoverRate: 0.7, mutationRate: 0.3,
      mutationStrength: 0.25, mutationDecay: 0.90,
      winPopulationFraction: 0.35,
      selectionStrategy: 'elitist', crossoverStrategy: 'uniform', mutationStrategy: 'gaussian',
    },
  },
  {
    id: 'hard',
    label: 'Hard',
    revealRadius: 0.04,
    config: {
      populationSize: 50,
      crossoverRate: 0.8, mutationRate: 0.4,
      mutationStrength: 0.35, mutationDecay: 0.850,
      winPopulationFraction: 0.25,
      selectionStrategy: 'tournament', crossoverStrategy: 'arithmetic', mutationStrategy: 'cauchy',
    },
  },
  {
    id: 'expert',
    label: 'Expert',
    revealRadius: 0.03,
    config: {
      populationSize: 100,
      crossoverRate: 0.9, mutationRate: 0.35,
      mutationStrength: 0.4, mutationDecay: 0.99,
      winPopulationFraction: 0.15,
      selectionStrategy: 'tournament', crossoverStrategy: 'arithmetic', mutationStrategy: 'uniform',
    },
  },
];

export type WorkerInMessage =
  | { type: 'START'; config: EAConfig; source: ProblemSource }
  | { type: 'STEP';  count: number }
  | { type: 'STOP' };

export type WorkerOutMessage =
  | { type: 'GENERATION'; generation: Generation; replay?: import('../engine/ea/eaReplayLog').ReplayFrame[] }
  | { type: 'SOLVED';     generation: Generation; totalGenerations: number; replay?: import('../engine/ea/eaReplayLog').ReplayFrame[] }
  | { type: 'EXHAUSTED';  totalGenerations: number; best: Individual }
  | { type: 'ERROR';      message: string };