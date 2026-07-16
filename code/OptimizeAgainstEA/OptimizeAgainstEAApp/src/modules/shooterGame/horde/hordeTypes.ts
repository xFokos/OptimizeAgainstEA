import type { PlayerState, Bullet, Population, DNA } from '../shooter.types';
import type { Vector2D } from '../game/core/vec';

export type HordePhase = 'playing' | 'dead' | 'choosing';

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

export interface HordeObstacle {
    x:             number;
    y:             number;
    w:             number;
    h:             number;
    blocksBullets: boolean; // true = cover (stops bullets too); false = movement-only barrier
}

export type HordeSpawnSide = 'top' | 'right' | 'bottom' | 'left';

export interface HordeMap {
    id:          string;
    label:       string;
    description: string;
    obstacles:   HordeObstacle[];
    spawnSides:  HordeSpawnSide[]; // which perimeter sides agents may spawn from on this map
    playerSpawn: Vector2D;         // where the player starts — built-in maps default to arena center
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
    map:        HordeMap;
}
