import type { RoundStats } from '../../shooter.types';

// ---- Fitness Berechnung ----
// Höher = besser. Der GA maximiert diesen Wert.

export function calculateFitness(stats: RoundStats): number {
    // Genauigkeit: Treffer / Schüsse (0–1), nur wenn geschossen wurde
    const accuracy = stats.bulletsFired > 0
        ? stats.hitsLanded / stats.bulletsFired
        : 0;

    // Durchschnittliche Distanz zum Spieler
    const avgDistance = stats.distanceSamples > 0
        ? stats.distanceSum / stats.distanceSamples
        : 0;

    return (
        stats.hitsLanded      * 100    // Treffer auf Spieler → wichtigstes Kriterium
      - stats.hitsReceived    *  80    // Selbst getroffen → stark bestrafen
      + accuracy              *  50    // Gute Genauigkeit belohnen
      + stats.timeAlive       *   2    // Überleben belohnen
      + stats.dodgedBullets   *  15    // Aktives Ausweichen belohnen
      - avgDistance           *   0.05 // Zu passives Campen leicht bestrafen
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
