import { DNA_INDEX, GAME_CONFIG, type DNA } from '../shooter.types';

// Shared physics for the tutorial's small arena-style preview canvases
// (DnaPreviewCanvas, GhostArenaVisual) — ported from game/core/gameLoop.ts's
// updateAgent, scaled down for a small canvas instead of the real 800px
// arena. Kept in one place so a formula fix only has to happen once instead
// of drifting between two copies.
//
// Dodge is deliberately NOT included here — it needs incoming-bullet
// tracking, which only DnaPreviewCanvas's single-agent-vs-player demo uses;
// GhostArenaVisual's many-candidates view skips it to stay simple.

export const ARENA_SIZE  = 240;
export const ARENA_SCALE = ARENA_SIZE / 800; // updateAgent's formulas assume an 800px arena

export const AGENT_RADIUS      = GAME_CONFIG.AGENT_RADIUS * ARENA_SCALE;
export const BULLET_RADIUS     = GAME_CONFIG.BULLET_RADIUS * ARENA_SCALE;
export const AGENT_SPEED_BASE  = GAME_CONFIG.AGENT_SPEED_BASE * ARENA_SCALE;
export const AGENT_SPEED_BONUS = GAME_CONFIG.AGENT_SPEED_BONUS * ARENA_SCALE;
export const BULLET_SPEED_MIN  = GAME_CONFIG.BULLET_SPEED_MIN * ARENA_SCALE;
export const BULLET_SPEED_MAX  = GAME_CONFIG.BULLET_SPEED_MAX * ARENA_SCALE;

export interface ArenaAgentState { x: number; y: number; vx: number; vy: number; rot: number; }
export interface ArenaTarget     { x: number; y: number; vx: number; vy: number; }
export interface ArenaBullet     { x: number; y: number; vx: number; vy: number; life: number; }

/** Mutates `agent` in place (position/velocity/rotation); returns the next
 * cooldown and a bullet if this call fired one. Extra force (e.g. dodge) can
 * be added via `extraForceX/Y` before the combined move is normalized. */
export function stepArenaAgent(
    agent:        ArenaAgentState,
    dna:          DNA,
    target:       ArenaTarget,
    dt:           number,
    cooldown:     number,
    extraForceX = 0,
    extraForceY = 0,
): { cooldown: number; bullet: ArenaBullet | null } {
    const dx = target.x - agent.x, dy = target.y - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const toX = dx / dist, toY = dy / dist;

    let chaseX = toX * dna[DNA_INDEX.AGGRESSION];
    let chaseY = toY * dna[DNA_INDEX.AGGRESSION];

    const preferredDist = dna[DNA_INDEX.PREFERRED_RANGE] * 300 * ARENA_SCALE + 100 * ARENA_SCALE;
    const rangeFactor   = (dist - preferredDist) / (preferredDist + 1);
    const rangeX = toX * rangeFactor * 0.5;
    const rangeY = toY * rangeFactor * 0.5;

    if (preferredDist > dist) { chaseX = 0; chaseY = 0; }
    let moveX = chaseX + rangeX + extraForceX;
    let moveY = chaseY + rangeY + extraForceY;
    const combLen = Math.sqrt(moveX * moveX + moveY * moveY);
    const speed = AGENT_SPEED_BASE + dna[DNA_INDEX.MOVEMENT_SPEED] * AGENT_SPEED_BONUS;
    if (combLen > 0) { moveX = (moveX / combLen) * speed; moveY = (moveY / combLen) * speed; }
    else              { moveX = 0; moveY = 0; }

    agent.vx = (agent.vx + moveX) * 0.82;
    agent.vy = (agent.vy + moveY) * 0.82;
    agent.x  = Math.max(AGENT_RADIUS, Math.min(ARENA_SIZE - AGENT_RADIUS, agent.x + agent.vx * dt));
    agent.y  = Math.max(AGENT_RADIUS, Math.min(ARENA_SIZE - AGENT_RADIUS, agent.y + agent.vy * dt));

    const lead  = dna[DNA_INDEX.PREDICT_LEAD];
    const predX = target.x + target.vx * lead * 0.4;
    const predY = target.y + target.vy * lead * 0.4;
    agent.rot = Math.atan2(predY - agent.y, predX - agent.x);

    let nextCooldown = cooldown - dt;
    let bullet: ArenaBullet | null = null;
    if (nextCooldown <= 0) {
        const scatter     = (Math.random() - 0.5) * (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 1.2;
        const bulletSpeed = BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (BULLET_SPEED_MAX - BULLET_SPEED_MIN);
        const a = agent.rot + scatter;
        bullet = { x: agent.x, y: agent.y, vx: Math.cos(a) * bulletSpeed, vy: Math.sin(a) * bulletSpeed, life: 2 };
        nextCooldown = GAME_CONFIG.SHOOT_COOLDOWN_MIN + (1 - dna[DNA_INDEX.FIRE_RATE]) * GAME_CONFIG.SHOOT_COOLDOWN_MAX;
    }

    return { cooldown: nextCooldown, bullet };
}

/** Draws the standard orange EA triangle, facing `agent.rot`, at `agent`'s
 * current position — shared so every preview canvas's agent looks identical. */
export function drawArenaAgentTriangle(ctx: CanvasRenderingContext2D, agent: ArenaAgentState, opacity = 1) {
    ctx.save();
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.rot);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, 6);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fillStyle = opacity >= 1 ? '#f97316' : `rgba(249, 115, 22, ${opacity})`;
    ctx.fill();
    ctx.restore();
}
