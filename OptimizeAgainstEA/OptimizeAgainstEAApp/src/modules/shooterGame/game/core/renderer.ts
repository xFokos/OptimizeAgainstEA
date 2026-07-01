import type { GameState } from '../../shooter.types';
import type { TouchVisualState } from '../../hooks/useTouchControls';
import { ARENA } from '../../shooter.types';

// Alle Canvas-draw()-Calls leben hier – keine Logik, nur Zeichnen

// Context-Cache: alpha:false → Browser muss Canvas nicht mit Hintergrund compositen
const ctxCache = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    let ctx = ctxCache.get(canvas);
    if (!ctx) {
        // alpha:false: Canvas-Hintergrund ist immer undurchsichtig (wird immer komplett gezeichnet)
        const c = canvas.getContext('2d', { alpha: false });
        if (!c) return null;
        ctxCache.set(canvas, c);
        ctx = c;
    }
    return ctx;
}

// Statischer Hintergrund (Grid + Rand) einmal gerendert, dann per drawImage kopiert
let arenaCache: HTMLCanvasElement | null = null;

function buildArenaCache(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width  = ARENA.WIDTH;
    c.height = ARENA.HEIGHT;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    // Alle Grid-Linien in einem einzigen Pfad
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    const gridSize = 40;
    for (let x = 0; x <= ARENA.WIDTH; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA.HEIGHT);
    }
    for (let y = 0; y <= ARENA.HEIGHT; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA.WIDTH, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, ARENA.WIDTH - 2, ARENA.HEIGHT - 2);

    return c;
}

export const renderer = {

    drawArena(ctx: CanvasRenderingContext2D) {
        if (!arenaCache) arenaCache = buildArenaCache();
        ctx.drawImage(arenaCache, 0, 0);
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
        // Spieler-Bullets: alle in einem Pfad
        ctx.fillStyle = '#80d8ff';
        ctx.beginPath();
        for (const b of state.bullets) {
            if (b.ownerId !== 'player') continue;
            ctx.moveTo(b.position.x + b.radius, b.position.y);
            ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2);
        }
        ctx.fill();

        // Agent-Bullets: alle in einem Pfad
        ctx.fillStyle = isRaidboss ? '#c084fc' : '#ff8a80';
        ctx.beginPath();
        for (const b of state.bullets) {
            if (b.ownerId === 'player') continue;
            ctx.moveTo(b.position.x + b.radius, b.position.y);
            ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2);
        }
        ctx.fill();
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

    drawTouchControls(ctx: CanvasRenderingContext2D, touch: TouchVisualState) {
        // Trennlinie Mitte (nur wenn ein Touch aktiv ist)
        if (touch.joystick || touch.aimX !== null) {
            ctx.beginPath();
            ctx.moveTo(ARENA.WIDTH / 2, 0);
            ctx.lineTo(ARENA.WIDTH / 2, ARENA.HEIGHT);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth   = 1;
            ctx.stroke();
        }

        // Joystick
        if (touch.joystick) {
            const { originX, originY, dx, dy } = touch.joystick;

            // Äußerer Ring
            ctx.beginPath();
            ctx.arc(originX, originY, 55, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth   = 2;
            ctx.stroke();

            // Innenring
            ctx.beginPath();
            ctx.arc(originX, originY, 22, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.lineWidth   = 1;
            ctx.stroke();

            // Knob
            ctx.beginPath();
            ctx.arc(originX + dx, originY + dy, 22, 0, Math.PI * 2);
            ctx.fillStyle   = 'rgba(255,255,255,0.22)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        // Fadenkreuz (rechte Seite, Zielbereich)
        if (touch.aimX !== null && touch.aimY !== null) {
            const x = touch.aimX, y = touch.aimY;
            const r = 14, arm = 20;

            ctx.strokeStyle = 'rgba(239,83,80,0.75)';
            ctx.lineWidth   = 2;

            // Kreuz
            ctx.beginPath(); ctx.moveTo(x - arm, y); ctx.lineTo(x - r, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + r,   y); ctx.lineTo(x + arm, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - arm); ctx.lineTo(x, y - r); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y + r);   ctx.lineTo(x, y + arm); ctx.stroke();

            // Kreis
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    drawAimLaser(ctx: CanvasRenderingContext2D, state: GameState, mouseX: number, mouseY: number) {
        const { position, radius } = state.player;

        if (mouseX === 0 && mouseY === 0) return;

        const dx = mouseX - position.x;
        const dy = mouseY - position.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const ndx = dx / len;
        const ndy = dy / len;

        const sx = position.x + ndx * (radius + 4);
        const sy = position.y + ndy * (radius + 4);

        let t = 2000;
        if (ndx > 0) t = Math.min(t, (ARENA.WIDTH  - sx) / ndx);
        if (ndx < 0) t = Math.min(t, (0            - sx) / ndx);
        if (ndy > 0) t = Math.min(t, (ARENA.HEIGHT - sy) / ndy);
        if (ndy < 0) t = Math.min(t, (0            - sy) / ndy);
        t = Math.max(t, 0);

        const ex = sx + ndx * t;
        const ey = sy + ndy * t;

        // Strahlkörper (gestrichelt, ohne shadowBlur)
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
        ctx.lineWidth   = 3;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Auftreffpunkt
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(79, 195, 247, 0.9)';
        ctx.fill();
    },

    render(
        canvas:       HTMLCanvasElement | null,
        state:        GameState,
        raidbossInfo?: { generation: number; index: number; total: number },
        touch?:        TouchVisualState | null,
        aimLaser?:     { mouseX: number; mouseY: number } | null,
    ) {
        if (!canvas) return;
        const ctx = getCtx(canvas);
        if (!ctx) return;

        const isRaidboss = !!raidbossInfo;
        renderer.drawArena(ctx);  // drawImage überschreibt den gesamten Canvas – clearRect nicht nötig
        if (aimLaser) renderer.drawAimLaser(ctx, state, aimLaser.mouseX, aimLaser.mouseY);
        renderer.drawBullets(ctx, state, isRaidboss);
        renderer.drawPlayer(ctx, state);
        renderer.drawAgent(ctx, state, isRaidboss);
        renderer.drawHUD(ctx, state, raidbossInfo);
        if (touch) renderer.drawTouchControls(ctx, touch);
    },
};
