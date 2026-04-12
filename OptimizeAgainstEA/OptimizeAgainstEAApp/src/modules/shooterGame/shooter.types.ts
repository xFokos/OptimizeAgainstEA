import type {Vector2D} from './game/core/vec';

// ---- Spielfeld ----

export const ARENA = {
    WIDTH:  800,
    HEIGHT: 600,
    PADDING: 20, // Abstand von den Wänden
} as const;

// ---- DNA & Genetischer Algorithmus ----

// Index-Konstanten damit wir nie magic numbers im Code haben
export const DNA_INDEX = {
    AGGRESSION:     0, // 0–1: wie stark der Agent den Spieler verfolgt
    DODGE_WEIGHT:   1, // 0–1: wie stark er Bullets ausweicht
    SHOOT_ACCURACY: 2, // 0–1: Zielgenauigkeit (1 = perfekt)
    PREFERRED_RANGE:3, // 0–1: bevorzugter Kampfabstand (× 300px)
    MOVEMENT_SPEED: 4, // 0–1: Bewegungsgeschwindigkeit (× 200px/s)
    PREDICT_LEAD:   5, // 0–1: wie stark er den Spieler "leaded" beim Zielen
} as const;

export const DNA_LENGTH = Object.keys(DNA_INDEX).length; // = 6

export type DNA = number[]; // Float-Array der Länge DNA_LENGTH

export interface Individual {
    dna:     DNA;
    fitness: number;
}

export interface Population {
    generation:  number;
    individuals: Individual[];
    bestFitness: number;
    avgFitness:  number;
}

// ---- Entities ----

export interface Entity {
    position: Vector2D;
    velocity: Vector2D;
    rotation: number;   // in Radians, 0 = nach rechts
    radius:   number;   // für Kollisions-Detection (Kreis)
    health:   number;   // 0 = tot
}

export interface PlayerState extends Entity {
    id: 'player';
}

export interface AgentState extends Entity {
    id:    'agent';
    dna:   DNA;
    stats: RoundStats; // live stats während der Runde
    pendingBullet?: Bullet;
}

export interface Bullet {
    id:       string;       // unique ID für React keys
    position: Vector2D;
    velocity: Vector2D;
    ownerId:  'player' | 'agent';
    lifetime: number;       // Sekunden bis sie verschwindet
    radius:   number;
}

// ---- Stats & Fitness ----

export interface RoundStats {
    hitsLanded:    number; // Treffer auf Gegner
    hitsReceived:  number; // Selbst getroffen
    bulletsFired:  number;
    timeAlive:     number; // Sekunden
    dodgedBullets: number; // Bullets die nah vorbeigingen (<40px)
    distanceSum:   number; // Summe aller Distanzen (für Durchschnitt)
    distanceSamples: number;
}

export const emptyStats = (): RoundStats => ({
    hitsLanded:      0,
    hitsReceived:    0,
    bulletsFired:    0,
    timeAlive:       0,
    dodgedBullets:   0,
    distanceSum:     0,
    distanceSamples: 0,
});

// ---- Game State ----

export type GamePhase =
    | 'idle'        // Startbildschirm
    | 'playing'     // Runde läuft
    | 'roundEnd'    // Runde vorbei, zeige Summary
    | 'evolving';   // GA rechnet neue Generation (kurz)

export interface GameState {
    phase:       GamePhase;
    roundTimer:  number;        // Sekunden verbleibend
    roundNumber: number;
    player:      PlayerState;
    agent:       AgentState;
    bullets:     Bullet[];
    population:  Population | null;
}

// ---- Input ----

export interface InputState {
    up:    boolean;
    down:  boolean;
    left:  boolean;
    right: boolean;
    shoot: boolean; // Leertaste oder Mouse-Click
}

// ---- Konfiguration ----

export const GAME_CONFIG = {
    ROUND_DURATION:    60,   // Sekunden
    POPULATION_SIZE:   20,
    ELITE_COUNT:       4,    // Top-N die direkt überleben
    MUTATION_RATE:     0.1,  // 10% Chance pro Gen-Wert
    MUTATION_STRENGTH: 0.2,  // wie stark ein Wert sich ändert
    BULLET_SPEED:      400,  // px/s
    BULLET_LIFETIME:   2,    // Sekunden
    SHOOT_COOLDOWN:    0.4,  // Sekunden zwischen Schüssen
    PLAYER_SPEED:      220,  // px/s
    PLAYER_RADIUS:     18,
    AGENT_RADIUS:      18,
    BULLET_RADIUS:     5,
    NEAR_MISS_RADIUS:  40,   // px – ab hier zählt's als "ausgewichen"
} as const;