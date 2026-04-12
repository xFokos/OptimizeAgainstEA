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

    drawAgent(ctx: CanvasRenderingContext2D, state: GameState) {
        const { position, rotation, radius } = state.agent;
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(rotation);

        // Körper
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ef5350';
        ctx.fill();

        // Richtungsindikator
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(radius + 12, 0);
        ctx.strokeStyle = '#ff8a80';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glüh-Effekt
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 83, 80, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    },

    drawBullets(ctx: CanvasRenderingContext2D, state: GameState) {
        for (const bullet of state.bullets) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);

            if (bullet.ownerId === 'player') {
                ctx.fillStyle = '#80d8ff';
                ctx.shadowColor = '#4fc3f7';
            } else {
                ctx.fillStyle = '#ff8a80';
                ctx.shadowColor = '#ef5350';
            }

            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
        }
    },

    drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
        // Timer
        ctx.font = '500 20px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(state.roundTimer)}s`, ARENA.WIDTH / 2, 32);

        // Generation
        ctx.font = '400 13px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'right';
        const gen = state.population?.generation ?? 0;
        ctx.fillText(`GEN ${gen}`, ARENA.WIDTH - 16, 24);

        // Runde
        ctx.textAlign = 'left';
        ctx.fillText(`RND ${state.roundNumber}`, 16, 24);
    },

    // Alles zusammen – diese Funktion wird im Game Loop aufgerufen
    render(canvas: HTMLCanvasElement | null, state: GameState) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        renderer.clear(ctx);
        renderer.drawArena(ctx);
        renderer.drawBullets(ctx, state);
        renderer.drawPlayer(ctx, state);
        renderer.drawAgent(ctx, state);
        renderer.drawHUD(ctx, state);
    },
};