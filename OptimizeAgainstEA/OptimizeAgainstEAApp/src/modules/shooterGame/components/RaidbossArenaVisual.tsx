import { useEffect, useRef } from 'react';
import { DNA_INDEX, DNA_NAMES, type DNA } from '../shooter.types';
import styles from './arenaPreview.module.css';
import {
    ARENA_SIZE, AGENT_RADIUS,
    stepArenaAgent, drawArenaAgentTriangle,
    clamp01, bulletHits, patrol, lineupSpots, drawGenLabel,
    type ArenaAgentState, type ArenaBullet,
} from './arenaAgentSim';

// Same visual grammar as the Solo tutorial's preview canvases (arena box,
// orange EA triangles, dot players, real chase/aim/fire physics via
// arenaAgentSim) — the Raidboss twist is *who* evaluates: not one player and
// their ghost, but many different players, each scoring one candidate of a
// single shared, online population.
//
//   'community'  — the shared roster assembles under a Gen label, then a row
//                  of differently-colored player dots appears: many players,
//                  one population. Plays once and stays.
//   'evaluate'   — loops: one candidate gets picked, fights a (new-colored)
//                  player for real, comes back with a score mark — while
//                  other slots quietly earn marks from other players at the
//                  same time (evaluation is parallel, not a relay).
//   'generation' — loops: score marks fill the whole roster in fast, then
//                  the entire population is swapped for a fresh one and the
//                  Gen counter ticks up.

const RB = '#a855f7';

// One color per "player" — the blue one is always you, the rest are the
// other contributors filling slots at the same time.
const PLAYER_COLORS = ['#60a5fa', '#4ade80', '#facc15', '#f472b6', '#22d3ee', '#a3e635'];

const PLAYER_ANG_SPEED = 0.9;
const PLAYER_ORBIT_R   = ARENA_SIZE * 0.30;
const PLAYER_FIRE_EVERY  = 1.2;
const PLAYER_BULLET_SPEED = 260 * (ARENA_SIZE / 800);

// The candidate under evaluation — decent aim/fire so the fight reads as a
// real boss round, not a shooting-gallery dummy.
const BOSS_DNA: DNA = (() => {
    const dna: DNA = new Array(DNA_NAMES.length).fill(0.5);
    dna[DNA_INDEX.AGGRESSION]     = 0.55;
    dna[DNA_INDEX.SHOOT_ACCURACY] = 0.75;
    dna[DNA_INDEX.FIRE_RATE]      = 0.65;
    return dna;
})();

// ---- 'community' timeline ----
const CM_STAGGER     = 0.05;
const CM_FADE        = 0.3;
const CM_PLAYER_GAP  = 0.28; // player dots pop in one after another
const CM_PLAYER_FADE = 0.3;

// ---- 'evaluate' timeline (per cycle) ----
const EV_IDLE       = 0.8;  // roster stands, pick ring fades in
const EV_CLEAR      = 0.5;  // roster fades out FIRST — then the player enters
const EV_FIGHT      = 3.4;  // the real round
const EV_RETURN     = 0.5;  // fight fades out, roster brightens back
const EV_HOLD       = 1.0;  // scored roster stands before the next cycle
const EV_CYCLE      = EV_IDLE + EV_CLEAR + EV_FIGHT + EV_RETURN + EV_HOLD;
const EV_MARK_TIMES = [1.2, 2.0, 2.8]; // parallel marks (other players) mid-fight
const EV_RESET_EVERY = 4;   // accumulated marks clear after this many cycles

// ---- 'generation' timeline ----
const GN_MARK_START = 0.6;
const GN_PICK_WAIT  = 0.5;   // fully-scored roster stands before the best gets picked
const GN_PICK_FADE  = 0.35;  // glow ring fade-in
const GN_PICK_HOLD  = 1.5;   // the generation's best shines before the swap
const GN_SWAP       = 0.6;   // old roster out / fresh one in
// Marks land fast and accelerate — a whole community filling the board.
const gnMarkAt = (k: number, count: number) =>
    GN_MARK_START + (k / count) * (2.6 - 1.3 * (k / count));

// Deterministic scattered fill order (hash sort — stable across re-renders,
// no Math.random() flicker) so marks pepper the grid instead of sweeping it.
function scatterOrder(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i)
        .sort((a, b) => {
            const h = (n: number) => Math.sin(n * 12.9898) * 43758.5453 % 1;
            return h(a) - h(b);
        });
}

function drawPlayerDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number, r = 6) {
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.globalAlpha = 1;
}

// Grüner Haken direkt auf dem Agent — für den Generation-Step, wo das ganze
// Roster nacheinander "abgehakt" wird: unmissverständlich "der ist erledigt".
function drawCheckMark(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 1.5, y + 3.5);
    ctx.lineTo(x + 5, y - 4.5);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
}

// Small colored "evaluated" dot pinned under a roster slot. Offset weit genug
// unter die (nach unten zeigende) Dreiecksspitze, dass das Paar nicht wie ein
// Ausrufezeichen verschmilzt — Spitze endet bei y+10, Punkt sitzt bei y+18.
function drawScoreMark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number) {
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y + 18, 2.5, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.globalAlpha = 1;
}

interface RaidbossArenaVisualProps {
    variant: 'community' | 'evaluate' | 'generation';
    /** Size of the shared population grid — pass the real populationSize so
     * the picture matches the step text's number. */
    count: number;
    /** Gen number shown in the label (generation variant ticks up from it). */
    startGen?: number;
}

export function RaidbossArenaVisual({ variant, count, startGen = 7 }: RaidbossArenaVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Aufgeräumtes Boss-Roster: exakt nach unten gerichtet (kein
        // individueller Tilt wie in den Solo-Grids) und vertikal nach oben
        // komprimiert, damit zur Spieler-Reihe am unteren Rand (community)
        // deutlich Abstand bleibt.
        const GRID_TOP = ARENA_SIZE * 0.14, GRID_BOTTOM = ARENA_SIZE * 0.625;
        const spots = lineupSpots(count, true).map(s => ({
            ...s,
            rot: Math.PI / 2,
            y:   GRID_TOP + ((s.y - ARENA_SIZE * 0.16) / (ARENA_SIZE * 0.68)) * (GRID_BOTTOM - GRID_TOP),
        }));
        const order = scatterOrder(count);
        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        if (variant === 'community') {
            // Player dots line the bottom edge, spread evenly.
            const playersAt = PLAYER_COLORS.map((_, i) => ({
                x: ARENA_SIZE * ((i + 1) / (PLAYER_COLORS.length + 1)),
                y: ARENA_SIZE - 14,
            }));
            const assembled = (count - 1) * CM_STAGGER + CM_FADE;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
                drawGenLabel(ctx, `Gen ${startGen}`, 'rgba(216,180,254,0.85)');

                spots.forEach((s, i) => {
                    const a = s.opacity * clamp01((t - i * CM_STAGGER) / CM_FADE);
                    if (a <= 0) return;
                    drawArenaAgentTriangle(ctx, { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot }, a, RB);
                });

                playersAt.forEach((p, i) => {
                    const born = assembled + 0.4 + i * CM_PLAYER_GAP;
                    const a    = clamp01((t - born) / CM_PLAYER_FADE);
                    // Gentle pulse so the row reads as "live people", not decoration.
                    const pulse = 1 + 0.12 * Math.sin(t * 2.2 + i * 1.7);
                    drawPlayerDot(ctx, p.x, p.y, PLAYER_COLORS[i], a * 0.95, 5.5 * pulse);
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        if (variant === 'evaluate') {
            let cycle = 0;
            const marks = new Map<number, number>(); // slot index -> player color index
            const candidate: ArenaAgentState = { x: 0, y: 0, vx: 0, vy: 0, rot: 0 };
            let candidateCooldown = 0.4;
            let playerCooldown    = 0.9;
            let bullets: (ArenaBullet & { owner: 'player' | 'boss' })[] = [];

            const slotOf  = (c: number) => order[c % count];
            const colorOf = (c: number) => c % PLAYER_COLORS.length;

            const resetCycle = () => {
                const s = spots[slotOf(cycle)];
                candidate.x = s.x; candidate.y = s.y;
                candidate.vx = 0; candidate.vy = 0;
                candidate.rot = s.rot;
                candidateCooldown = 0.4;
                playerCooldown    = 0.9;
                bullets = [];
            };
            resetCycle();

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                if (t >= EV_CYCLE) {
                    t -= EV_CYCLE;
                    marks.set(slotOf(cycle), colorOf(cycle));
                    cycle += 1;
                    if (cycle % EV_RESET_EVERY === 0) marks.clear();
                    resetCycle();
                }

                const slot       = slotOf(cycle);
                const colorIdx   = colorOf(cycle);
                const fightStart = EV_IDLE + EV_CLEAR;
                const fightEnd   = fightStart + EV_FIGHT;
                const fighting   = t >= fightStart && t < fightEnd;
                const tFight     = t - fightStart;
                const player     = patrol(tFight, PLAYER_ANG_SPEED, PLAYER_ORBIT_R);
                // Fight elements (player, bullets) appear only once the roster
                // has cleared the stage, and fade out at the end of the round.
                const fightK = clamp01(tFight / 0.3) * clamp01((fightEnd + EV_RETURN - t) / EV_RETURN);
                // Waiting roster: visible → fades out during EV_CLEAR → returns after the fight.
                const rosterK = t < fightEnd
                    ? clamp01(1 - (t - EV_IDLE) / EV_CLEAR)
                    : clamp01((t - fightEnd) / EV_RETURN);

                if (fighting) {
                    const step = stepArenaAgent(candidate, BOSS_DNA, player, dt, candidateCooldown);
                    candidateCooldown = step.cooldown;
                    if (step.bullet) bullets.push({ ...step.bullet, owner: 'boss' });

                    playerCooldown -= dt;
                    if (playerCooldown <= 0) {
                        playerCooldown = PLAYER_FIRE_EVERY;
                        const dx = candidate.x - player.x, dy = candidate.y - player.y;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        bullets.push({
                            x: player.x, y: player.y,
                            vx: (dx / len) * PLAYER_BULLET_SPEED,
                            vy: (dy / len) * PLAYER_BULLET_SPEED,
                            owner: 'player', life: 2,
                        });
                    }

                    // Other players' evaluations landing in parallel, mid-fight.
                    EV_MARK_TIMES.forEach((mt, k) => {
                        if (tFight >= mt && tFight - dt < mt) {
                            const other = order[(cycle * (EV_MARK_TIMES.length + 1) + k + 1) % count];
                            if (other !== slot && !marks.has(other)) {
                                marks.set(other, (colorIdx + k + 1) % PLAYER_COLORS.length);
                            }
                        }
                    });
                }

                bullets = bullets
                    .map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt }))
                    .filter(b => b.life > 0 && b.x > -20 && b.x < ARENA_SIZE + 20 && b.y > -20 && b.y < ARENA_SIZE + 20)
                    .filter(b => !(b.owner === 'player'
                        ? bulletHits(b, candidate.x, candidate.y, AGENT_RADIUS)
                        : bulletHits(b, player.x, player.y, 7)));

                // ---- Draw ----
                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
                drawGenLabel(ctx, `Gen ${startGen}`, 'rgba(216,180,254,0.85)');

                // The waiting roster disappears completely while the round
                // runs — the stage belongs to the two fighting it out. The
                // score marks fade with their agents: the ones earned mid-fight
                // pop in together with the returning roster ("while you fought,
                // other players scored these").
                spots.forEach((s, i) => {
                    if (i === slot) return;
                    const a = s.opacity * rosterK;
                    if (a > 0.01) drawArenaAgentTriangle(ctx, { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot }, a, RB);
                    const m = marks.get(i);
                    if (m !== undefined) drawScoreMark(ctx, s.x, s.y, PLAYER_COLORS[m], 0.9 * rosterK);
                });

                for (const b of bullets) {
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
                    ctx.globalAlpha = fightK;
                    ctx.fillStyle = b.owner === 'boss' ? RB : 'rgba(255,255,255,0.75)';
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                // The candidate under evaluation: highlighted in the grid, then
                // it walks out and fights for real, then it's back — scored.
                if (t < fightEnd + EV_RETURN) {
                    const ringK = clamp01(t / 0.4);
                    drawArenaAgentTriangle(ctx, candidate, 0.55 + 0.45 * ringK, RB);
                    ctx.beginPath();
                    ctx.arc(candidate.x, candidate.y, 13 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
                    ctx.globalAlpha = ringK * (t < fightEnd ? 0.9 : 0.9 * (1 - clamp01((t - fightEnd) / EV_RETURN)));
                    ctx.strokeStyle = PLAYER_COLORS[colorIdx];
                    ctx.lineWidth   = 2;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                } else {
                    // Back in its slot, wearing its fresh score mark — kein
                    // zusätzliches Fitness-Popup, das wurde zu voll.
                    const s = spots[slot];
                    drawArenaAgentTriangle(ctx, { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot }, s.opacity, RB);
                    drawScoreMark(ctx, s.x, s.y, PLAYER_COLORS[colorIdx], 0.9);
                }

                if (t < fightEnd + EV_RETURN) {
                    drawPlayerDot(ctx, player.x, player.y, PLAYER_COLORS[colorIdx], fightK);
                }
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ---- 'generation': marks flood in, the best gets picked, then the
        // whole roster is replaced ----
        let gen = startGen;
        const fullAt   = gnMarkAt(count - 1, count);
        const pickAt   = fullAt + GN_PICK_WAIT;
        const swapAt   = pickAt + GN_PICK_HOLD;
        const cycleLen = swapAt + GN_SWAP;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;
            if (t >= cycleLen) {
                t -= cycleLen;
                gen += 1;
            }

            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
            const swapK = clamp01((t - swapAt) / GN_SWAP); // 0 → old roster, 1 → fresh one
            // Once everyone is scored, a glowing ring singles out the
            // generation's best — the payoff of all those evaluations.
            const pick  = order[gen % count];
            const pickK = clamp01((t - pickAt) / GN_PICK_FADE) * (1 - swapK);
            drawGenLabel(ctx, `Gen ${swapK > 0.5 ? gen + 1 : gen}`, 'rgba(216,180,254,0.85)');

            spots.forEach((s, i) => {
                // Old scored roster fades out; the unscored successor fades in.
                // While the best is picked, it lifts to full opacity and the
                // rest step back slightly.
                const lift = i === pick ? s.opacity + (1 - s.opacity) * pickK : s.opacity * (1 - 0.35 * pickK);
                const oldA = lift * (1 - swapK);
                if (oldA > 0) {
                    drawArenaAgentTriangle(ctx, { x: s.x, y: s.y, vx: 0, vy: 0, rot: s.rot }, oldA, RB);
                    const k = order.indexOf(i);
                    const markAlpha = clamp01((t - gnMarkAt(k, count)) / 0.2) * (1 - swapK);
                    // Haken = "erledigt", farbiger Punkt darunter = welcher
                    // Spieler die Bewertung beigesteuert hat.
                    drawCheckMark(ctx, s.x, s.y, markAlpha);
                    drawScoreMark(ctx, s.x, s.y, PLAYER_COLORS[(i + gen) % PLAYER_COLORS.length], markAlpha);
                }
                if (swapK > 0) {
                    drawArenaAgentTriangle(
                        ctx,
                        { x: s.x, y: s.y, vx: 0, vy: 0, rot: Math.PI / 2 },
                        s.opacity * swapK,
                        RB,
                    );
                }
            });

            // Der leuchtende Auswahlring um den besten Boss-Kandidaten.
            if (pickK > 0) {
                const s = spots[pick];
                ctx.save();
                ctx.shadowColor = RB;
                ctx.shadowBlur  = 14;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 13 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
                ctx.globalAlpha = pickK * 0.95;
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth   = 2.5;
                ctx.stroke();
                ctx.restore();
            }
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [variant, count, startGen]);

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: RB }} /> Boss candidates
                {/* Score-Marker tragen die Farbe des Spielers, der bewertet
                  * hat — deshalb kein eigener einfarbiger "Scored"-Eintrag. */}
                {variant === 'evaluate' ? (
                    <>
                        <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> A player
                    </>
                ) : variant === 'generation' ? (
                    <>
                        <span className={styles.legendDot} style={{ background: '#4ade80' }} /> Evaluated
                        <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> By player
                    </>
                ) : (
                    <>
                        <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> Players
                    </>
                )}
            </div>
        </div>
    );
}
