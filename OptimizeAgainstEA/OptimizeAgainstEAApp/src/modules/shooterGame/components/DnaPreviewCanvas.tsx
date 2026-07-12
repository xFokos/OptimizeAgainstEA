import { useEffect, useRef } from 'react';
import { DNA_INDEX, type DNA } from '../shooter.types';
import styles from './arenaPreview.module.css';
import {
    ARENA_SIZE, ARENA_SCALE, BULLET_RADIUS, AGENT_RADIUS,
    stepArenaAgent, drawArenaAgentTriangle,
    type ArenaBullet,
} from './arenaAgentSim';

// A tiny, self-contained live demo: not the real game loop (that's tangled up
// with player input, mods, bullets-as-GameState, scoring, ...), but the exact
// same agent-AI formulas from game/core/gameLoop.ts's updateAgent (via
// arenaAgentSim.ts, shared with GhostArenaVisual), ported standalone so a
// first-timer can *watch* a DNA value change the EA's actual behavior
// instead of just reading about it.
//
// Controlled: the caller owns the DNA vector (e.g. driven by real sliders —
// see ShooterDnaSection in settings/ShooterSettings.tsx) and passes it in as
// `dna`. The simulation itself (agent position/velocity/bullets) runs
// continuously in its own requestAnimationFrame loop that mounts once and
// never restarts — it just reads the latest `dna` via a ref each frame, so
// dragging a slider updates the agent's behavior immediately without
// resetting its position or momentum.

const NEAR_BULLET_DIST = 120 * ARENA_SCALE;
const WALL_MARGIN      = AGENT_RADIUS + 40 * ARENA_SCALE;
const PLAYER_ORBIT_R   = ARENA_SIZE * 0.32;
const PLAYER_ANG_SPEED = 0.6;

interface DnaPreviewCanvasProps {
    /** The live DNA vector to visualize — update it (e.g. from a slider's
     * onChange) and the agent's behavior follows immediately. */
    dna: DNA;
}

export function DnaPreviewCanvas({ dna }: DnaPreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dnaRef    = useRef(dna);

    // Mirrors the latest `dna` prop into a ref the perpetual RAF loop below
    // reads from — keeps the ref updated without restarting that loop (which
    // only depends on `[]`, see below) and without mutating a ref during
    // render (not allowed under the new react-hooks/refs rule).
    useEffect(() => {
        dnaRef.current = dna;
    }, [dna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const agent = { x: ARENA_SIZE * 0.5, y: ARENA_SIZE * 0.5, vx: 0, vy: 0, rot: 0 };
        let bullets: (ArenaBullet & { owner: 'agent' | 'player' })[] = [];
        let agentCooldown  = 0;
        let playerCooldown = 0;
        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            const dna = dnaRef.current;

            // Player: slow circular patrol — just something for the agent to react to.
            const cx = ARENA_SIZE * 0.5, cy = ARENA_SIZE * 0.5;
            const ang = t * PLAYER_ANG_SPEED;
            const player = {
                x:  cx + Math.cos(ang) * PLAYER_ORBIT_R,
                y:  cy + Math.sin(ang) * PLAYER_ORBIT_R,
                vx: -Math.sin(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
                vy:  Math.cos(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
            };

            // Player takes an occasional shot at the agent, so DODGE_WEIGHT has something to react to.
            playerCooldown -= dt;
            if (playerCooldown <= 0) {
                playerCooldown = 1.4;
                const dx = agent.x - player.x, dy = agent.y - player.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 260 * ARENA_SCALE;
                bullets.push({ x: player.x, y: player.y, vx: (dx / len) * speed, vy: (dy / len) * speed, owner: 'player', life: 2 });
            }

            // Dodge: the one piece of agent AI not in the shared stepArenaAgent
            // (needs this canvas's own incoming-bullet list) — computed here
            // and passed in as an extra force.
            let nearBullet: ArenaBullet | undefined;
            let nearDistSq = NEAR_BULLET_DIST * NEAR_BULLET_DIST;
            for (const b of bullets) {
                if (b.owner !== 'player') continue;
                const d2 = (b.x - agent.x) ** 2 + (b.y - agent.y) ** 2;
                if (d2 < nearDistSq) { nearBullet = b; nearDistSq = d2; }
            }
            let dodgeX = 0, dodgeY = 0;
            if (nearBullet && Math.random() <= dna[DNA_INDEX.DODGE_WEIGHT]) {
                const bvLen = Math.sqrt(nearBullet.vx ** 2 + nearBullet.vy ** 2) || 1;
                const nvx = nearBullet.vx / bvLen, nvy = nearBullet.vy / bvLen;
                const px = -nvy, py = nvx;
                const tax = agent.x - nearBullet.x, tay = agent.y - nearBullet.y;
                let side = (px * tax + py * tay) >= 0 ? 1 : -1;
                const dpx = px * side, dpy = py * side;
                if ((dpx > 0 && agent.x > ARENA_SIZE - WALL_MARGIN) ||
                    (dpx < 0 && agent.x < WALL_MARGIN) ||
                    (dpy > 0 && agent.y > ARENA_SIZE - WALL_MARGIN) ||
                    (dpy < 0 && agent.y < WALL_MARGIN)) side = -side;
                const s = side * dna[DNA_INDEX.MOVEMENT_SPEED];
                dodgeX = px * s;
                dodgeY = py * s;
            }

            const { cooldown, bullet } = stepArenaAgent(agent, dna, player, dt, agentCooldown, dodgeX, dodgeY);
            agentCooldown = cooldown;
            if (bullet) bullets.push({ ...bullet, owner: 'agent' });

            bullets = bullets
                .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20);

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

            const preferredDist = dna[DNA_INDEX.PREFERRED_RANGE] * 300 * ARENA_SCALE + 100 * ARENA_SCALE;
            ctx.beginPath();
            ctx.arc(player.x, player.y, preferredDist, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            for (const b of bullets) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = b.owner === 'agent' ? '#f97316' : 'rgba(255,255,255,0.75)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();

            drawArenaAgentTriangle(ctx, agent);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []); // mount once — dna changes are read live via dnaRef, not restarted

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> You
                <span className={styles.legendDot} style={{ background: '#f97316' }} /> EA
            </div>
        </div>
    );
}
