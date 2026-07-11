import { DNA_LENGTH, TUTORIAL_DNA, type DNA } from '../shooter.types';

// Horde's DNA layout beyond the shared base genes (DNA_INDEX, length DNA_LENGTH):
//   [...base genes, ...LOOP_STEPS loop-offset genes, size, opacity, ...4 spawn-side weights]
//
// Lives in its own module (not HordeCanvas.tsx) purely so it can be imported
// from both HordeCanvas (drives agent behaviour) and the lobby overview
// (reads the same layout to display the current run's best agent) without
// dragging the canvas component's code along — and so HordeCanvas.tsx stays
// component-only, which react-refresh/Fast Refresh requires for hot reload.

export const LOOP_STEPS         = 4;
export const LOOP_STEP_DURATION = 0.6;                  // seconds per step
export const LOOP_MAX_ANGLE_RAD = (70 * Math.PI) / 180; // max rotation per step
export const LOOP_GENE_START    = DNA_LENGTH;            // loop genes sit right after the shared DNA genes

export function loopOffsetRad(gene: number): number {
    return (gene - 0.5) * 2 * LOOP_MAX_ANGLE_RAD;
}

// Size/opacity genes: an evolvable body — smaller & more transparent agents are
// genuinely harder to hit, so there's a real, emergent selection pressure
// toward shrinking/fading where that out-survives having to get closer.
export const SIZE_GENE_INDEX    = LOOP_GENE_START + LOOP_STEPS;
export const OPACITY_GENE_INDEX = SIZE_GENE_INDEX + 1;

// How much of the full DNA array a player's Horde "Starter DNA" setting
// actually covers: base genes + movement loop + size + opacity. Spawn-side
// weights (4 genes right after this) are deliberately excluded — always
// randomized fresh per spawn, not something a player biases up front.
export const HORDE_STARTER_DNA_LENGTH = OPACITY_GENE_INDEX + 1;

// Tutorial swarm: reuses Solo's inert-target base genes (AGGRESSION/MOVEMENT_SPEED/
// DODGE_WEIGHT all 0) so agents never approach or evade — completely harmless,
// safe to practice against. Loop offsets are neutral (no zigzag on a stationary
// agent anyway); size/opacity are mid-range so they're clearly visible targets.
export const HORDE_TUTORIAL_DNA: DNA = [
    ...TUTORIAL_DNA,
    ...Array.from({ length: LOOP_STEPS }, () => 0.5), // loop offsets — neutral (irrelevant at 0 speed)
    0.5, // size — average, easy to see
    0.9, // opacity — fully visible
];
