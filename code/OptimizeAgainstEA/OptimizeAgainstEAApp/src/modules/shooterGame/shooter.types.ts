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
    DODGE_WEIGHT:   1, // 0–1: Wahrscheinlichkeit pro Frame auszuweichen; Stärke kommt von MOVEMENT_SPEED
    SHOOT_ACCURACY: 2, // 0–1: Zielgenauigkeit (1 = perfekt)
    PREFERRED_RANGE:3, // 0–1: bevorzugter Kampfabstand (× 300px)
    MOVEMENT_SPEED: 4, // 0–1: Bewegungsgeschwindigkeit (× 200px/s)
    PREDICT_LEAD:   5, // 0–1: wie stark er den Spieler "predicted" beim Zielen
    FIRE_RATE:      6, // 0-1: Wie schnell der Agent schießt
    BULLET_SPEED:   7, // 0–1: Bullet-Geschwindigkeit (BULLET_SPEED_MIN–BULLET_SPEED_MAX)
} as const;


export const DNA_NAMES = Object.keys(DNA_INDEX) as (keyof typeof DNA_INDEX)[];

export const DNA_LENGTH = Object.keys(DNA_INDEX).length; // = 7

// Display label + hover explanation for each gene — shared by every DNA slider/readout in the UI.
// NOTE: AGGRESSION's *label* here is 'Pursuit', not 'Aggression' — in this game's updateAgent()
// (game/core/gameLoop.ts) the gene is zeroed out entirely once the agent is within
// PREFERRED_RANGE, so it only ever affects how eagerly it closes distance from farther away, not
// how aggressively it presses an attack once in range. 'Aggression' as a label overpromised. The
// internal key/index stays AGGRESSION (renaming it would ripple through gameLoop.ts, evolution,
// and every DNA array comment) — only the player-facing copy changed. Horde's own AGGRESSION
// mechanic (see HordeCanvas.tsx's wander/chase blend) is a genuinely good fit for the word
// "Aggression" and deliberately keeps that label via its own override in
// ShooterLobbyPage.tsx's HORDE_BAR_GENES — don't "fix" that back to Pursuit.
export const DNA_GENE_INFO: Record<keyof typeof DNA_INDEX, { label: string; tooltip: string }> = {
    AGGRESSION:      { label: 'Pursuit',       tooltip: "How eagerly the agent closes the distance once you're farther than its preferred range — it stops pulling once it gets there." },
    DODGE_WEIGHT:    { label: 'Dodge',        tooltip: "How likely the agent is to dodge your incoming bullets." },
    SHOOT_ACCURACY:  { label: 'Accuracy',     tooltip: 'How precisely the agent aims — 1 means it never misses.' },
    PREFERRED_RANGE: { label: 'Range',        tooltip: 'The distance the agent tries to keep between itself and you.' },
    MOVEMENT_SPEED:  { label: 'Speed',        tooltip: 'How fast the agent moves.' },
    PREDICT_LEAD:    { label: 'Lead',         tooltip: "How much the agent aims ahead of your movement instead of at your current position." },
    FIRE_RATE:       { label: 'Fire Rate',    tooltip: 'How often the agent fires.' },
    BULLET_SPEED:    { label: 'Bullet Speed', tooltip: "How fast the agent's bullets travel." },
};

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
    homing?:  boolean;      // Homing-Rounds-Mod: dreht pro Frame Richtung Agent ein
    bounces?: number;       // Ricochet-Mod: verbleibende Wand-Abpraller
}

// ---- Stats & Fitness ----

export interface RoundStats {
    hitsLanded:      number; // Treffer auf Gegner
    hitsReceived:    number; // Selbst getroffen
    bulletsFired:    number;
    timeAlive:       number; // Sekunden
    dodgedBullets:   number; // Bullets die nah vorbeigingen (<40px)
    distanceSum:     number; // Summe aller Distanzen (für Durchschnitt)
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

export interface CrossoverExample {
    parentA:     DNA;
    parentB:     DNA;
    geneOrigins: boolean[];  // true = Gen von Elternteil A
    type:        'uniform' | 'single-point';
}

export interface GameState {
    phase:            GamePhase;
    roundTimer:       number;
    roundNumber:      number;
    player:           PlayerState;
    agent:            AgentState;
    bullets:          Bullet[];
    population:       Population | null;
    lastPlayerFrame:  PlayerGhostFrame | null;
    lastAgentFrame:   AgentGhostFrame | null;
    crossoverExample: CrossoverExample | null;
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
    POPULATION_SIZE:   40,
    ELITE_COUNT:       4,    // Top-N die direkt überleben
    MUTATION_RATE:     0.1,  // 10 % Chance pro Gen-Wert
    MUTATION_STRENGTH: 0.2,  // wie stark ein Wert sich ändert
    BULLET_SPEED:      500,  // px/s – Default für Spieler
    BULLET_SPEED_MIN:  150,  // px/s – Agent-DNA Minimum
    BULLET_SPEED_MAX:  900,  // px/s – Agent-DNA Maximum
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
    0.3,  // PREFERRED_RANGE – bleibt nah
    0.1,  // MOVEMENT_SPEED – sehr langsam
    0.1,  // PREDICT_LEAD   – kein Vorauszielen
    0.1,  // FIRE_RATE      – schießt sehr langsam
    0.5,  // BULLET_SPEED   – mittlere Geschwindigkeit (~525 px/s)
];

// Nahezu regungslose Zielscheibe fürs Tutorial — verfolgt nicht, weicht nie aus,
// trifft so gut wie nie. Kein Sonderfall im gameLoop nötig: die DNA allein macht
// den Agenten harmlos, genau wie die Engine es sonst auch überall handhabt.
export const TUTORIAL_DNA: DNA = [
    0,    // AGGRESSION      – verfolgt nicht
    0,    // DODGE_WEIGHT    – weicht nie aus
    0,    // SHOOT_ACCURACY  – trifft so gut wie nie
    0.9,  // PREFERRED_RANGE – hält maximalen Abstand
    0,    // MOVEMENT_SPEED  – bewegt sich kaum (nur Basisgeschwindigkeit)
    0,    // PREDICT_LEAD    – zielt nicht vorausschauend
    0,    // FIRE_RATE       – schießt so selten wie möglich
    0,    // BULLET_SPEED    – langsamste Kugeln
];

// Gesetzt (localStorage) sobald das Tutorial einmal komplett durchlaufen wurde
// (Übungsrunde + DNA/EA-Explainer) — danach öffnet der Tutorial-Button in der
// Lobby ein Auswahlfenster statt direkt die Übungsrunde zu starten.
export const TUTORIAL_COMPLETED_KEY = 'shooter.tutorial.completed';

// Gleiche Mechanik für die beiden anderen Modi: erster Tutorial-Durchlauf ist
// der komplette Fluss (Übungsrunde → modusspezifischer Explainer), danach
// öffnet der jeweilige Tutorial-Button das Auswahlfenster.
export const HORDE_TUTORIAL_COMPLETED_KEY    = 'horde.tutorial.completed';
export const RAIDBOSS_TUTORIAL_COMPLETED_KEY = 'raidboss.tutorial.completed';

// Die Steuerung ist in allen Modi dieselbe — wer irgendwo schon einmal ein
// Gameplay-Tutorial durchlaufen hat, bekommt deshalb überall direkt das
// Auswahlfenster statt einer erzwungenen weiteren Übungsrunde. Nur komplett
// neue Spieler landen im vollen Erstlauf-Fluss.
export function hasCompletedAnyTutorial(): boolean {
    return [TUTORIAL_COMPLETED_KEY, HORDE_TUTORIAL_COMPLETED_KEY, RAIDBOSS_TUTORIAL_COMPLETED_KEY]
        .some(key => localStorage.getItem(key) !== null);
}

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
    /** Reale Bullet Speed des Spielers zur Aufnahmezeit (Settings + Mods).
        Fallback: GAME_CONFIG.BULLET_SPEED. */
    bulletSpeed?:  number;
    /** Aktive Mods zur Aufnahmezeit — Verhaltens-Mods (Triple/Burst/Homing)
        formen im Ghost-Training den Schuss-Plan wie im echten Spiel. */
    activeModIds?: string[];
}

// ---- Spieler-Konfiguration ----

export interface PlayerStats {
    bulletSpeed:   number;  // px/s
    moveSpeed:     number;  // px/s
    shootCooldown: number;  // Sekunden zwischen Schüssen
}