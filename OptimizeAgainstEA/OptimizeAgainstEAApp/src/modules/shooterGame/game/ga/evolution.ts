import type { Population, Individual } from '../../shooter.types';
import { GAME_CONFIG, DNA_LENGTH } from '../../shooter.types';
import { updatePopulationStats } from './population';

// ---- Selektion ----
// Tournament Selection: zufällig N Kandidaten wählen, besten nehmen
// Fairer als "immer die Top-2" weil auch schwächere Individuen eine Chance haben
function tournamentSelect(individuals: Individual[], tournamentSize = 3): Individual {
    const candidates = Array.from({ length: tournamentSize }, () =>
        individuals[Math.floor(Math.random() * individuals.length)]
    );
    return candidates.reduce((best, c) => c.fitness > best.fitness ? c : best);
}

// ---- Crossover ----
// Single-Point: DNA von parent1 bis zu einem Punkt, dann rest von parent2
// Beispiel: [A,A,A,A,A] + [B,B,B,B,B] → [A,A,B,B,B] (Punkt bei index 2)
function crossover(dnaA: number[], dnaB: number[]): number[] {
    const point = Math.floor(Math.random() * DNA_LENGTH);
    return [
        ...dnaA.slice(0, point),
        ...dnaB.slice(point),
    ];
}

// ---- Mutation ----
// Jeden Gen-Wert mit MUTATION_RATE Wahrscheinlichkeit leicht verändern
// clamp auf 0–1 damit DNA-Werte immer im gültigen Bereich bleiben
function mutate(dna: number[]): number[] {
    return dna.map(gene => {
        if (Math.random() < GAME_CONFIG.MUTATION_RATE) {
            const delta = (Math.random() * 2 - 1) * GAME_CONFIG.MUTATION_STRENGTH;
            return Math.max(0, Math.min(1, gene + delta));
        }
        return gene;
    });
}

// ---- Evolution ----
// Wird nach jeder Runde aufgerufen
// Gibt eine neue Population zurück – alte stirbt, neue entsteht
export function evolve(population: Population, agentFitness: number): Population {
    // 1. Fitness des letzten Agenten in die Population eintragen
    //    Wir nehmen an dass der aktive Agent der erste Individual ist
    const updatedIndividuals = [...population.individuals];
    updatedIndividuals[0] = {
        ...updatedIndividuals[0],
        fitness: agentFitness,
    };

    // 2. Nach Fitness sortieren (bester zuerst)
    const sorted = [...updatedIndividuals].sort((a, b) => b.fitness - a.fitness);

    // 3. Eliten direkt übernehmen (kein Crossover, keine Mutation)
    const elites = sorted.slice(0, GAME_CONFIG.ELITE_COUNT).map(i => ({ ...i }));

    // 4. Rest durch Crossover + Mutation auffüllen
    const offspring: Individual[] = [];
    while (offspring.length < GAME_CONFIG.POPULATION_SIZE - GAME_CONFIG.ELITE_COUNT) {
        const parent1 = tournamentSelect(sorted);
        const parent2 = tournamentSelect(sorted);
        const childDna = mutate(crossover(parent1.dna, parent2.dna));
        offspring.push({ dna: childDna, fitness: 0 });
    }

    const newPopulation: Population = {
        generation:  population.generation + 1,
        individuals: [...elites, ...offspring],
        bestFitness: 0,
        avgFitness:  0,
    };

    return updatePopulationStats(newPopulation);
}

// Nächsten Agenten aus der Population holen
// Wir rotieren durch die Individuals damit jeder mal dran ist
export function getNextAgent(population: Population, roundNumber: number): number[] {
    const index = (roundNumber - 1) % population.individuals.length;
    return population.individuals[index].dna;
}
