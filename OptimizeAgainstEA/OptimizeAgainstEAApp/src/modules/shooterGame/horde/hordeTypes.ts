import type { PlayerState, Bullet, Population, DNA } from '../shooter.types';
import type { Vector2D } from '../game/core/vec';

export type HordePhase = 'playing' | 'dead';

export interface HordeAgent {
    id:          number;
    popIndex:    number;     // slot in population this agent maps to
    dna:         DNA;
    position:    Vector2D;
    velocity:    Vector2D;
    rotation:    number;
    alive:       boolean;
    closestDist: number;
    wanderAngle: number;     // slowly drifting angle for planlos movement
    stuckTimer:  number;     // seconds spent pressed against a wall
    loopIndex:   number;     // current step in the evolved movement loop
    loopTimer:   number;     // seconds remaining in the current loop step
    isElite:     boolean;    // reincarnated with unchanged DNA — its fitness gets smoothed across lives
}

export interface HordeGameState {
    phase:      HordePhase;
    score:      number;      // total kills
    generation: number;      // total agents spawned so far (including initial)
    agents:     HordeAgent[];
    player:     PlayerState;
    bullets:    Bullet[];
    population: Population;  // same size as maxOnField; each slot = one field position
    maxOnField: number;
}
