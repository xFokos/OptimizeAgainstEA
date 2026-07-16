import { useEffect, useRef } from 'react';
import styles from './arenaPreview.module.css';
import { ARENA_SIZE, clamp01, drawGenLabel } from './arenaAgentSim';

// Horde explainer canvases — same arena-box grammar as the other preview
// canvases (blue player dot, orange agents), but with Horde blobs instead of
// shooter triangles, because that's what the player just fought.
//
//   'fitness'   — acts out how a Horde life gets graded: blobs run at the
//                 player, die at different distances, and each death draws
//                 its measured distance plus the fitness it earned (closer =
//                 much better, dying stuck against a wall counts half).
//                 Mirrors hordeEngine's (1 - dist/diag)² · wallPenalty.
//   'evolution' — der Zucht-Zyklus, ruhig inszeniert: ein Blob läuft an,
//                 wird abgeschossen, zwei Überlebende leuchten als Eltern
//                 (blau/orange, die Crossover-Farben) und der Nachwuchs mit
//                 sichtbar geerbten Körper-Werten kommt vom Rand nach. Der
//                 Elite stirbt hier bewusst nie — die Eltern-Story bleibt rein.
//   'elites'    — die zwei Sonderfälle, im Wechsel: der Gold-Elite fällt und
//                 kommt unverändert zurück (keine Eltern), dann fällt ein
//                 normaler Blob und ein Zufalls-Neuling (weißer Ring) rückt
//                 nach. Bewusst OHNE Eltern-Ringe, damit sich der Step klar
//                 vom 'evolution'-Step unterscheidet.

const HC = '#fb923c';
const CX = ARENA_SIZE / 2, CY = ARENA_SIZE / 2;
const ARENA_DIAG = Math.SQRT2 * ARENA_SIZE;

const PARENT_A_COLOR = '#60a5fa';
const PARENT_B_COLOR = '#f97316';
const ELITE_COLOR    = '#facc15';

// ---- 'fitness' script: four lives, each dying at a different depth ----
const FIT_SPEED  = 60;   // px/s approach
const FIT_LIVES = [
    { angle: -2.4, dieDist: 150, stuck: false }, // barely got close — low score
    { angle:  0.5, dieDist: 95,  stuck: false },
    { angle:  1.8, dieDist: 45,  stuck: false }, // almost reached you — high score
    { angle:  3.6, dieDist: 0,   stuck: true  }, // died wedged against a wall — ×0.5
] as const;
const FIT_BULLET_SPEED = 210;
const FIT_DEAD_HOLD    = 1.6;  // death line + score float linger
const FIT_STUCK_TIME   = 1.5;  // wall-hugger wiggles this long before being culled

const fitnessOf = (dist: number, stuck: boolean) =>
    (1 - dist / ARENA_DIAG) ** 2 * (stuck ? 0.5 : 1);

// ---- 'evolution' staging ----
// Gleiche ruhige Inszenierung wie der Fitness-Step (Spieler steht in der
// Mitte und schießt) statt eines chaotischen Live-Schwarms: pro Zyklus läuft
// genau EIN Blob an, stirbt, und der Ersatz wird sichtbar gezüchtet, während
// der Rest der Population still auf seinen Plätzen wartet.
const EV_COUNT           = 6;
const EV_APPROACH_SPEED  = 70;   // px/s des anlaufenden Blobs
const EV_KILL_DIST       = 58;   // bei dieser Distanz feuert der Spieler
const EV_BULLET_SPEED    = 210;
const EV_IDLE            = 0.7;  // Pause zwischen den Zyklen
const EV_PARENT_TIME     = 1.2;  // so lange stehen die Eltern-Ringe
const EV_QUICK_TIME      = 0.45; // Elite-/Immigranten-Ersatz (keine Eltern nötig)
const EV_SPAWN_TIME      = 0.9;  // Nachwuchs gleitet vom Rand auf den freien Platz
const ELITE_IDX          = 2;    // welcher Standplatz dem Gold-Elite gehört

interface EvBlob {
    x: number; y: number;  // fester Standplatz
    r: number;             // body size — inherited
    opacity: number;       // body opacity — inherited
    isElite: boolean;
}

const hash01 = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;

// Rand-Punkt, der dem Standplatz am nächsten liegt — dort betritt der
// Nachwuchs die Arena ("spawnt am Rand"), bevor er auf den Platz gleitet.
function edgeEntry(s: { x: number; y: number }): { x: number; y: number } {
    const dl = s.x, dr = ARENA_SIZE - s.x, dt = s.y, db = ARENA_SIZE - s.y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) return { x: 6, y: s.y };
    if (m === dr) return { x: ARENA_SIZE - 6, y: s.y };
    if (m === dt) return { x: s.x, y: 6 };
    return { x: s.x, y: ARENA_SIZE - 6 };
}

interface HordeArenaVisualProps {
    variant: 'fitness' | 'evolution' | 'elites';
}

export function HordeArenaVisual({ variant }: HordeArenaVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const drawBlob = (x: number, y: number, r: number, opacity: number) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.globalAlpha = clamp01(opacity);
            ctx.fillStyle   = HC;
            ctx.fill();
            ctx.globalAlpha = 1;
        };

        if (variant === 'fitness') {
            let life  = 0;
            let phase: 'run' | 'shot' | 'stuck' | 'dead' = 'run';
            let phaseT = 0;
            const blob = { x: 0, y: 0 };
            let bullet: { x: number; y: number; vx: number; vy: number } | null = null;
            let deathDist = 0;

            const resetLife = (i: number) => {
                const l = FIT_LIVES[i];
                blob.x = CX + Math.cos(l.angle) * (ARENA_SIZE * 0.62);
                blob.y = CY + Math.sin(l.angle) * (ARENA_SIZE * 0.62);
                blob.x = Math.max(8, Math.min(ARENA_SIZE - 8, blob.x));
                blob.y = Math.max(8, Math.min(ARENA_SIZE - 8, blob.y));
                phase  = 'run';
                phaseT = 0;
                bullet = null;
            };
            resetLife(0);

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;
                phaseT += dt;

                const l = FIT_LIVES[life];
                const dx = CX - blob.x, dy = CY - blob.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (phase === 'run') {
                    if (l.stuck) {
                        // The wall-hugger: runs along the edge instead of at you.
                        blob.x = Math.max(8, blob.x - FIT_SPEED * 0.7 * dt);
                        blob.y = Math.min(ARENA_SIZE - 8, blob.y + Math.sin(t * 6) * 8 * dt);
                        if (blob.x <= 8.5) { phase = 'stuck'; phaseT = 0; }
                    } else if (dist > l.dieDist) {
                        blob.x += (dx / dist) * FIT_SPEED * dt;
                        blob.y += (dy / dist) * FIT_SPEED * dt;
                    } else {
                        // Reached its scripted depth — the player takes the shot.
                        const len = dist;
                        bullet = { x: CX, y: CY, vx: (blob.x - CX) / len * FIT_BULLET_SPEED, vy: (blob.y - CY) / len * FIT_BULLET_SPEED };
                        phase = 'shot';
                        phaseT = 0;
                    }
                } else if (phase === 'shot' && bullet) {
                    bullet.x += bullet.vx * dt;
                    bullet.y += bullet.vy * dt;
                    if ((bullet.x - blob.x) ** 2 + (bullet.y - blob.y) ** 2 < 10 ** 2) {
                        bullet    = null;
                        deathDist = dist;
                        phase     = 'dead';
                        phaseT    = 0;
                    }
                } else if (phase === 'stuck') {
                    // Wiggling in place against the wall until the engine culls it.
                    if (phaseT >= FIT_STUCK_TIME) {
                        deathDist = dist;
                        phase     = 'dead';
                        phaseT    = 0;
                    }
                } else if (phase === 'dead' && phaseT >= FIT_DEAD_HOLD) {
                    life = (life + 1) % FIT_LIVES.length;
                    resetLife(life);
                }

                // ---- Draw ----
                ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

                if (phase === 'dead') {
                    // Measured distance + the fitness this life earned.
                    ctx.beginPath();
                    ctx.moveTo(CX, CY);
                    ctx.lineTo(blob.x, blob.y);
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const fadeK = clamp01((FIT_DEAD_HOLD - phaseT) / 0.4);
                    const fit   = fitnessOf(deathDist, l.stuck);
                    ctx.font         = "700 11px 'JetBrains Mono', monospace";
                    ctx.textAlign    = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.globalAlpha  = fadeK;
                    ctx.fillStyle    = l.stuck ? 'rgba(248,113,113,0.95)' : 'rgba(251,146,60,0.95)';
                    const label = l.stuck ? `stuck ×0.5 → ${fit.toFixed(2)}` : `fitness ${fit.toFixed(2)}`;
                    const midX = (CX + blob.x) / 2, midY = (CY + blob.y) / 2 - 12;
                    ctx.fillText(label, Math.max(44, Math.min(ARENA_SIZE - 44, midX)), Math.max(14, midY));
                    ctx.globalAlpha = 1;

                    // Death burst at the spot the life ended.
                    const k = clamp01(phaseT / 0.4);
                    ctx.beginPath();
                    ctx.arc(blob.x, blob.y, 6 + k * 12, 0, Math.PI * 2);
                    ctx.globalAlpha = 1 - k;
                    ctx.strokeStyle = HC;
                    ctx.lineWidth   = 2;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                } else {
                    const wiggle = phase === 'stuck' ? Math.sin(phaseT * 18) * 1.5 : 0;
                    drawBlob(blob.x + wiggle, blob.y, 8, 0.95);
                }

                if (bullet) {
                    ctx.beginPath();
                    ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(CX, CY, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#60a5fa';
                ctx.fill();
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ---- 'evolution': skriptgesteuerter Todes-/Nachwuchs-Zyklus ----
        // Feste Standplätze auf einem lockeren Ring um den Spieler; pro
        // Zyklus stirbt genau der `cur`-Blob und wird ersetzt.
        const standSpot = (i: number) => {
            const ang = (i / EV_COUNT) * Math.PI * 2 - Math.PI / 2 + (hash01(i * 7 + 2) - 0.5) * 0.6;
            const rad = ARENA_SIZE * 0.33 + hash01(i * 3 + 5) * ARENA_SIZE * 0.07;
            return { x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad };
        };
        const blobs: EvBlob[] = Array.from({ length: EV_COUNT }, (_, i) => ({
            ...standSpot(i),
            r:       5 + hash01(i * 11 + 3) * 6,
            opacity: 0.5 + hash01(i * 13 + 4) * 0.5,
            // Der Gold-Elite existiert nur in der 'elites'-Variante — im
            // 'evolution'-Step soll die reine Eltern-Story nichts ablenken.
            isElite: variant === 'elites' && i === ELITE_IDX,
        }));
        const nonElite = blobs.map((_, i) => i).filter(i => i !== ELITE_IDX);

        let phase: 'idle' | 'approach' | 'shot' | 'breed' | 'spawn' = 'idle';
        let phaseT = 0;
        let cycleNum = 0;
        // Wer diesen Zyklus stirbt: 'evolution' rotiert durch die normalen
        // Blobs (der Elite nie — reine Eltern-Story); 'elites' wechselt
        // zwischen dem Elite (→ kommt unverändert zurück) und einem normalen
        // Blob (→ Zufalls-Neuling rückt nach).
        let cur = variant === 'elites' ? ELITE_IDX : nonElite[0];
        const runner = { x: 0, y: 0 };     // Laufposition des Anläufers
        let bullet: { x: number; y: number; vx: number; vy: number } | null = null;
        let burst:  { x: number; y: number; t: number } | null = null;
        let parents: [number, number] | null = null;
        let newbornType: 'child' | 'elite' | 'immigrant' = 'child';
        let newbornStats = { r: 8, opacity: 0.8 };
        let entry = { x: 0, y: 0 };        // Rand-Punkt, von dem der Nachwuchs kommt
        let gen   = EV_COUNT;              // the real Horde's counter also starts at the wave size
        let seed  = 50;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;
            phaseT += dt;

            if (burst) {
                burst.t += dt;
                if (burst.t >= 0.4) burst = null;
            }

            if (phase === 'idle' && phaseT >= EV_IDLE) {
                runner.x = blobs[cur].x;
                runner.y = blobs[cur].y;
                phase = 'approach';
                phaseT = 0;
            } else if (phase === 'approach') {
                const dx = CX - runner.x, dy = CY - runner.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist > EV_KILL_DIST) {
                    runner.x += (dx / dist) * EV_APPROACH_SPEED * dt;
                    runner.y += (dy / dist) * EV_APPROACH_SPEED * dt;
                } else {
                    // Der Spieler verteidigt sich — ein gezielter Schuss.
                    bullet = {
                        x: CX, y: CY,
                        vx: (runner.x - CX) / dist * EV_BULLET_SPEED,
                        vy: (runner.y - CY) / dist * EV_BULLET_SPEED,
                    };
                    phase = 'shot';
                    phaseT = 0;
                }
            } else if (phase === 'shot' && bullet) {
                bullet.x += bullet.vx * dt;
                bullet.y += bullet.vy * dt;
                if ((bullet.x - runner.x) ** 2 + (bullet.y - runner.y) ** 2 < 9 ** 2) {
                    bullet = null;
                    burst  = { x: runner.x, y: runner.y, t: 0 };
                    gen += 1;
                    seed += 17;

                    const dead = blobs[cur];
                    if (variant === 'elites' && dead.isElite) {
                        // Elite: proven genome reincarnates unchanged.
                        newbornType  = 'elite';
                        newbornStats = { r: dead.r, opacity: dead.opacity };
                        parents      = null;
                    } else if (variant === 'elites') {
                        // Diversity injection: a completely fresh random genome.
                        newbornType  = 'immigrant';
                        newbornStats = { r: 4 + hash01(seed) * 7, opacity: 0.4 + hash01(seed + 1) * 0.6 };
                        parents      = null;
                    } else {
                        // Tournament winners breed the replacement — the newborn
                        // visibly inherits a mix of its parents' body stats.
                        newbornType = 'child';
                        const others = blobs.map((_, i) => i).filter(i => i !== cur);
                        const pa = others[Math.floor(hash01(seed) * others.length)];
                        let pb   = others[Math.floor(hash01(seed + 1) * others.length)];
                        if (pb === pa) pb = others[(others.indexOf(pa) + 1) % others.length];
                        parents = [pa, pb];
                        const A = blobs[pa], B = blobs[pb];
                        newbornStats = {
                            r:       Math.max(4, Math.min(12, (hash01(seed + 2) < 0.5 ? A.r : B.r) + (hash01(seed + 3) - 0.5) * 1.5)),
                            opacity: clamp01((hash01(seed + 4) < 0.5 ? A.opacity : B.opacity) + (hash01(seed + 5) - 0.5) * 0.2),
                        };
                    }
                    entry = edgeEntry(blobs[cur]);
                    phase = 'breed';
                    phaseT = 0;
                }
            } else if (phase === 'breed' && phaseT >= (parents ? EV_PARENT_TIME : EV_QUICK_TIME)) {
                phase = 'spawn';
                phaseT = 0;
            } else if (phase === 'spawn' && phaseT >= EV_SPAWN_TIME) {
                blobs[cur] = { ...blobs[cur], ...newbornStats, isElite: newbornType === 'elite' };
                parents = null;
                cycleNum += 1;
                cur = variant === 'elites'
                    ? (cycleNum % 2 === 0 ? ELITE_IDX : nonElite[(cycleNum >> 1) % nonElite.length])
                    : nonElite[cycleNum % nonElite.length];
                phase = 'idle';
                phaseT = 0;
            }

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
            drawGenLabel(ctx, `Gen ${gen}`);

            if (bullet) {
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fill();
            }

            if (burst) {
                const k = burst.t / 0.4;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, 6 + k * 12, 0, Math.PI * 2);
                ctx.globalAlpha = 1 - k;
                ctx.strokeStyle = HC;
                ctx.lineWidth   = 2;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            blobs.forEach((b, i) => {
                if (i === cur) {
                    if (phase === 'approach' || phase === 'shot') {
                        drawBlob(runner.x, runner.y, b.r, b.opacity);
                        if (b.isElite) {
                            ctx.beginPath();
                            ctx.arc(runner.x, runner.y, b.r + 3.5, 0, Math.PI * 2);
                            ctx.strokeStyle = ELITE_COLOR;
                            ctx.lineWidth   = 1.5;
                            ctx.stroke();
                        }
                    } else if (phase === 'spawn') {
                        // Der Nachwuchs betritt die Arena am Rand und gleitet
                        // auf den frei gewordenen Standplatz.
                        const k = clamp01(phaseT / EV_SPAWN_TIME);
                        const x = entry.x + (b.x - entry.x) * k;
                        const y = entry.y + (b.y - entry.y) * k;
                        drawBlob(x, y, newbornStats.r, newbornStats.opacity * k);
                        if (newbornType === 'immigrant') {
                            ctx.beginPath();
                            ctx.arc(x, y, newbornStats.r + 4 + (1 - k) * 6, 0, Math.PI * 2);
                            ctx.globalAlpha = 1 - k * 0.6;
                            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                            ctx.lineWidth   = 1.5;
                            ctx.stroke();
                            ctx.globalAlpha = 1;
                        }
                        if (newbornType === 'elite') {
                            ctx.beginPath();
                            ctx.arc(x, y, newbornStats.r + 3.5, 0, Math.PI * 2);
                            ctx.globalAlpha = k;
                            ctx.strokeStyle = ELITE_COLOR;
                            ctx.lineWidth   = 1.5;
                            ctx.stroke();
                            ctx.globalAlpha = 1;
                        }
                    }
                    // 'breed': der Tote ist weg — die Bühne gehört den Eltern.
                    return;
                }

                // Die wartende Population: steht auf ihrem Platz, atmet leicht.
                const wx = b.x + Math.sin(t * 1.6 + i * 2.1) * 1.5;
                const wy = b.y + Math.cos(t * 1.3 + i * 1.7) * 1.2;
                drawBlob(wx, wy, b.r, b.opacity);
                if (b.isElite) {
                    ctx.beginPath();
                    ctx.arc(wx, wy, b.r + 3.5 + Math.sin(t * 3) * 0.8, 0, Math.PI * 2);
                    ctx.globalAlpha = 0.85;
                    ctx.strokeStyle = ELITE_COLOR;
                    ctx.lineWidth   = 1.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
                if (parents) {
                    const which = parents.indexOf(i);
                    if (which !== -1) {
                        ctx.beginPath();
                        ctx.arc(wx, wy, b.r + 4 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2);
                        ctx.globalAlpha = 0.9;
                        ctx.strokeStyle = which === 0 ? PARENT_A_COLOR : PARENT_B_COLOR;
                        ctx.lineWidth   = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            });

            ctx.beginPath();
            ctx.arc(CX, CY, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [variant]);


    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> You
                <span className={styles.legendDot} style={{ background: HC }} /> Horde
                {variant === 'evolution' && (
                    <>
                        <span className={styles.legendDot} style={{ background: PARENT_A_COLOR }} /> Parents
                    </>
                )}
                {variant === 'elites' && (
                    <>
                        <span className={styles.legendDot} style={{ background: ELITE_COLOR }} /> Elite
                        <span className={styles.legendDot} style={{ background: 'rgba(255,255,255,0.85)' }} /> Newcomer
                    </>
                )}
            </div>
        </div>
    );
}
