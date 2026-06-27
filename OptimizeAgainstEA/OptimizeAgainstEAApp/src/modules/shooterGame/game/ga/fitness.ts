import type { RoundStats } from '../../shooter.types';

// ---- Fitness Berechnung ----
// Höher = besser. Der GA maximiert diesen Wert.

export function calculateFitness(stats: RoundStats): number {

    return (
        stats.hitsLanded      * 100    // Treffer auf Spieler → wichtigstes Kriterium
      - stats.hitsReceived    * 100    // Selbst getroffen → gleich wie Treffer landen
    );
}

// Fitness normalisieren auf 0–1 (nützlich für Selektion)
export function normalizeFitness(fitnesses: number[]): number[] {
    const min = Math.min(...fitnesses);
    const max = Math.max(...fitnesses);
    const range = max - min;

    if (range === 0) return fitnesses.map(() => 1 / fitnesses.length);
    return fitnesses.map(f => (f - min) / range);
}
