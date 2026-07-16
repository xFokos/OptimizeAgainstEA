import type { HordeObstacle } from './hordeTypes';
import type { Vector2D } from '../game/core/vec';

// Nearest point on an AABB to (x,y) — used by both the intersection test and the push-out below.
function nearestPointOnObstacle(x: number, y: number, o: HordeObstacle): { nx: number; ny: number } {
    return {
        nx: Math.max(o.x, Math.min(x, o.x + o.w)),
        ny: Math.max(o.y, Math.min(y, o.y + o.h)),
    };
}

export function circleIntersectsObstacle(x: number, y: number, r: number, o: HordeObstacle): boolean {
    const { nx, ny } = nearestPointOnObstacle(x, y, o);
    const dx = x - nx, dy = y - ny;
    return dx * dx + dy * dy < r * r;
}

// Ricochet Rounds: reflektiert eine Kugel an einem Obstacle-Rechteck — Normale
// vom nächsten AABB-Punkt zum Kugelmittelpunkt, Velocity daran spiegeln (nur
// wenn sie ins Obstacle zeigt) und die Position herausdrücken. In-place, keine
// Rückgabe — der Aufrufer verwaltet den bounces-Zähler.
export function bounceBulletOffObstacle(
    b: { position: Vector2D; velocity: Vector2D; radius: number },
    o: HordeObstacle,
): void {
    const { nx, ny } = nearestPointOnObstacle(b.position.x, b.position.y, o);
    let dx   = b.position.x - nx;
    let dy   = b.position.y - ny;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
        // Mittelpunkt exakt auf/im Rechteck — Normale entlang der flachsten Achse
        const left = b.position.x - o.x, right = (o.x + o.w) - b.position.x;
        const top  = b.position.y - o.y, bottom = (o.y + o.h) - b.position.y;
        const min  = Math.min(left, right, top, bottom);
        dx = min === left ? -1 : min === right ? 1 : 0;
        dy = dx !== 0 ? 0 : (min === top ? -1 : 1);
        dist = 1;
    }
    const invD = 1 / dist;
    const nrmX = dx * invD, nrmY = dy * invD;
    const dot  = b.velocity.x * nrmX + b.velocity.y * nrmY;
    if (dot < 0) {
        b.velocity.x -= 2 * dot * nrmX;
        b.velocity.y -= 2 * dot * nrmY;
    }
    const push = b.radius - dist;
    if (push > 0) {
        b.position.x += nrmX * push;
        b.position.y += nrmY * push;
    }
}

// Pushes a circle (x,y,r) out of every obstacle it overlaps. Obstacles are assumed
// non-overlapping, so resolving them one at a time in sequence is sufficient.
export function pushOutOfObstacles(
    x: number, y: number, r: number, obstacles: HordeObstacle[],
): { x: number; y: number; touching: boolean } {
    let touching = false;
    for (const o of obstacles) {
        const { nx, ny } = nearestPointOnObstacle(x, y, o);
        const dx = x - nx, dy = y - ny;
        const distSq = dx * dx + dy * dy;
        if (distSq >= r * r) continue;
        touching = true;
        const dist = Math.sqrt(distSq);
        if (dist > 0) {
            const push = r - dist;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
        } else {
            // Center landed exactly on the boundary/inside — push out along the shallowest axis.
            const left = x - o.x, right = (o.x + o.w) - x, top = y - o.y, bottom = (o.y + o.h) - y;
            const min = Math.min(left, right, top, bottom);
            if      (min === left)  x = o.x - r;
            else if (min === right) x = o.x + o.w + r;
            else if (min === top)   y = o.y - r;
            else                    y = o.y + o.h + r;
        }
    }
    return { x, y, touching };
}
