import { useEffect, useRef } from 'react';
import { DNA_INDEX, DNA_NAMES, type DNA } from '../shooter.types';
import styles from './arenaPreview.module.css';
import {
    ARENA_SIZE, ARENA_SCALE, BULLET_RADIUS, AGENT_RADIUS,
    stepArenaAgent, drawArenaAgentTriangle,
    type ArenaAgentState, type ArenaBullet,
} from './arenaAgentSim';

// Same visual grammar and physics as DnaPreviewCanvas (arena box, blue
// player dot, orange EA triangle, real chase/range/aim/fire via
// arenaAgentSim.ts) so the player recognizes it as "the same kind of thing"
// rather than a new, disconnected diagram.
//
// The default mode acts out the whole ghost-replay story in two phases:
//   1. LIVE   — the blue player plays one normal round (exactly one full lap
//               of the patrol circle) against a single solid EA: both move,
//               both shoot. Recorded from the very first frame: a blinking
//               ● REC and the path drawing itself behind the player run the
//               whole time. The EA fades out just before the lap completes.
//   2. REPLAY — the player dot becomes a white ghost looping that exact
//               recorded lap (blinking out/in at each restart so it reads as
//               "the clip starts over"), and the translucent candidates fade
//               in, all chasing/aiming/shooting at it simultaneously (each
//               with its own illustrative DNA). No dodge here (would need
//               per-candidate incoming-bullet tracking, more clutter than
//               value for this illustration).

const SWARM_COUNT      = 10;
const PLAYER_ORBIT_R   = ARENA_SIZE * 0.32;
const PLAYER_ANG_SPEED = 0.9; // a bit brisker than DnaPreviewCanvas's patrol, so one lap ≈ 7s
const CX = ARENA_SIZE * 0.5, CY = ARENA_SIZE * 0.5;

// ---- Timeline (seconds) ----
const CLIP_LENGTH  = (Math.PI * 2) / PLAYER_ANG_SPEED; // the recorded round: exactly one full lap
const REPLAY_LAPS  = 2;                                // the swarm fights the ghost for this many laps...
const CYCLE_LENGTH = CLIP_LENGTH * (1 + REPLAY_LAPS);  // ...then the whole story restarts from the live round
const EA_FADE      = 0.5;  // live opponent fade-out as the lap completes
const SWARM_STAGGER = 0.12; // candidates fade in one after another...
const SWARM_FADE    = 0.6;  // ...each over this long
const GHOST_WRAP_FADE = 0.25; // ghost blinks out/in when the clip loops

const PLAYER_FIRE_EVERY  = 1.4;
const PLAYER_BULLET_SPEED = 260 * ARENA_SCALE;

// The single fixed opponent of the live round — deliberately mid-of-the-road
// DNA with decent aim/fire so the "normal game" phase visibly fights back.
const LIVE_DNA: DNA = (() => {
    const dna: DNA = new Array(DNA_NAMES.length).fill(0.5);
    dna[DNA_INDEX.SHOOT_ACCURACY] = 0.7;
    dna[DNA_INDEX.FIRE_RATE]      = 0.6;
    return dna;
})();

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

// Roster view for the "Population" step: the candidates stand in a grid,
// facing up, nobody moving or firing — but they *appear* one by one: a single
// agent stands alone for a beat first, then the rest fade in to fill the
// grid, matching the step's "one agent alone would be fragile, so there are
// N of them" argument. The whole fill-in loops forever as generations: a
// "Gen N" counter ticks up each time the full roster is swapped out for a
// fresh one that assembles again from a single agent — acting out the step's
// "replace the whole roster → next generation" line. The ghost/replay action
// is the *next* step's job.

const LINEUP_FIRST_HOLD  = 1.2;  // how long the lone first agent stands by itself
const LINEUP_SPAWN_EVERY = 0.25; // then one more appears every ... seconds
const LINEUP_LAST_HOLD   = 1.2;  // beat before the final agent completes the roster
const LINEUP_FADE        = 0.35; // per-agent fade-in duration
const LINEUP_HOLD_FULL   = 1.6;  // full roster stands before the next generation restarts

function lineupSpots(count: number) {
    const cols   = Math.ceil(Math.sqrt(count));
    const rows   = Math.ceil(count / cols);
    const margin = ARENA_SIZE * 0.16;
    const stepX  = cols > 1 ? (ARENA_SIZE - margin * 2) / (cols - 1) : 0;
    const stepY  = rows > 1 ? (ARENA_SIZE - margin * 2) / (rows - 1) : 0;

    return Array.from({ length: count }, (_, i) => {
        const row   = Math.floor(i / cols);
        const col   = i % cols;
        const inRow = row === rows - 1 ? count - row * cols : cols;
        return {
            x: cols > 1 ? margin + ((cols - inRow) * stepX) / 2 + col * stepX : ARENA_SIZE / 2,
            y: rows > 1 ? margin + row * stepY : ARENA_SIZE / 2,
            // Tiny deterministic per-candidate tilt/opacity spread — they read
            // as individuals, not stamped copies, without anything moving.
            rot:     -Math.PI / 2 + Math.sin(i * 2.7) * 0.14,
            opacity: 0.5 + 0.45 * Math.abs(Math.sin(i * 3.3)),
        };
    });
}

function drawGenLabel(ctx: CanvasRenderingContext2D, label: string) {
    ctx.font         = "700 12px 'JetBrains Mono', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = 'rgba(255,255,255,0.6)';
    ctx.fillText(label, ARENA_SIZE / 2, 16);
}

const bulletHits = (b: ArenaBullet, x: number, y: number, r: number) =>
    (b.x - x) ** 2 + (b.y - y) ** 2 < (r + BULLET_RADIUS) ** 2;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

// The player's recorded run — same deterministic circular patrol during the
// live round and during the ghost's looped replay of it.
function patrol(time: number) {
    const ang = time * PLAYER_ANG_SPEED;
    return {
        x:  CX + Math.cos(ang) * PLAYER_ORBIT_R,
        y:  CY + Math.sin(ang) * PLAYER_ORBIT_R,
        vx: -Math.sin(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
        vy:  Math.cos(ang) * PLAYER_ORBIT_R * PLAYER_ANG_SPEED,
    };
}

// Selection view: the same standing roster grid as the lineup, fully
// assembled from the start — then two candidates get picked as the parents,
// one after the other: recolored (blue/orange, the exact Parent A/B colors
// the Crossover step's table uses next) with a pulsing ring, while everyone
// else dims. Plays once and stays — the rings keep gently pulsing on the
// final picture (re-entering the step replays it, since ExplainerFlow
// remounts each step).

const SELECT_IDLE = 1.0;  // roster stands before the first parent is picked
const SELECT_GAP  = 0.8;  // ...second parent follows this much later
const SELECT_FADE = 0.35; // highlight/dim transition duration

const PARENT_A_COLOR = '#60a5fa';
const PARENT_B_COLOR = '#f97316';

// Next-generation view: closes the tutorial's loop. Each cycle: a fresh
// roster assembles quickly under a "Gen N" label → its best candidate gets
// highlighted, steps out of the grid while the rest fade away → the blue
// player returns and the next round plays out (real AI, both shooting). Then
// the label ticks to Gen N+1 and it all repeats — the animation itself acts
// out "your opponent keeps adapting, round after round".

const NG_STAGGER   = 0.05; // roster assembles much faster than the Population step
const NG_FADE      = 0.3;
const NG_HOLD      = 0.8;  // assembled roster stands before the best is picked
const NG_PICK_FADE = 0.45; // pick highlights / the rest fade away
const NG_MOVE      = 0.6;  // the pick glides from its grid spot into the arena
const NG_FIGHT     = 4.5;  // the next round, live
const NG_OUT       = 0.4;  // everything fades before the next cycle

interface GhostArenaVisualProps {
    /** 'replay' (default): the staged live-round → recording → replay demo.
     * 'lineup': roster grid assembling agent by agent, looping generations.
     * 'selection': static roster grid, two parents get highlighted.
     * 'nextgen': new roster assembles → best steps out → next round vs you. */
    variant?: 'replay' | 'lineup' | 'selection' | 'nextgen';
    /** lineup/selection/nextgen: how many candidates the grid holds — pass
     * the player's real populationSize so the picture matches the step text. */
    count?: number;
}

export function GhostArenaVisual({ variant = 'replay', count = SWARM_COUNT }: GhostArenaVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        if (variant === 'nextgen') {
            const spots     = lineupSpots(count);
            const pick      = Math.floor(count * 0.4);
            const bornAt    = (i: number) => i * NG_STAGGER;
            const assembled = bornAt(count - 1) + NG_FADE;
            const pickAt    = assembled + NG_HOLD;
            const moveAt    = pickAt + NG_PICK_FADE;
            const fightAt   = moveAt + NG_MOVE;
            const cycle     = fightAt + NG_FIGHT + NG_OUT;
            const eaStart   = { x: CX - PLAYER_ORBIT_R * 0.6, y: CY };

            const ea = {
                agent:    { x: 0, y: 0, vx: 0, vy: 0, rot: 0 } satisfies ArenaAgentState,
                cooldown: 0.4,
            };
            let bullets: (ArenaBullet & { owner: 'player' | 'ea' })[] = [];
            let playerCooldown = 0.9;
            let gen  = 2;
            let t    = 0;
            let last = performance.now();
            let raf  = 0;

            const resetCycle = () => {
                ea.agent.x  = spots[pick].x;
                ea.agent.y  = spots[pick].y;
                ea.agent.vx = 0; ea.agent.vy = 0;
                ea.agent.rot = spots[pick].rot;
                ea.cooldown  = 0.4;
                playerCooldown = 0.9;
                bullets = [];
            };
            resetCycle();

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;
                if (t >= cycle) {
                    t -= cycle;
                    gen += 1;
                    resetCycle();
                }

                const fighting = t >= fightAt;
                const tFight   = t - fightAt;
                const player   = patrol(tFight);
                const outK     = clamp01((cycle - t) / NG_OUT);

                if (fighting) {
                    const { cooldown, bullet } = stepArenaAgent(ea.agent, LIVE_DNA, player, dt, ea.cooldown);
                    ea.cooldown = cooldown;
                    if (bullet) bullets.push({ ...bullet, owner: 'ea' });

                    playerCooldown -= dt;
                    if (playerCooldown <= 0) {
                        playerCooldown = PLAYER_FIRE_EVERY;
                        const dx = ea.agent.x - player.x, dy = ea.agent.y - player.y;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        bullets.push({
                            x: player.x, y: player.y,
                            vx: (dx / len) * PLAYER_BULLET_SPEED,
                            vy: (dy / len) * PLAYER_BULLET_SPEED,
                            owner: 'player', life: 2,
                        });
                    }
                } else if (t >= moveAt) {
                    // The chosen one glides from its grid spot into the arena,
                    // turning to face where the player is about to appear.
                    const mk = clamp01((t - moveAt) / NG_MOVE);
                    ea.agent.x = spots[pick].x + (eaStart.x - spots[pick].x) * mk;
                    ea.agent.y = spots[pick].y + (eaStart.y - spots[pick].y) * mk;
                    const targetRot = Math.atan2(patrol(0).y - ea.agent.y, patrol(0).x - ea.agent.x);
                    ea.agent.rot = spots[pick].rot + (targetRot - spots[pick].rot) * mk;
                }

                bullets = bullets
                    .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                    .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20)
                    .filter(b => !(b.owner === 'player'
                        ? bulletHits(b, ea.agent.x, ea.agent.y, AGENT_RADIUS)
                        : bulletHits(b, player.x, player.y, 7)));

                // ---- Draw ----
                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
                drawGenLabel(ctx, `Gen ${gen}`);

                for (const b of bullets) {
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
                    ctx.globalAlpha = outK;
                    ctx.fillStyle = b.owner === 'ea' ? '#f97316' : 'rgba(255,255,255,0.75)';
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                // The rest of the roster — assembles in, fades away once the
                // best has been picked.
                spots.forEach((s, i) => {
                    if (i === pick) return;
                    const a = s.opacity
                        * clamp01((t - bornAt(i)) / NG_FADE)
                        * clamp01(1 - (t - pickAt) / NG_PICK_FADE);
                    if (a <= 0) return;
                    drawArenaAgentTriangle(ctx, { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot }, a);
                });

                // The generation's best — lifts from roster-translucency to
                // fully solid as it gets picked.
                const liftK = clamp01((t - pickAt) / NG_PICK_FADE);
                const pickOpacity = (spots[pick].opacity + (1 - spots[pick].opacity) * liftK)
                    * clamp01((t - bornAt(pick)) / NG_FADE) * outK;
                if (pickOpacity > 0) drawArenaAgentTriangle(ctx, ea.agent, pickOpacity);

                if (t >= pickAt && !fighting) {
                    ctx.beginPath();
                    ctx.arc(ea.agent.x, ea.agent.y, 13 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
                    ctx.globalAlpha = liftK * 0.9;
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth   = 2;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                // You, back for the next round.
                if (fighting) {
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
                    ctx.globalAlpha = clamp01(tFight / 0.3) * outK;
                    ctx.fillStyle = '#60a5fa';
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        if (variant === 'selection') {
            const spots   = lineupSpots(count);
            const pickA   = Math.floor(count * 0.25);
            const pickB   = count > 1 ? Math.floor(count * 0.65) : 0;
            const pickedAt = (i: number) => (i === pickA ? SELECT_IDLE : SELECT_IDLE + SELECT_GAP);
            let t    = 0;
            let last = performance.now();
            let raf  = 0;

            const draw = (now: number) => {
                raf = requestAnimationFrame(draw);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

                // Everyone else steps back once the picking starts.
                const dimK = 1 - 0.65 * Math.min(Math.max((t - SELECT_IDLE) / SELECT_FADE, 0), 1);

                spots.forEach((s, i) => {
                    const agent = { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot };
                    const isPick = i === pickA || (i === pickB && pickB !== pickA);
                    if (!isPick) {
                        drawArenaAgentTriangle(ctx, agent, s.opacity * dimK);
                        return;
                    }
                    const k = Math.min(Math.max((t - pickedAt(i)) / SELECT_FADE, 0), 1);
                    const color = i === pickA ? PARENT_A_COLOR : PARENT_B_COLOR;
                    // Blend from ordinary roster member to fully-lit parent.
                    drawArenaAgentTriangle(ctx, agent, s.opacity * dimK * (1 - k));
                    if (k > 0) {
                        drawArenaAgentTriangle(ctx, agent, k, color);
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, 13 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
                        ctx.globalAlpha = k * 0.9;
                        ctx.strokeStyle = color;
                        ctx.lineWidth   = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                });
            };

            raf = requestAnimationFrame(draw);
            return () => cancelAnimationFrame(raf);
        }

        if (variant === 'lineup') {
            const spots  = lineupSpots(count);
            const bornAt = (i: number) => {
                if (i === 0) return 0;
                const steady = LINEUP_FIRST_HOLD + (i - 1) * LINEUP_SPAWN_EVERY;
                // Mirror the first agent's solo beat at the end: the roster
                // stands one-short for a moment before the last one arrives.
                return i === count - 1 ? steady + LINEUP_LAST_HOLD : steady;
            };
            const cycle  = bornAt(count - 1) + LINEUP_FADE + LINEUP_HOLD_FULL;
            let t    = 0;
            let gen  = 1;
            let last = performance.now();
            let raf  = 0;

            const drawIn = (now: number) => {
                raf = requestAnimationFrame(drawIn);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                // Full roster has stood for its beat → swap it out wholesale:
                // next generation, assembling again from a single agent.
                if (t >= cycle) {
                    t -= cycle;
                    gen += 1;
                }

                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
                drawGenLabel(ctx, `Gen ${gen}`);

                spots.forEach((s, i) => {
                    const age = t - bornAt(i);
                    if (age <= 0) return;
                    drawArenaAgentTriangle(
                        ctx,
                        { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot },
                        s.opacity * Math.min(age / LINEUP_FADE, 1),
                    );
                });
            };

            raf = requestAnimationFrame(drawIn);
            return () => cancelAnimationFrame(raf);
        }

        // ---- Staged demo: live round → recording → looped ghost replay ----
        const swarm = CANDIDATES.map((c, i) => ({
            dna:      c.dna,
            opacity:  c.opacity,
            bornAt:   CLIP_LENGTH + i * SWARM_STAGGER,
            agent:    { x: 0, y: 0, vx: 0, vy: 0, rot: 0 } satisfies ArenaAgentState,
            cooldown: 0,
        }));
        const liveEa = {
            agent:    { x: 0, y: 0, vx: 0, vy: 0, rot: 0 } satisfies ArenaAgentState,
            cooldown: 0,
        };
        let bullets: (ArenaBullet & { owner: 'player' | 'ea' | 'swarm' })[] = [];
        let playerCooldown = 0;

        // Everything back to the start of the live round — used both for the
        // initial state and each time the whole story loops around.
        const resetCycle = () => {
            CANDIDATES.forEach((c, i) => {
                const s = swarm[i];
                // Like the real simulateAgainstGhost: every candidate starts
                // its run from the same spawn spot the live EA had — only a
                // few px of deterministic jitter so the stack immediately
                // reads as "many", before their different DNA (range,
                // aggression, speed) pulls them apart on its own.
                s.agent.x   = CX - PLAYER_ORBIT_R * 0.6 + Math.cos(c.startAngle) * 4;
                s.agent.y   = CY + Math.sin(c.startAngle) * 4;
                s.agent.vx  = 0; s.agent.vy = 0; s.agent.rot = 0;
                s.cooldown  = (c.startAngle / (Math.PI * 2)) * 0.6; // stagger first shots
            });
            liveEa.agent.x  = CX - PLAYER_ORBIT_R * 0.6;
            liveEa.agent.y  = CY;
            liveEa.agent.vx = 0; liveEa.agent.vy = 0; liveEa.agent.rot = 0;
            liveEa.cooldown = 0.4;
            playerCooldown  = 0.9;
            bullets = [];
        };
        resetCycle();

        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            // One recorded lap + two replay laps done → the story loops.
            if (t >= CYCLE_LENGTH) {
                t -= CYCLE_LENGTH;
                resetCycle();
            }

            const live     = t < CLIP_LENGTH; // phase 1: the round being played and recorded
            const eaActive = t < CLIP_LENGTH - EA_FADE;
            const tClip    = live ? t : (t - CLIP_LENGTH) % CLIP_LENGTH;
            const player   = patrol(tClip);

            // Phase 1: one normal round — the solid EA fights, the player fires back.
            if (eaActive) {
                const { cooldown, bullet } = stepArenaAgent(liveEa.agent, LIVE_DNA, player, dt, liveEa.cooldown);
                liveEa.cooldown = cooldown;
                if (bullet) bullets.push({ ...bullet, owner: 'ea' });

                playerCooldown -= dt;
                if (playerCooldown <= 0) {
                    playerCooldown = PLAYER_FIRE_EVERY;
                    const dx = liveEa.agent.x - player.x, dy = liveEa.agent.y - player.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    bullets.push({
                        x: player.x, y: player.y,
                        vx: (dx / len) * PLAYER_BULLET_SPEED,
                        vy: (dy / len) * PLAYER_BULLET_SPEED,
                        owner: 'player', life: 2,
                    });
                }
            }

            // Phase 2: every candidate replays the same recorded clip at once.
            if (!live) {
                for (const c of swarm) {
                    if (t < c.bornAt) continue;
                    const { cooldown, bullet } = stepArenaAgent(c.agent, c.dna, player, dt, c.cooldown);
                    c.cooldown = cooldown;
                    if (bullet) bullets.push({ ...bullet, owner: 'swarm' });
                }
            }

            // Impact check: bullets stop at their target instead of phasing
            // through. Candidate bullets only collide with the ghost, not
            // with other candidates — each one replays the recording in its
            // own parallel run, the translucent colleagues aren't really
            // "there" for each other.
            bullets = bullets
                .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20)
                .filter(b => !(b.owner === 'player'
                    ? eaActive && bulletHits(b, liveEa.agent.x, liveEa.agent.y, AGENT_RADIUS)
                    : bulletHits(b, player.x, player.y, 7)));

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

            // The recorded path — draws itself behind the player from the
            // very first frame, stays as the full lap's guide ring afterwards.
            ctx.beginPath();
            ctx.arc(CX, CY, PLAYER_ORBIT_R, 0, Math.min(t, CLIP_LENGTH) * PLAYER_ANG_SPEED);
            ctx.strokeStyle = live ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)';
            ctx.setLineDash([4, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            for (const b of bullets) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = b.owner === 'swarm' ? 'rgba(249, 115, 22, 0.35)'
                    :           b.owner === 'ea'    ? '#f97316'
                    :                                 'rgba(255,255,255,0.75)';
                ctx.fill();
            }

            // The live opponent — solid through the lap, fading as it completes.
            if (live) {
                const eaOpacity = eaActive ? 1 : (CLIP_LENGTH - t) / EA_FADE;
                drawArenaAgentTriangle(ctx, liveEa.agent, eaOpacity);
            }

            if (!live) {
                for (const c of swarm) {
                    if (t < c.bornAt) continue;
                    drawArenaAgentTriangle(ctx, c.agent, c.opacity * Math.min((t - c.bornAt) / SWARM_FADE, 1));
                }
            }

            // The player: solid blue while playing/being recorded, then the
            // white ghost replaying the clip — blinking out/in on each loop
            // so the restart reads as "the clip starts over".
            let playerAlpha = 1;
            if (!live) {
                playerAlpha = Math.min(1, tClip / GHOST_WRAP_FADE, (CLIP_LENGTH - tClip) / GHOST_WRAP_FADE);
            }
            ctx.beginPath();
            ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = live ? '#60a5fa' : `rgba(255,255,255,${(0.85 * playerAlpha).toFixed(3)})`;
            ctx.fill();

            // ● REC — the whole live round is being recorded.
            if (live) {
                const blink = 0.55 + 0.45 * Math.sin(t * 7);
                ctx.beginPath();
                ctx.arc(14, 16, 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(239, 68, 68, ${blink.toFixed(3)})`;
                ctx.fill();
                ctx.font         = "700 11px 'JetBrains Mono', monospace";
                ctx.textAlign    = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle    = 'rgba(239, 68, 68, 0.9)';
                ctx.fillText('REC', 24, 17);
            }
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [variant, count]);

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                {(variant === 'replay' || variant === 'nextgen') && (
                    <>
                        <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> You
                    </>
                )}
                {variant === 'replay' && (
                    <>
                        <span className={styles.legendDot} style={{ background: 'rgba(255,255,255,0.85)' }} /> Your ghost
                    </>
                )}
                <span className={styles.legendDot} style={{ background: variant === 'selection' ? 'rgba(249, 115, 22, 0.45)' : '#f97316' }} /> Candidates
                {variant === 'selection' && (
                    <>
                        <span className={styles.legendDot} style={{ background: PARENT_A_COLOR }} /> Parent A
                        <span className={styles.legendDot} style={{ background: PARENT_B_COLOR }} /> Parent B
                    </>
                )}
            </div>
        </div>
    );
}
