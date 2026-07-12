import { ARENA, GAME_CONFIG } from '../shooter.types';
import type { HordeGameState } from './hordeTypes';
import { agentRadius, agentOpacity } from './hordeEngine';

/** Horde accent color — shared by the in-game render, DNA panel, and overlays. */
export const HC = '#fb923c';

// ---- Renderer ----

export function render(ctx: CanvasRenderingContext2D, state: HordeGameState) {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let x = 0; x <= ARENA.WIDTH;  x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.HEIGHT); }
    for (let y = 0; y <= ARENA.HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(ARENA.WIDTH, y); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251,146,60,0.18)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, ARENA.WIDTH - 2, ARENA.HEIGHT - 2);

    // Obstacles — solid border for cover that blocks bullets, dashed for movement-only blockers
    for (const o of state.map.obstacles) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = o.blocksBullets ? 'rgba(251,146,60,0.55)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 2;
        ctx.setLineDash(o.blocksBullets ? [] : [6, 4]);
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.setLineDash([]);
    }

    // Bullets
    ctx.fillStyle = '#80d8ff';
    ctx.beginPath();
    for (const b of state.bullets) {
        ctx.moveTo(b.position.x + b.radius, b.position.y);
        ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2);
    }
    ctx.fill();

    // Agents — size and opacity are both evolved genes (SIZE_GENE_INDEX / OPACITY_GENE_INDEX)
    for (const a of state.agents) {
        if (!a.alive) continue;
        const r       = agentRadius(a.dna);
        const opacity = agentOpacity(a.dna);
        ctx.save();
        ctx.translate(a.position.x, a.position.y);
        ctx.rotate(a.rotation);
        ctx.globalAlpha = opacity;
        ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = HC; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = HC; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Player
    const dead = state.phase === 'dead';
    ctx.save();
    ctx.translate(state.player.position.x, state.player.position.y);
    ctx.rotate(state.player.rotation);
    ctx.beginPath(); ctx.arc(0, 0, GAME_CONFIG.PLAYER_RADIUS + 5, 0, Math.PI * 2);
    ctx.strokeStyle = dead ? 'rgba(239,83,80,0.4)' : 'rgba(79,195,247,0.3)';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, GAME_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#ef5350' : '#4fc3f7'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.PLAYER_RADIUS, 0);
    ctx.lineTo(GAME_CONFIG.PLAYER_RADIUS + 14, 0);
    ctx.strokeStyle = '#80d8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ARENA.WIDTH, 38);
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = HC;
    ctx.fillText(`GEN ${state.generation}`, 14, 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`KILLS: ${state.score}`, ARENA.WIDTH - 14, 19);
}
