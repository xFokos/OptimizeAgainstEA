import type { GameState } from '../../shooter.types';
import { ARENA } from '../../shooter.types';

// Alle Canvas-draw()-Calls leben hier – keine Logik, nur Zeichnen

export const renderer = {

    clear(ctx: CanvasRenderingContext2D) {
        ctx.clearRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
    },

    drawArena(ctx: CanvasRenderingContext2D) {
        // Hintergrund
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

        // Feines Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x <= ARENA.WIDTH; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ARENA.HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y <= ARENA.HEIGHT; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ARENA.WIDTH, y);
            ctx.stroke();
        }

        // Rand
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, ARENA.WIDTH - 2, ARENA.HEIGHT - 2);
    },

    drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
        const { position, rotation, radius } = state.player;
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(rotation);

        // Körper
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#4fc3f7';
        ctx.fill();

        // Richtungsindikator (Lauf)
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(radius + 12, 0);
        ctx.strokeStyle = '#80d8ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glüh-Effekt
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    },

    drawAgent(ctx: CanvasRenderingContext2D, state: GameState, isRaidboss = false) {
        const { position, rotation, radius } = state.agent;
        const r         = isRaidboss ? radius * 1.5 : radius;
        const color     = isRaidboss ? '#a855f7' : '#ef5350';
        const barrel    = isRaidboss ? '#c084fc' : '#ff8a80';
        const glow      = isRaidboss ? 'rgba(168, 85, 247, 0.35)' : 'rgba(239, 83, 80, 0.3)';

        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(rotation);

        // Raidboss: äußerer Pulsring
        if (isRaidboss) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        // Körper
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Richtungsindikator
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r + (isRaidboss ? 16 : 12), 0);
        ctx.strokeStyle = barrel;
        ctx.lineWidth = isRaidboss ? 5 : 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glüh-Effekt
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    },

    drawBullets(ctx: CanvasRenderingContext2D, state: GameState, isRaidboss = false) {
        for (const bullet of state.bullets) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);

            if (bullet.ownerId === 'player') {
                ctx.fillStyle = '#80d8ff';
                ctx.shadowColor = '#4fc3f7';
            } else if (isRaidboss) {
                ctx.fillStyle = '#c084fc';
                ctx.shadowColor = '#a855f7';
            } else {
                ctx.fillStyle = '#ff8a80';
                ctx.shadowColor = '#ef5350';
            }

            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
        }
    },

    drawHUD(ctx: CanvasRenderingContext2D, state: GameState, raidbossInfo?: { generation: number; index: number; total: number }) {
        // Timer
        ctx.font = '500 20px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(state.roundTimer)}s`, ARENA.WIDTH / 2, 32);

        if (raidbossInfo) {
            // Raidboss HUD
            ctx.font = '700 13px "JetBrains Mono", monospace';
            ctx.fillStyle = '#a855f7';
            ctx.textAlign = 'right';
            ctx.fillText(`RAIDBOSS`, ARENA.WIDTH - 16, 24);
            ctx.font = '400 11px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
            ctx.fillText(`GEN ${raidbossInfo.generation} · IND ${raidbossInfo.index}/${raidbossInfo.total}`, ARENA.WIDTH - 16, 40);
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '400 13px "JetBrains Mono", monospace';
            ctx.fillText(`RND ${state.roundNumber}`, 16, 24);
        } else {
            // Normales HUD
            ctx.font = '400 13px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.textAlign = 'right';
            const gen = state.population?.generation ?? 0;
            ctx.fillText(`GEN ${gen}`, ARENA.WIDTH - 16, 24);
            ctx.textAlign = 'left';
            ctx.fillText(`RND ${state.roundNumber}`, 16, 24);
        }
    },

    render(canvas: HTMLCanvasElement | null, state: GameState, raidbossInfo?: { generation: number; index: number; total: number }) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isRaidboss = !!raidbossInfo;
        renderer.clear(ctx);
        renderer.drawArena(ctx);
        renderer.drawBullets(ctx, state, isRaidboss);
        renderer.drawPlayer(ctx, state);
        renderer.drawAgent(ctx, state, isRaidboss);
        renderer.drawHUD(ctx, state, raidbossInfo);
    },
};