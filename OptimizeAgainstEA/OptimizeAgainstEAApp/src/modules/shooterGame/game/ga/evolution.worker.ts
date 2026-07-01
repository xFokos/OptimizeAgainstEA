import type { Population, PlayerGhost } from '../../shooter.types';
import { presimulateAgainstGhost, evolve } from './evolution';

export type EvolutionWorkerIn = {
    type:                'PRESIM';
    ghost:               PlayerGhost;
    hofGhost?:           PlayerGhost;
    population:          Population;
    generations:         number;
    mutationRate:        number;
    mutationStrength:    number;
    crossoverType:       'uniform' | 'single-point';
    realFitness:         number;
    injectionDeviation:  number;
};

export type EvolutionWorkerOut =
    | { type: 'DONE';  population: Population }
    | { type: 'ERROR'; message: string };

self.onmessage = (event: MessageEvent<EvolutionWorkerIn>) => {
    const { type, ghost, hofGhost, population, generations, mutationRate, mutationStrength, crossoverType, realFitness, injectionDeviation } = event.data;
    if (type !== 'PRESIM') return;

    try {
        const ghostPop = generations > 0 && ghost.frames.length > 0
            ? presimulateAgainstGhost(generations, ghost, population, crossoverType, hofGhost)
            : population;

        const evolved = evolve(ghostPop, realFitness, mutationRate, mutationStrength, crossoverType, injectionDeviation);

        (self as unknown as Worker).postMessage({ type: 'DONE', population: evolved } satisfies EvolutionWorkerOut);
    } catch (err) {
        (self as unknown as Worker).postMessage({
            type:    'ERROR',
            message: err instanceof Error ? err.message : 'Evolution fehlgeschlagen',
        } satisfies EvolutionWorkerOut);
    }
};
