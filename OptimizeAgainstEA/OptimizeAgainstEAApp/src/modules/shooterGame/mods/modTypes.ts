import type { PlayerStats } from '../shooter.types';

// Selbe Grenzen wie die Slider in ShooterSettings.tsx – verhindert dass sich
// Mods zu extremen/kaputten Werten aufstacken.
const BULLET_SPEED_RANGE   = { min: 100, max: 1000 };
const MOVE_SPEED_RANGE     = { min: 50,  max: 600 };
const SHOOT_COOLDOWN_RANGE = { min: 0.05, max: 2 };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Ein einzelner Schuss, relativ zum normalen Trigger-Pull: Winkel-Versatz zur
// Blickrichtung, Verzögerung (0 = sofort, sonst wird er über nachfolgende
// Frames abgefeuert, siehe queuedPlayerShots in gameLoop.ts) und Speed-Faktor.
export interface ShotPlanEntry {
    angleOffset: number;
    delay:       number;
    speedMult:   number;
    homing?:     boolean;
}

const SINGLE_SHOT: ShotPlanEntry[] = [{ angleOffset: 0, delay: 0, speedMult: 1 }];

// Hartes Limit falls mehrere Schuss-Mods gleichzeitig aktiv sind (z.B. Triple
// Shot + Burst Shot = 3×3 = 9) – verhindert dass zukünftige Kombinationen die
// Bullet-Kollision (O(bullets)) explodieren lassen.
const MAX_SHOTS_PER_TRIGGER = 12;

export interface ModDefinition {
    id:          string;
    name:        string;
    description: string;
    icon:        string;
    // Stat-Mods: passive Multiplikatoren auf die drei PlayerStats-Felder.
    applyStats?:  (stats: PlayerStats) => PlayerStats;
    // Verhaltens-Mods: verändern was pro Trigger-Pull tatsächlich abgefeuert wird
    // (Spread, zusätzliche Schüsse, verzögerte Bursts, ...).
    modifyShots?: (shots: ShotPlanEntry[]) => ShotPlanEntry[];
}

export const MOD_POOL: ModDefinition[] = [
    {
        id:          'swift-boots',
        name:        'Swift Boots',
        description: '+20% Move Speed',
        icon:        '👢',
        applyStats: s => ({ ...s, moveSpeed: clamp(s.moveSpeed * 1.2, MOVE_SPEED_RANGE.min, MOVE_SPEED_RANGE.max) }),
    },
    {
        id:          'rapid-fire',
        name:        'Rapid Fire',
        description: '-20% Shoot Cooldown',
        icon:        '🔫',
        applyStats: s => ({ ...s, shootCooldown: clamp(s.shootCooldown * 0.8, SHOOT_COOLDOWN_RANGE.min, SHOOT_COOLDOWN_RANGE.max) }),
    },
    {
        id:          'cannon-rounds',
        name:        'Cannon Rounds',
        description: '+25% Bullet Speed',
        icon:        '💥',
        applyStats: s => ({ ...s, bulletSpeed: clamp(s.bulletSpeed * 1.25, BULLET_SPEED_RANGE.min, BULLET_SPEED_RANGE.max) }),
    },
    {
        id:          'twitch-reflex',
        name:        'Twitch Reflex',
        description: '+10% Move Speed, -10% Shoot Cooldown',
        icon:        '⚡',
        applyStats: s => ({
            ...s,
            moveSpeed:     clamp(s.moveSpeed * 1.1, MOVE_SPEED_RANGE.min, MOVE_SPEED_RANGE.max),
            shootCooldown: clamp(s.shootCooldown * 0.9, SHOOT_COOLDOWN_RANGE.min, SHOOT_COOLDOWN_RANGE.max),
        }),
    },
    {
        id:          'sniper-barrel',
        name:        'Sniper Barrel',
        description: '+35% Bullet Speed, -10% Move Speed',
        icon:        '🎯',
        applyStats: s => ({
            ...s,
            bulletSpeed: clamp(s.bulletSpeed * 1.35, BULLET_SPEED_RANGE.min, BULLET_SPEED_RANGE.max),
            moveSpeed:   clamp(s.moveSpeed * 0.9, MOVE_SPEED_RANGE.min, MOVE_SPEED_RANGE.max),
        }),
    },
    {
        id:          'trigger-happy',
        name:        'Trigger Happy',
        description: '-30% Shoot Cooldown, -10% Bullet Speed',
        icon:        '🔥',
        applyStats: s => ({
            ...s,
            shootCooldown: clamp(s.shootCooldown * 0.7, SHOOT_COOLDOWN_RANGE.min, SHOOT_COOLDOWN_RANGE.max),
            bulletSpeed:   clamp(s.bulletSpeed * 0.9, BULLET_SPEED_RANGE.min, BULLET_SPEED_RANGE.max),
        }),
    },
    {
        id:          'marathon-legs',
        name:        'Marathon Legs',
        description: '+35% Move Speed',
        icon:        '🏃',
        applyStats: s => ({ ...s, moveSpeed: clamp(s.moveSpeed * 1.35, MOVE_SPEED_RANGE.min, MOVE_SPEED_RANGE.max) }),
    },
    {
        id:          'heavy-slugs',
        name:        'Heavy Slugs',
        description: '+45% Bullet Speed',
        icon:        '🧱',
        applyStats: s => ({ ...s, bulletSpeed: clamp(s.bulletSpeed * 1.45, BULLET_SPEED_RANGE.min, BULLET_SPEED_RANGE.max) }),
    },
    {
        id:          'triple-shot',
        name:        'Triple Shot',
        description: '3 bullets in a spread per shot',
        icon:        '🔱',
        modifyShots: shots => shots.flatMap(s => [
            { ...s, angleOffset: s.angleOffset - 0.18 },
            { ...s, angleOffset: s.angleOffset },
            { ...s, angleOffset: s.angleOffset + 0.18 },
        ]),
    },
    {
        id:          'burst-shot',
        name:        'Burst Shot',
        description: '3 rapid shots per trigger pull',
        icon:        '🌀',
        modifyShots: shots => shots.flatMap(s => [
            { ...s, delay: s.delay },
            { ...s, delay: s.delay + 0.06 },
            { ...s, delay: s.delay + 0.12 },
        ]),
    },
    {
        id:          'homing-rounds',
        name:        'Homing Rounds',
        description: 'Bullets curve toward the agent',
        icon:        '🧲',
        modifyShots: shots => shots.map(s => ({ ...s, homing: true })),
    },
];

export function applyMods(base: PlayerStats, activeIds: string[]): PlayerStats {
    let result = base;
    for (const id of activeIds) {
        const mod = MOD_POOL.find(m => m.id === id);
        if (mod?.applyStats) result = mod.applyStats(result);
    }
    return result;
}

// Baut den Schuss-Plan für einen einzelnen Trigger-Pull: startet bei einem
// normalen Einzelschuss und lässt jeden aktiven Verhaltens-Mod ihn transformieren
// (z.B. Triple Shot vervielfacht, Burst Shot staffelt zeitlich). Wird nur beim
// tatsächlichen Abfeuern aufgerufen, nicht jeden Frame – vernachlässigbare Kosten.
export function computeShotPlan(activeIds: string[]): ShotPlanEntry[] {
    let shots = SINGLE_SHOT;
    for (const id of activeIds) {
        const mod = MOD_POOL.find(m => m.id === id);
        if (mod?.modifyShots) shots = mod.modifyShots(shots);
    }
    return shots.length > MAX_SHOTS_PER_TRIGGER ? shots.slice(0, MAX_SHOTS_PER_TRIGGER) : shots;
}
