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
    // Stapelbar: Stat-Boosts dürfen mehrfach genommen werden (bis MAX_MOD_STACKS)
    // und multiplizieren ihren Effekt pro Kopie – applyMods läuft ohnehin einmal
    // pro Eintrag in activeModIds, also stackt es von selbst. Verhaltens-Mods
    // bleiben einmalig: ihr modifyShots doppelt anzuwenden wäre kaputt/sinnlos.
    repeatable?:  boolean;
}

// Wie oft ein stapelbarer Mod maximal genommen werden kann. Die Stat-Clamps
// (Move 600 / Bullet 1000 / Cooldown 0.05) deckeln den Effekt zwar ohnehin,
// aber ein harter Cap hält den ×N-Badge lesbar und stoppt tote Angebote.
export const MAX_MOD_STACKS = 5;

export const MOD_POOL: ModDefinition[] = [
    // ── Klare Stat-Boosts: genau ein Item pro Stat, bewusst kräftig dosiert
    //    damit der Effekt sofort spürbar ist. Ersetzt die früheren flavory
    //    Tweaks (Swift Boots, Cannon Rounds, Sniper Barrel, …), die stark
    //    genug klangen, aber real kaum einen Unterschied gemacht haben. ──
    {
        id:          'speed-boost',
        name:        'Speed Boost',
        description: '+40% Move Speed',
        icon:        '👢',
        repeatable:  true,
        applyStats: s => ({ ...s, moveSpeed: clamp(s.moveSpeed * 1.4, MOVE_SPEED_RANGE.min, MOVE_SPEED_RANGE.max) }),
    },
    {
        id:          'rapid-fire',
        name:        'Rapid Fire',
        description: '-35% Shoot Cooldown',
        icon:        '🔫',
        repeatable:  true,
        applyStats: s => ({ ...s, shootCooldown: clamp(s.shootCooldown * 0.65, SHOOT_COOLDOWN_RANGE.min, SHOOT_COOLDOWN_RANGE.max) }),
    },
    {
        id:          'bullet-speed',
        name:        'Bullet Speed',
        description: '+60% Bullet Speed',
        icon:        '💥',
        repeatable:  true,
        applyStats: s => ({ ...s, bulletSpeed: clamp(s.bulletSpeed * 1.6, BULLET_SPEED_RANGE.min, BULLET_SPEED_RANGE.max) }),
    },
    // ── Verhaltens-Mods: verändern was pro Trigger-Pull abgefeuert wird. ──
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

// Badge-Text auf der Powerup-Karte eines stapelbaren Mods: welche Stack-Stufe
// der Pick ergäbe — bzw. schlicht "Stackable", solange noch keiner aktiv ist.
// Zentral, damit Solo- und Horde-Auswahl-Overlay denselben Wortlaut zeigen.
export function stackOfferLabel(activeIds: string[], id: string): string {
    const count = modStackCount(activeIds, id);
    return count > 0 ? `Stack → ×${Math.min(count + 1, MAX_MOD_STACKS)}` : 'Stackable';
}

// Wie viele Kopien eines Mods aktuell aktiv sind (0 = nicht aktiv). Für nicht
// stapelbare Mods immer 0 oder 1.
export function modStackCount(activeIds: string[], id: string): number {
    let n = 0;
    for (const m of activeIds) if (m === id) n++;
    return n;
}

// Darf dieser Mod (noch) angeboten bzw. hinzugefügt werden? Stapelbare bis zum
// Cap, einmalige nur wenn noch nicht aktiv.
export function isModOfferable(mod: ModDefinition, activeIds: string[]): boolean {
    return mod.repeatable
        ? modStackCount(activeIds, mod.id) < MAX_MOD_STACKS
        : !activeIds.includes(mod.id);
}

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
