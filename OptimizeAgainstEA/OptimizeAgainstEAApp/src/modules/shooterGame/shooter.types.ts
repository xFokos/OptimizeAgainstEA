import type {Vector2D} from './game/core/vec';

// ---- Spielfeld ----

export const ARENA = {
    WIDTH:  800,
    HEIGHT: 800,
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
    PREDICT_LEAD:   5, // 0–1: wie stark er den Spieler "predicted" beim Zielen
    FIRE_RATE:      6, // 0-1: Wie schnell der Agent schießt
} as const;


export const DNA_NAMES = Object.keys(DNA_INDEX) as (keyof typeof DNA_INDEX)[];

export const DNA_LENGTH = Object.keys(DNA_INDEX).length; // = 7

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
    dodgeSide: 1 | -1;
    dodgeSideTimer: number;
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
    dodgedBulletIds:  string[];
}

export const emptyStats = (): RoundStats => ({
    hitsLanded:      0,
    hitsReceived:    0,
    bulletsFired:    0,
    timeAlive:       0,
    dodgedBullets:   0,
    distanceSum:     0,
    distanceSamples: 0,
    dodgedBulletIds:  [],
});

// ---- Game State ----

export type GamePhase =
    | 'idle'        // Startbildschirm
    | 'playing'     // Runde läuft
    | 'roundEnd'    // Runde vorbei, zeige Summary
    | 'evolving';   // GA rechnet neue Generation (kurz)

export interface GameState {
    phase:          GamePhase;
    roundTimer:     number;
    roundNumber:    number;
    player:         PlayerState;
    agent:          AgentState;
    bullets:        Bullet[];
    population:     Population | null;
    ghostFrames:    PlayerGhostFrame[];
    lastAgentFrame: AgentGhostFrame | null;
}

// ---- Input ----

export interface InputState {
    up:     boolean;
    down:   boolean;
    left:   boolean;
    right:  boolean;
    shoot:  boolean;
    mouseX: number;
    mouseY: number;
}

// ---- Konfiguration ----

export const GAME_CONFIG = {
    ROUND_DURATION:    20,   // Sekunden
    POPULATION_SIZE:   20,
    ELITE_COUNT:       4,    // Top-N die direkt überleben
    MUTATION_RATE:     0.1,  // 10 % Chance pro Gen-Wert
    MUTATION_STRENGTH: 0.2,  // wie stark ein Wert sich ändert
    BULLET_SPEED:      500,  // px/s
    BULLET_LIFETIME:   2,    // Sekunden
    SHOOT_COOLDOWN:    0.4,  // Sekunden zwischen Schüssen
    SHOOT_COOLDOWN_MIN: 0.3,  // minimal so schnell möglich
    SHOOT_COOLDOWN_MAX: 1.5,  // maximal so schnell möglich
    AGENT_SPEED_BASE:   40,  // Der Agent hat mindestens diesen Speed
    AGENT_SPEED_BONUS:   80,  //Der Agent bekommt je nach DNA Teil von diesem Wert als Bonus
    PLAYER_SPEED:      320,  // px/s
    PLAYER_RADIUS:     18,
    AGENT_RADIUS:      18,
    BULLET_RADIUS:     5,
    NEAR_MISS_RADIUS:  40,   // px – ab hier zählt's als "ausgewichen"
} as const;

export const STARTER_DNA: DNA = [
    0.1,  // AGGRESSION     – sehr passiv
    0.1,  // DODGE_WEIGHT   – weicht kaum aus
    0.1,  // SHOOT_ACCURACY – sehr ungenau
    0.3 ,  // PREFERRED_RANGE – bleibt nah
    0.1,  // MOVEMENT_SPEED – sehr langsam
    0.1,  // PREDICT_LEAD   – kein Vorauszielen
    0.1,  // FIRE_RATE      – schießt sehr langsam
];

// ---- Player Ghosting ----
export interface PlayerGhostFrame {
    position: Vector2D;
    velocity: Vector2D;
    rotation: number;
    shot:     boolean;
    time:     number;
}

export interface AgentGhostFrame {
    position: Vector2D;
    rotation: number;
    shot:     boolean;
}

export interface PlayerGhost {
    frames:        PlayerGhostFrame[];
    roundDuration: number;
}