import { useEffect, useRef } from 'react';
import { DNA_INDEX, DNA_NAMES, type DNA } from '../shooter.types';
import styles from './arenaPreview.module.css';
import {
    ARENA_SIZE, BULLET_RADIUS,
    stepArenaAgent, drawArenaAgentTriangle,
    type ArenaAgentState, type ArenaBullet,
} from './arenaAgentSim';

// Same visual grammar and physics as DnaPreviewCanvas (arena box, blue
// player dot, orange EA triangle, real chase/range/aim/fire via
// arenaAgentSim.ts) so the player recognizes it as "the same kind of thing"
// rather than a new, disconnected diagram — just with many translucent EAs,
// each with their own (illustrative) DNA, all actually chasing/aiming/
// shooting at the same recorded player patrol at once, to show the whole
// population testing simultaneously. No dodge here (would need per-candidate
// incoming-bullet tracking, more clutter than value for this illustration).

const SWARM_COUNT      = 10;
const PLAYER_ORBIT_R   = ARENA_SIZE * 0.32;
const PLAYER_ANG_SPEED = 0.6; // matches DnaPreviewCanvas's player patrol

// Deterministic (not Math.random(), which would re-roll on every re-render)
// per-candidate DNA and starting angle — every candidate genuinely behaves a
// little differently (some hang back, some rush in) rather than being
// visual clones, echoing "a population of different candidates".
function makeCandidateDna(i: number): DNA {
    const g = (mult: number, offset: number) => 0.15 + 0.7 * Math.abs(Math.sin(i * mult + offset));
    const dna: DNA = new Array(DNA_NAMES.length).fill(0.5);
    dna[DNA_INDEX.AGGRESSION]      = g(1.3, 0.4);
    dna[DNA_INDEX.SHOOT_ACCURACY]  = g(2.1, 2.0);
    dna[DNA_INDEX.PREFERRED_RANGE] = g(0.9, 0.7);
    dna[DNA_INDEX.MOVEMENT_SPEED]  = g(1.5, 1.6);
    dna[DNA_INDEX.PREDICT_LEAD]    = g(1.1, 2.4);
    dna[DNA_INDEX.FIRE_RATE]       = g(1.9, 0.2);
    dna[DNA_INDEX.BULLET_SPEED]    = g(1.4, 1.9);
    return dna;
}

const CANDIDATES = Array.from({ length: SWARM_COUNT }, (_, i) => ({
    dna:        makeCandidateDna(i),
    startAngle: (i / SWARM_COUNT) * Math.PI * 2,
    opacity:    0.22 + 0.16 * Math.abs(Math.sin(i * 3.3)),
}));

interface GhostArenaVisualProps {
    /** When false, candidates move/aim/rotate normally but never fire — for
     * the "Population" step, shown before "Ghost Replay" introduces the
     * actual testing/scoring. Default true. */
    canShoot?: boolean;
}

export function GhostArenaVisual({ canShoot = true }: GhostArenaVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const cx = ARENA_SIZE * 0.5, cy = ARENA_SIZE * 0.5;
        const spawnR = ARENA_SIZE * 0.42;
        const swarm = CANDIDATES.map(c => ({
            dna:      c.dna,
            opacity:  c.opacity,
            agent:    {
                x: cx + Math.cos(c.startAngle) * spawnR,
                y: cy + Math.sin(c.startAngle) * spawnR,
                vx: 0, vy: 0, rot: 0,
            } satisfies ArenaAgentState,
            cooldown: (c.startAngle / (Math.PI * 2)) * 0.6, // stagger first shots
        }));
        let bullets: ArenaBullet[] = [];
        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            // The recorded run being replayed — every candidate targets this same patrol.
            const ang = t * PLAYER_ANG_SPEED;
            const ghost = {
                x:  cx + Math.cos(ang) * PLAYER_ORBIT_R,
                y:  cy + Math.sin(ang) * PLAYER_ORBIT_R,
                vx: -Math.sin(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
                vy:  Math.cos(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
            };

            for (const c of swarm) {
                const { cooldown, bullet } = stepArenaAgent(c.agent, c.dna, ghost, dt, c.cooldown);
                c.cooldown = cooldown;
                if (canShoot && bullet) bullets.push(bullet);
            }

            bullets = bullets
                .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20);

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

            // The recorded path itself — a faint guide ring.
            ctx.beginPath();
            ctx.arc(cx, cy, PLAYER_ORBIT_R, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.setLineDash([4, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            for (const b of bullets) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
                ctx.fill();
            }

            for (const c of swarm) drawArenaAgentTriangle(ctx, c.agent, c.opacity);

            // The ghost itself — the actual recorded run — drawn on top.
            ctx.beginPath();
            ctx.arc(ghost.x, ghost.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fill();
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [canShoot]);

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: 'rgba(255,255,255,0.85)' }} /> Ghost
                <span className={styles.legendDot} style={{ background: '#f97316' }} /> Candidates
            </div>
        </div>
    );
}
