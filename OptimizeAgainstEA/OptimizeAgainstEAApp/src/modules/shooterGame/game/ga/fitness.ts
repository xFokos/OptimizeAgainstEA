import type { RoundStats } from '../../shooter.types';

// ---- Fitness Berechnung ----
// Höher = besser. Der GA maximiert diesen Wert.

export function calculateFitness(stats: RoundStats): number {
    const net = stats.hitsLanded - stats.hitsReceived;
    const outcomeBonus = net > 0 ? 120 : net < 0 ? -80 : 0;
    return (
        stats.hitsLanded   * 100
      - stats.hitsReceived * 100
      + outcomeBonus
    );
}

// Raidboss-Fitness: wie gut hat sich der Boss gegen einen echten Spieler geschlagen?
export function calculateRaidbossFitness(stats: RoundStats, roundDuration: number): number {
    // Treffer-Bilanz: Kern der Fitness
    const hitScore = (stats.hitsLanded - stats.hitsReceived) * 100;

    // Survival-Bonus: Runden die länger dauern → Boss hat Druck standgehalten
    // Max +60 wenn volle Runde überlebt (zeitbasierter Abschluss statt frühem Tug-of-War)
    const survivalBonus = roundDuration > 0
        ? (stats.timeAlive / roundDuration) * 60
        : 0;

    // Win/Lose-Bonus: flacher Aufschlag basierend auf Netto-Treffern
    // Nicht zu groß, damit die Treffer-Bilanz das Hauptsignal bleibt
    const net = stats.hitsLanded - stats.hitsReceived;
    const outcomeBonus = net > 0 ? 120 : net < 0 ? -80 : 0;

    return hitScore + survivalBonus + outcomeBonus;
}

// Fitness normalisieren auf 0–1 (nützlich für Selektion)
export function normalizeFitness(fitnesses: number[]): number[] {
    const min = Math.min(...fitnesses);
    const max = Math.max(...fitnesses);
    const range = max - min;

    if (range === 0) return fitnesses.map(() => 1 / fitnesses.length);
    return fitnesses.map(f => (f - min) / range);
}
