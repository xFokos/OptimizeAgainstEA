import { useEffect, useRef } from 'react';
import { useSettings } from '../../../../context/SettingsContext';
import { vec } from '../../game/core/vec';
import { DNA_INDEX, GAME_CONFIG } from '../../shooter.types';
import { PREVIEW_W, PREVIEW_H, type PreviewAgent, type PreviewBullet } from './previewShared';

// ---- Raidboss Preview Canvas ----

const BOSS_DNA = [0.85, 0.7, 0.9, 0.5, 0.8, 0.8, 0.9, 0.8];
const PLAYER_R = 14;
const BOSS_R   = 22;

export function RaidbossPreview() {
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
            color:     '#a855f7',
            glowColor: 'rgba(168, 85, 247, 0.55)',
        };

        let bullets: PreviewBullet[] = [];
        let bulletTimer   = 0;
        let lastTimestamp = 0;

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
        bgCtx.strokeStyle = 'rgba(168,85,247,0.18)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const drawAgent = (agent: PreviewAgent, radius: number) => {
            ctx.save();
            ctx.translate(agent.pos.x, agent.pos.y);
            ctx.rotate(agent.rot);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(radius + 12, 0);
            ctx.strokeStyle = agent.color;
            ctx.lineWidth   = radius === BOSS_R ? 4 : 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = agent.glowColor;
            ctx.lineWidth   = radius === BOSS_R ? 5 : 3;
            ctx.stroke();
            ctx.restore();
        };

        const drawBullets = () => {
            const groups: Record<string, PreviewBullet[]> = {};
            for (const b of bullets) { (groups[b.color] ??= []).push(b); }
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

        const updateAgent = (agent: PreviewAgent, target: PreviewAgent, dna: readonly number[], dt: number): PreviewAgent => {
            const speed      = 30 + dna[DNA_INDEX.MOVEMENT_SPEED] * 70;
            const aggression = 0.3 + dna[DNA_INDEX.AGGRESSION] * 0.7;
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;
            const diff       = vec.sub(target.pos, agent.pos);
            const dist       = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget   = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };
            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };
            const rangeError = dist - prefRange;
            const rangeVel   = vec.scale(toTarget, rangeError * aggression * 1.5);
            const combined   = vec.add(orbitVel, rangeVel);
            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.88);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);
            return agent;
        };

        const spawnBullets = (a: PreviewAgent, b: PreviewAgent) => {
            const playerDna = dnaRef.current;
            const shootA = (from: PreviewAgent, to: PreviewAgent) => {
                const spread = (1 - playerDna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
                const speed  = (GAME_CONFIG.BULLET_SPEED_MIN + playerDna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);
                const base   = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle  = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({ pos: { ...from.pos }, vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, color: '#80d8ff', lifetime: 1.5, owner: 'a' });
            };
            const shootB = (from: PreviewAgent, to: PreviewAgent) => {
                const spread = (1 - BOSS_DNA[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
                const speed  = (GAME_CONFIG.BULLET_SPEED_MIN + BOSS_DNA[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);
                const base   = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle  = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({ pos: { ...from.pos }, vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, color: '#cc88ff', lifetime: 1.5, owner: 'b' });
            };
            shootA(a, b);
            shootB(b, a);
        };

        const loop = (timestamp: number) => {
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            agentA = updateAgent(agentA, agentB, dnaRef.current, dt);
            agentB = updateAgent(agentB, agentA, BOSS_DNA, dt);

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                const fireRate  = BOSS_DNA[DNA_INDEX.FIRE_RATE];
                bulletTimer = 1.4 - fireRate * 1.1 + Math.random() * 0.2;
                spawnBullets(agentA, agentB);
            }

            bullets = bullets
                .map(b => ({ ...b, pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt }, lifetime: b.lifetime - dt }))
                .filter(b => {
                    if (b.lifetime <= 0 || !Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H) return false;
                    const target = b.owner === 'a' ? agentB : agentA;
                    const hitR   = b.owner === 'a' ? BOSS_R : PLAYER_R;
                    const dx = b.pos.x - target.pos.x;
                    const dy = b.pos.y - target.pos.y;
                    return dx * dx + dy * dy >= (hitR + 4) * (hitR + 4);
                });

            drawArena();
            drawBullets();
            drawAgent(agentA, PLAYER_R);
            drawAgent(agentB, BOSS_R);

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
                border:       '1px solid rgba(168,85,247,0.2)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}
