import type { Vector2D } from '../game/core/vec';

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
