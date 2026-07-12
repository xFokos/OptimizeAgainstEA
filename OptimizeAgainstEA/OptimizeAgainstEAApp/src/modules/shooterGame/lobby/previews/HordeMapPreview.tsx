import { useEffect, useRef } from 'react';
import { ARENA } from '../../shooter.types';
import type { HordeMap } from '../../horde/hordeTypes';
import { PREVIEW_W, PREVIEW_H } from './previewShared';

// ---- Horde Map Preview (static — swaps in for HordePreview while the Map tab is open) ----

export function HordeMapPreview({ map }: { map: HordeMap }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = PREVIEW_W / ARENA.WIDTH; // ARENA is square, same factor on both axes

        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(PREVIEW_W, y); }
        ctx.stroke();

        // Orange glow along whichever edges agents can spawn from on this map
        const GLOW = 60;
        for (const side of map.spawnSides) {
            let grad: CanvasGradient;
            let gx = 0, gy = 0, gw = PREVIEW_W, gh = PREVIEW_H;
            if (side === 'top')    { grad = ctx.createLinearGradient(0, 0, 0, GLOW); gh = GLOW; }
            else if (side === 'bottom') { grad = ctx.createLinearGradient(0, PREVIEW_H, 0, PREVIEW_H - GLOW); gy = PREVIEW_H - GLOW; gh = GLOW; }
            else if (side === 'left')   { grad = ctx.createLinearGradient(0, 0, GLOW, 0); gw = GLOW; }
            else                        { grad = ctx.createLinearGradient(PREVIEW_W, 0, PREVIEW_W - GLOW, 0); gx = PREVIEW_W - GLOW; gw = GLOW; }
            grad.addColorStop(0, 'rgba(251,146,60,0.5)');
            grad.addColorStop(1, 'rgba(251,146,60,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx, gy, gw, gh);
        }

        ctx.strokeStyle = 'rgba(251,146,60,0.18)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        // Obstacles — solid border = blocks bullets, dashed = movement-only (mirrors in-game render)
        for (const o of map.obstacles) {
            const x = o.x * scale, y = o.y * scale, w = o.w * scale, h = o.h * scale;
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = o.blocksBullets ? 'rgba(251,146,60,0.6)' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash(o.blocksBullets ? [] : [5, 3]);
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
            ctx.setLineDash([]);
        }

        // Player start marker
        const spawnX = map.playerSpawn.x * scale, spawnY = map.playerSpawn.y * scale;
        ctx.beginPath();
        ctx.arc(spawnX, spawnY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = 'rgba(79,195,247,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(spawnX, spawnY, 13, 0, Math.PI * 2);
        ctx.stroke();
    }, [map]);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(251,146,60,0.2)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}
