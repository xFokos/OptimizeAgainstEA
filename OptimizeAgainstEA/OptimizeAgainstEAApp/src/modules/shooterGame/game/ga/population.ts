import type { Population, Individual } from '../../shooter.types';
import { DNA_LENGTH, GAME_CONFIG, STARTER_DNA } from '../../shooter.types';

// Zufällige DNA generieren – alle Werte zwischen 0 und 1
export function randomDNA(): number[] {
    return Array.from({ length: DNA_LENGTH }, () => Math.random());
}

// Erste Generation
export function initPopulation(): Population {
    const individuals: Individual[] = Array.from(
        { length: GAME_CONFIG.POPULATION_SIZE },
        () => ({ dna: STARTER_DNA.map(v =>
                Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1))
            ),
            fitness: 0
        })
    );

    return {
        generation:  1,
        individuals,
        bestFitness: 0,
        avgFitness:  0,
    };
}

// Statistiken nach einer Runde aktualisieren
export function updatePopulationStats(population: Population): Population {
    const fitnesses = population.individuals.map(i => i.fitness);
    const best = Math.max(...fitnesses);
    const avg  = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

    return {
        ...population,
        bestFitness: best,
        avgFitness:  Math.round(avg),
    };
}

// Besten Individual aus der Population holen
export function getBestIndividual(population: Population): Individual {
    return population.individuals.reduce((best, current) =>
        current.fitness > best.fitness ? current : best
    );
}
