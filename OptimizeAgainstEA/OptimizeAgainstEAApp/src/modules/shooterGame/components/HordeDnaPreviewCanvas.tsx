import { useEffect, useRef } from 'react';
import { DNA_INDEX, type DNA } from '../shooter.types';
import {
    LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, loopOffsetRad,
    SIZE_GENE_INDEX, OPACITY_GENE_INDEX,
} from '../horde/hordeDna';
import styles from './arenaPreview.module.css';
import { ARENA_SIZE, clamp01, bulletHits, patrol, type ArenaBullet } from './arenaAgentSim';

// Horde counterpart of DnaPreviewCanvas: same arena box and controlled-`dna`
// pattern (slider changes apply live via a ref, the RAF loop never restarts),
// but the agent is a Horde blob — melee-only, so the ported formulas come
// from horde/hordeEngine.ts's updateHorde (wander/chase blend, bullet dodge,
// evolved movement loop, size/opacity body genes), not from the 1v1 shooter's
// updateAgent. No obstacles/flow field here: with a clear line of sight the
// routed direction equals the direct line anyway.
//
// The player patrols and takes slightly-scattered shots at the blob — so
// Dodge has something to react to and Size/Opacity visibly pay off (smaller,
// fainter blobs genuinely get hit less). A landed hit or a touch on the
// player kills/"scores" the blob and it respawns at an arena edge, acting
// out the Horde's actual life cycle.

const SPD_MAX_PREVIEW  = 220 * (ARENA_SIZE / 800);
// Real Horde radii are 8–22px on an 800px arena — scaled 1:1 that's nearly
// invisible at 240px, so the preview uses a gentler factor for legibility.
const MIN_R = 5, MAX_R = 13;
const MIN_OPACITY = 0.15, MAX_OPACITY = 1.0;

const PLAYER_ANG_SPEED = 0.5;
const PLAYER_ORBIT_R   = ARENA_SIZE * 0.3;
const PLAYER_FIRE_EVERY = 1.1;
const PLAYER_BULLET_SPEED = 260 * (ARENA_SIZE / 800);
const PLAYER_SCATTER   = 0.16;   // rad — misses happen, so Size/Dodge matter
const DODGE_SCAN_DIST  = 80;     // px — react to bullets closer than this

const HC = '#fb923c';

interface HordeDnaPreviewCanvasProps {
    /** Live Horde-layout DNA (base genes + loop steps + size + opacity) —
     * update it from sliders and the blob's behavior follows immediately. */
    dna: DNA;
}

export function HordeDnaPreviewCanvas({ dna }: HordeDnaPreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dnaRef    = useRef(dna);

    useEffect(() => {
        dnaRef.current = dna;
    }, [dna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const blob = {
            x: ARENA_SIZE * 0.15, y: ARENA_SIZE * 0.15,
            vx: 0, vy: 0,
            wanderAngle: Math.random() * Math.PI * 2,
            loopIndex:   0,
            loopTimer:   LOOP_STEP_DURATION,
        };
        let bullets: ArenaBullet[] = [];
        let playerCooldown = 0.8;
        let respawns   = 0;
        let deathFlash: { x: number; y: number; t: number } | null = null;  // blob got shot
        let touchFlash = 0;                                                  // blob reached the player
        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const respawn = () => {
            respawns += 1;
            const side  = respawns % 4;
            const along = 0.2 + 0.6 * Math.abs(Math.sin(respawns * 2.4));
            blob.x = side === 1 ? ARENA_SIZE - 8 : side === 3 ? 8 : along * ARENA_SIZE;
            blob.y = side === 0 ? 8 : side === 2 ? ARENA_SIZE - 8 : along * ARENA_SIZE;
            blob.vx = 0; blob.vy = 0;
        };

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            const dna    = dnaRef.current;
            const radius = MIN_R + (dna[SIZE_GENE_INDEX] ?? 0.5) * (MAX_R - MIN_R);
            const player = patrol(t, PLAYER_ANG_SPEED, PLAYER_ORBIT_R);

            playerCooldown -= dt;
            if (playerCooldown <= 0) {
                playerCooldown = PLAYER_FIRE_EVERY;
                const aim = Math.atan2(blob.y - player.y, blob.x - player.x)
                    + (Math.random() - 0.5) * 2 * PLAYER_SCATTER;
                bullets.push({
                    x: player.x, y: player.y,
                    vx: Math.cos(aim) * PLAYER_BULLET_SPEED,
                    vy: Math.sin(aim) * PLAYER_BULLET_SPEED,
                    life: 2,
                });
            }

            // ---- Blob steering — ported from updateHorde ----
            const dx = player.x - blob.x, dy = player.y - blob.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const toX = dx / dist, toY = dy / dist;
            const agg = dna[DNA_INDEX.AGGRESSION];

            blob.wanderAngle += (Math.random() - 0.5) * (1 - agg) * 3.5 * dt;
            let dirX = agg * toX + (1 - agg) * Math.cos(blob.wanderAngle);
            let dirY = agg * toY + (1 - agg) * Math.sin(blob.wanderAngle);

            // Bullet dodge (scales with DODGE_WEIGHT), same shape as the engine's.
            for (const b of bullets) {
                const bdx = b.x - blob.x, bdy = b.y - blob.y;
                if (bdx * bdx + bdy * bdy < DODGE_SCAN_DIST * DODGE_SCAN_DIST) {
                    const bLen = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    if (bLen > 0) {
                        const px = -b.vy / bLen, py = b.vx / bLen;
                        const side = (px * bdx + py * bdy) >= 0 ? 1 : -1;
                        dirX += px * side * dna[DNA_INDEX.DODGE_WEIGHT];
                        dirY += py * side * dna[DNA_INDEX.DODGE_WEIGHT];
                    }
                }
            }

            // Evolved movement loop: per-step steering rotation on a fixed schedule.
            blob.loopTimer -= dt;
            if (blob.loopTimer <= 0) {
                blob.loopIndex = (blob.loopIndex + 1) % LOOP_STEPS;
                blob.loopTimer += LOOP_STEP_DURATION;
            }
            const loopAngle = loopOffsetRad(dna[LOOP_GENE_START + blob.loopIndex] ?? 0.5);
            const cosL = Math.cos(loopAngle), sinL = Math.sin(loopAngle);
            [dirX, dirY] = [dirX * cosL - dirY * sinL, dirX * sinL + dirY * cosL];

            const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            const speed  = dna[DNA_INDEX.MOVEMENT_SPEED] * SPD_MAX_PREVIEW;
            blob.vx = blob.vx * 0.8 + (dirX / dirLen) * speed * 0.2;
            blob.vy = blob.vy * 0.8 + (dirY / dirLen) * speed * 0.2;
            blob.x  = Math.max(radius, Math.min(ARENA_SIZE - radius, blob.x + blob.vx * dt));
            blob.y  = Math.max(radius, Math.min(ARENA_SIZE - radius, blob.y + blob.vy * dt));

            // ---- Hits: a landed shot kills the blob, a touch "kills" the player ----
            bullets = bullets
                .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20)
                .filter(b => {
                    if (bulletHits(b, blob.x, blob.y, radius)) {
                        deathFlash = { x: blob.x, y: blob.y, t: 0 };
                        respawn();
                        return false;
                    }
                    return true;
                });
            if ((blob.x - player.x) ** 2 + (blob.y - player.y) ** 2 < (radius + 9) ** 2) {
                touchFlash = 0.001;
                respawn();
            }

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

            for (const b of bullets) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fill();
            }

            // Death burst where the blob got shot.
            if (deathFlash) {
                deathFlash.t += dt;
                const k = deathFlash.t / 0.4;
                if (k >= 1) deathFlash = null;
                else {
                    ctx.beginPath();
                    ctx.arc(deathFlash.x, deathFlash.y, 6 + k * 14, 0, Math.PI * 2);
                    ctx.globalAlpha = 1 - k;
                    ctx.strokeStyle = HC;
                    ctx.lineWidth   = 2;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            // Touch flash on the player — in the real game this would be game over.
            if (touchFlash > 0) {
                touchFlash += dt;
                const k = touchFlash / 0.5;
                if (k >= 1) touchFlash = 0;
                else {
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, 9 + k * 12, 0, Math.PI * 2);
                    ctx.globalAlpha = 1 - k;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth   = 2.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            ctx.beginPath();
            ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();

            const opacity = MIN_OPACITY + (dna[OPACITY_GENE_INDEX] ?? 0.5) * (MAX_OPACITY - MIN_OPACITY);
            ctx.beginPath();
            ctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
            ctx.globalAlpha = clamp01(opacity);
            ctx.fillStyle   = HC;
            ctx.fill();
            ctx.globalAlpha = 1;
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []); // mount once — dna changes are read live via dnaRef, not restarted

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> You
                <span className={styles.legendDot} style={{ background: HC }} /> Horde agent
            </div>
        </div>
    );
}
