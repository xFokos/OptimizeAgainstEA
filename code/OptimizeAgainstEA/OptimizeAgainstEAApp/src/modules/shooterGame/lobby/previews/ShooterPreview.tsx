import { useEffect, useRef } from 'react';
import { useSettings } from '../../../../context/SettingsContext';
import { vec } from '../../game/core/vec';
import { DNA_INDEX, GAME_CONFIG } from '../../shooter.types';
import { PREVIEW_W, PREVIEW_H, type PreviewAgent, type PreviewBullet } from './previewShared';

// ---- Mini Preview Canvas ----

export function ShooterPreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { shooterSettings } = useSettings();

    const dnaRef = useRef(shooterSettings.starterDna);
    useEffect(() => { dnaRef.current = shooterSettings.starterDna; }, [shooterSettings.starterDna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let agentA: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.25, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: 0,
            color:     '#4fc3f7',
            glowColor: 'rgba(79, 195, 247, 0.3)',
        };
        let agentB: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.75, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: Math.PI,
            color:     '#ef5350',
            glowColor: 'rgba(239, 83, 80, 0.3)',
        };

        let bullets: PreviewBullet[] = [];
        let bulletTimer   = 0;
        let lastTimestamp = 0;

        // Statischer Hintergrund gecacht – einmal zeichnen, dann per drawImage kopieren
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
        bgCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const drawAgent = (agent: PreviewAgent) => {
            ctx.save();
            ctx.translate(agent.pos.x, agent.pos.y);
            ctx.rotate(agent.rot);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(26, 0);
            ctx.strokeStyle = agent.color;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = agent.glowColor;
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.restore();
        };

        // Bullets gebündelt nach Farbe, kein shadowBlur
        const drawBullets = () => {
            const groups: Record<string, PreviewBullet[]> = {};
            for (const b of bullets) {
                (groups[b.color] ??= []).push(b);
            }
            for (const [color, group] of Object.entries(groups)) {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (const b of group) {
                    ctx.moveTo(b.pos.x + 4, b.pos.y);
                    ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
            }
        };

        const updateAgent = (agent: PreviewAgent, target: PreviewAgent, dt: number): PreviewAgent => {
            const dna        = dnaRef.current;
            const speed      = 30 + dna[DNA_INDEX.MOVEMENT_SPEED] * 70;
            const aggression = 0.3 + dna[DNA_INDEX.AGGRESSION] * 0.7;
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;

            const diff     = vec.sub(target.pos, agent.pos);
            const dist     = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };

            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };

            const rangeError = dist - prefRange;
            const rangeVel   = vec.scale(toTarget, rangeError * aggression * 1.5);

            const combined = vec.add(orbitVel, rangeVel);
            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.88);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);
            return agent;
        };

        const spawnBullets = (a: PreviewAgent, b: PreviewAgent) => {
            const dna         = dnaRef.current;
            const spread      = (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
            const bulletSpeed = (GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);

            const shoot = (from: PreviewAgent, to: PreviewAgent, color: string, owner: 'a' | 'b') => {
                const base  = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({
                    pos:      { ...from.pos },
                    vel:      { x: Math.cos(angle) * bulletSpeed, y: Math.sin(angle) * bulletSpeed },
                    color,
                    lifetime: 1.5,
                    owner,
                });
            };

            shoot(a, b, '#80d8ff', 'a');
            shoot(b, a, '#ff8a80', 'b');
        };

        const loop = (timestamp: number) => {
            // Preview braucht nur 30fps (rein dekorativ).
            // Threshold 31ms statt 33.33ms damit auf 60Hz-Displays (16.67ms/Frame) nie ein Frame
            // knapp unter dem Threshold liegt und das Preview unregelmäßig läuft.
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            agentA = updateAgent(agentA, agentB, dt);
            agentB = updateAgent(agentB, agentA, dt);

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                const fireRate  = dnaRef.current[DNA_INDEX.FIRE_RATE];
                bulletTimer = 1.4 - fireRate * 1.1 + Math.random() * 0.2;
                spawnBullets(agentA, agentB);
            }

            const AGENT_RADIUS  = 14;
            const BULLET_RADIUS = 4;
            const HIT_DIST      = AGENT_RADIUS + BULLET_RADIUS;

            bullets = bullets
                .map(b => ({
                    ...b,
                    pos:      { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
                    lifetime: b.lifetime - dt,
                }))
                .filter(b => {
                    if (b.lifetime <= 0 || !Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H)
                        return false;
                    const target = b.owner === 'a' ? agentB : agentA;
                    const dx = b.pos.x - target.pos.x;
                    const dy = b.pos.y - target.pos.y;
                    return dx * dx + dy * dy >= HIT_DIST * HIT_DIST;
                });

            drawArena();
            drawBullets();
            drawAgent(agentA);
            drawAgent(agentB);

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
                border:       '1px solid rgba(255,255,255,0.08)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}
