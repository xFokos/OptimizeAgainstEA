import { useEffect, useRef } from 'react';
import { PREVIEW_W, PREVIEW_H } from './previewShared';

// ---- Horde Preview Canvas ----

const HORDE_PREVIEW_HC          = '#fb923c';
const HORDE_PREVIEW_AGENT_COUNT = 7;
const HORDE_PREVIEW_AGENT_R     = 12;

interface HordePreviewAgent {
    baseAngle:    number;
    radiusJitter: number;
    wobblePhase:  number;
}

interface HordePreviewBullet {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    lifetime: number;
}

export function HordePreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const bgCache = document.createElement('canvas');
        bgCache.width  = PREVIEW_W;
        bgCache.height = PREVIEW_H;
        const bgCtx = bgCache.getContext('2d')!;
        bgCtx.fillStyle = '#0f0f1a';
        bgCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        bgCtx.lineWidth   = 1;
        bgCtx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { bgCtx.moveTo(0, y); bgCtx.lineTo(PREVIEW_W, y); }
        bgCtx.stroke();
        bgCtx.strokeStyle = 'rgba(251,146,60,0.18)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const center      = { x: PREVIEW_W / 2, y: PREVIEW_H / 2 };
        const ringRadius  = PREVIEW_W * 0.4;

        const agents: HordePreviewAgent[] = Array.from({ length: HORDE_PREVIEW_AGENT_COUNT }, (_, i) => ({
            baseAngle:    (i / HORDE_PREVIEW_AGENT_COUNT) * Math.PI * 2,
            radiusJitter: (Math.random() - 0.5) * 20,
            wobblePhase:  Math.random() * Math.PI * 2,
        }));

        let bullets: HordePreviewBullet[] = [];
        let bulletTimer   = 0;
        let playerRot     = 0;
        let t             = 0;
        let lastTimestamp = 0;

        const drawPlayer = () => {
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(playerRot);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#4fc3f7';
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(26, 0);
            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.restore();
        };

        const drawAgents = () => {
            for (const a of agents) {
                const angle  = a.baseAngle + t * 0.08;
                const radius = ringRadius + a.radiusJitter + Math.sin(t * 1.4 + a.wobblePhase) * 6;
                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + Math.PI);
                ctx.beginPath(); ctx.arc(0, 0, HORDE_PREVIEW_AGENT_R + 4, 0, Math.PI * 2);
                ctx.strokeStyle = HORDE_PREVIEW_HC; ctx.lineWidth = 2; ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, HORDE_PREVIEW_AGENT_R, 0, Math.PI * 2);
                ctx.fillStyle = HORDE_PREVIEW_HC; ctx.fill();
                ctx.restore();
            }
        };

        const drawBullets = () => {
            ctx.fillStyle = '#80d8ff';
            ctx.beginPath();
            for (const b of bullets) {
                ctx.moveTo(b.pos.x + 4, b.pos.y);
                ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
            }
            ctx.fill();
        };

        const loop = (timestamp: number) => {
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;
            t += dt;

            playerRot += dt * 1.1;

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                bulletTimer = 0.3;
                bullets.push({
                    pos:      { ...center },
                    vel:      { x: Math.cos(playerRot) * 260, y: Math.sin(playerRot) * 260 },
                    lifetime: 1,
                });
            }

            bullets = bullets
                .map(b => ({ ...b, pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt }, lifetime: b.lifetime - dt }))
                .filter(b => b.lifetime > 0 && b.pos.x >= 0 && b.pos.x <= PREVIEW_W && b.pos.y >= 0 && b.pos.y <= PREVIEW_H);

            drawArena();
            drawAgents();
            drawBullets();
            drawPlayer();

            animRef = requestAnimationFrame(loop);
        };

        let animRef = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef);
    }, []);

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
