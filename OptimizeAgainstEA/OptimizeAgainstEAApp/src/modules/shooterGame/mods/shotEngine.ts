import type { Vector2D } from '../game/core/vec';
import { GAME_CONFIG } from '../shooter.types';

// Geteilte Mechanik für Schuss-Mods, die Solo Play (gameLoop.ts) und Horde
// (HordeCanvas.tsx) beide brauchen — die beiden Engines bleiben ansonsten
// bewusst getrennt (eigene Update-Funktionen, eigene EA-Settings), aber diese
// Trig-Rechnung wäre sonst 1:1 dupliziert.

// Schuss aus einem Verhaltens-Mod (z.B. Burst Shot), der zeitversetzt nach dem
// eigentlichen Trigger-Pull abgefeuert wird.
export interface QueuedShot {
    timer:       number;
    angleOffset: number;
    speedMult:   number;
    homing:      boolean;
}

// Homing Rounds: max. Drehrate in rad/s — geteilt von Solo (gameLoop.ts),
// Horde (hordeEngine.ts) und der Ghost-Presim (evolution.ts), damit das
// Balancing überall identisch ist.
export const HOMING_TURN_RATE = 1.2;

// Homing lenkt nur kurz nach dem Abfeuern ein, danach fliegt die Kugel
// geradeaus weiter — sie sucht ihr Ziel, verfolgt es aber nicht endlos.
export const HOMING_DURATION = 0.5;

/** Homt diese Kugel (gemessen an ihrer Rest-Lifetime) noch? */
export function homingActive(lifetime: number): boolean {
    return lifetime > GAME_CONFIG.BULLET_LIFETIME - HOMING_DURATION;
}

// ---- Orbit Shield (Mod 'orbit-shield') ----
// Drei Orbs kreisen um den Spieler und blocken, was sie berühren: in Solo/
// Raidboss gegnerische Bullets, in Horde die Agenten selbst (dort schießt
// niemand). Der Rotationswinkel lebt als Modul-State in der jeweiligen Engine —
// hier nur die geteilten Konstanten + die Kollisionsrechnung (reine Trig,
// keine Allokationen).
export const SHIELD_MOD_ID      = 'orbit-shield';
export const SHIELD_ORB_COUNT   = 3;
export const SHIELD_ORBIT_RADIUS = 55;
export const SHIELD_ORB_RADIUS  = 10;
export const SHIELD_SPIN_RATE   = 2.6; // rad/s

/** Trifft ein Kreis (Bullet/Agent) gerade einen der Schild-Orbs? */
export function shieldBlocks(
    center: Vector2D,
    angle:  number,
    x:      number,
    y:      number,
    radius: number,
): boolean {
    for (let i = 0; i < SHIELD_ORB_COUNT; i++) {
        const a  = angle + (i * 2 * Math.PI) / SHIELD_ORB_COUNT;
        const dx = x - (center.x + Math.cos(a) * SHIELD_ORBIT_RADIUS);
        const dy = y - (center.y + Math.sin(a) * SHIELD_ORBIT_RADIUS);
        const r  = SHIELD_ORB_RADIUS + radius;
        if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
}

// Homing Rounds: dreht die Geschwindigkeit einer Kugel pro Frame um maximal
// `turnRate` (rad/s) Richtung `target` ein – kein Instant-Snap, reine
// In-Place-Trig-Rechnung ohne temporäre Objekte.
export function steerHomingBullet(
    position: Vector2D,
    velocity: Vector2D,
    target:   Vector2D,
    turnRate: number,
    dt:       number,
) {
    const hdx = target.x - position.x;
    const hdy = target.y - position.y;
    if (hdx === 0 && hdy === 0) return;

    const curSpeed    = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const curAngle    = Math.atan2(velocity.y, velocity.x);
    const targetAngle = Math.atan2(hdy, hdx);
    const rawDiff     = targetAngle - curAngle;
    const diff        = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff)); // auf [-π, π] normalisiert
    const maxTurn     = turnRate * dt;
    const turn        = diff > maxTurn ? maxTurn : diff < -maxTurn ? -maxTurn : diff;
    const newAngle    = curAngle + turn;

    velocity.x = Math.cos(newAngle) * curSpeed;
    velocity.y = Math.sin(newAngle) * curSpeed;
}
