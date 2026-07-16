import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Individual, PlayerGhost } from '../shooter.types';
import { ARENA, GAME_CONFIG } from '../shooter.types';
import { createGhostSim, type GhostSim } from '../game/ga/evolution';
import { trainingReplayStore } from '../game/trainingReplayStore';

// ─────────────────────────────────────────────────────────────────────────
//  Trainings-Replay im DNA-Reveal: zeigt, was im "Evolving"-Schritt wirklich
//  passiert. Alle Kandidaten der zuletzt evaluierten Presim-Generation
//  spielen gleichzeitig (jeder in seiner eigenen Simulation) gegen das
//  Recording der letzten Spieler-Runde — exakt die Bewertung, mit der die
//  Presim ihre Fitness bestimmt.
//
//  Die Simulation nutzt denselben createGhostSim wie die Fitness-Bewertung
//  (game/ga/evolution.ts), inkl. DNA-geseedetem RNG — was hier läuft, ist
//  exakt der Lauf, der die Fitness bestimmt hat. Einzige Abweichungsquelle:
//  mit Hall-of-Fame-Ghost ist die Fitness der Mittelwert aus zwei Sims, und
//  nur die gegen die letzte Spieler-Runde ist hier zu sehen.
//
//  Das Fitness-Ranking lebt NICHT hier, sondern in der linken Seitenleiste
//  (ShooterLeftBar → TrainingReplayRanking), damit es die Arena nicht
//  verdeckt. Kommunikation läuft über trainingReplayStore: dieses Overlay
//  öffnet ihn beim Mount, schließt ihn beim Unmount und liest den
//  fokussierten Kandidaten daraus; das DNA-Panel rechts zeigt dessen DNA.
// ─────────────────────────────────────────────────────────────────────────

const PLAYER_COL = '#60a5fa';
const AGENT_COL  = '#f97316';
const MONO       = '"JetBrains Mono", monospace';

// Rang-Farben (Ranking-Liste UND Agenten-Avatare in der Arena):
// Rang 1/2 = Crossover-Eltern wie im DNA-Reveal, übrige Elites lila,
// der Rest ("schlecht", wird durch Nachkommen ersetzt) grau.
const PARENT_A_COL = '#60a5fa';   // = COL_A im DNA-Reveal
const PARENT_B_COL = '#f97316';   // = COL_B im DNA-Reveal
const ELITE_COL    = '#a855f7';
const WEAK_COL     = '#6b7280';

/** Farbe je Kandidaten-Index, abgeleitet aus dem Fitness-Ranking. */
function rankColors(evaluated: Individual[]): string[] {
    const order = evaluated
        .map((_, i) => i)
        .sort((a, b) => evaluated[b].fitness - evaluated[a].fitness);
    const cols = new Array<string>(evaluated.length).fill(WEAK_COL);
    order.forEach((idx, rank) => {
        cols[idx] = rank === 0 ? PARENT_A_COL
                  : rank === 1 ? PARENT_B_COL
                  : rank < GAME_CONFIG.ELITE_COUNT ? ELITE_COL
                  : WEAK_COL;
    });
    return cols;
}

// Wiedergabegeschwindigkeit: Ghost-Frames (1/60 s) pro Render-Frame.
const SPEEDS = [1, 2, 4, 8] as const;

interface EvolutionReplayOverlayProps {
    ghost:     PlayerGhost;
    /** Zuletzt evaluierte Presim-Generation — Fitness-Werte sind die echten. */
    evaluated: Individual[];
    onClose:   () => void;
}

export function EvolutionReplayOverlay({ ghost, evaluated, onClose }: EvolutionReplayOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Bester Kandidat (nach echter Fitness) — Standard-Fokus und späterer Gegner.
    const bestIdx = useMemo(
        () => evaluated.reduce((bi, ind, i, a) => (ind.fitness > a[bi].fitness ? i : bi), 0),
        [evaluated],
    );

    // Ranking + Fokus in den Store — die Seitenleisten zeigen sie an, solange
    // das Replay offen ist. Fokus-Klicks kommen aus dem Ranking zurück.
    useEffect(() => {
        trainingReplayStore.open(evaluated, bestIdx);
        trainingReplayStore.requestClose = onClose;
        return () => trainingReplayStore.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evaluated, bestIdx]);

    const replayUI = useSyncExternalStore(
        trainingReplayStore.subscribe.bind(trainingReplayStore),
        () => trainingReplayStore.state,
    );
    const focusIdx = replayUI?.focusIdx ?? bestIdx;

    const [playing,   setPlaying]   = useState(true);
    const [speed,     setSpeed]     = useState<number>(2);
    const [finished,  setFinished]  = useState(false);
    // Nicht-fokussierte Kandidaten ausblenden — default AUS, denn die ganze
    // Population zu sehen ist der Kern des Replays.
    const [hideOthers, setHideOthers] = useState(false);
    // Nur für die HUD-Anzeige (Frame-Zähler / Fokus-Treffer) — ein grober
    // State-Tick pro ~250 ms reicht, das Canvas zeichnet unabhängig davon.
    const [, forceHud] = useState(0);

    // Der rAF-Loop liest nur Refs (er wird einmal erstellt) — UI-State spiegeln.
    const simsRef     = useRef<GhostSim[]>([]);
    const playingRef  = useRef(playing);
    const speedRef    = useRef(speed);
    const focusRef      = useRef(focusIdx);
    const hideOthersRef = useRef(hideOthers);
    const colors        = useMemo(() => rankColors(evaluated), [evaluated]);
    const colorsRef     = useRef(colors);
    useEffect(() => { colorsRef.current     = colors;     }, [colors]);
    useEffect(() => { hideOthersRef.current = hideOthers; }, [hideOthers]);
    useEffect(() => { playingRef.current    = playing;    }, [playing]);
    useEffect(() => { speedRef.current   = speed;    }, [speed]);
    useEffect(() => { focusRef.current   = focusIdx; }, [focusIdx]);

    // Echte Aufnahmerate des Recordings: gameLoop zeichnet nur jeden 3. Tick
    // auf (~20fps bei 60Hz, refreshratenabhängig). Die time-Stempel der Frames
    // (roundTimer) liefern die tatsächliche Dauer — daraus die Frames/Sekunde,
    // damit ×1 exakt der echten Rundengeschwindigkeit entspricht.
    const ghostFps = useMemo(() => {
        const fs = ghost.frames;
        if (fs.length < 2) return 20;
        const duration = Math.abs(fs[0].time - fs[fs.length - 1].time);
        return duration > 0 ? fs.length / duration : 20;
    }, [ghost]);
    const ghostFpsRef = useRef(ghostFps);
    useEffect(() => { ghostFpsRef.current = ghostFps; }, [ghostFps]);

    const makeSims = () => evaluated.map(ind => createGhostSim(ind.dna, ghost));
    if (simsRef.current.length === 0) simsRef.current = makeSims();

    const restart = () => {
        simsRef.current = makeSims();
        setFinished(false);
        setPlaying(true);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId    = 0;
        let hudTimer  = 0;
        let lastTs    = 0;
        let acc       = 0;   // angesammelte Ghost-Frames (Bruchteile möglich)

        const loop = (ts: number) => {
            const sims = simsRef.current;

            // Zeitbasiert steppen statt pro rAF-Frame: ghostFps Frames pro
            // Sekunde bei ×1 = echte Rundengeschwindigkeit, unabhängig von
            // der Monitor-Refreshrate.
            const dtSec = lastTs === 0 ? 0 : Math.min((ts - lastTs) / 1000, 0.1);
            lastTs = ts;

            if (playingRef.current && sims.length > 0 && !sims[0].done) {
                acc += dtSec * ghostFpsRef.current * speedRef.current;
                const n = Math.floor(acc);
                acc -= n;
                for (let k = 0; k < n; k++) {
                    for (const sim of sims) sim.step();
                }
                if (sims[0].done) {
                    setPlaying(false);
                    setFinished(true);
                }
            }

            draw(ctx, sims, ghost, focusRef.current, colorsRef.current, hideOthersRef.current);

            if (ts - hudTimer > 250) {
                hudTimer = ts;
                forceHud(n => n + 1);
            }
            animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const frame       = simsRef.current[0]?.frame ?? 0;
    const totalFrames = ghost.frames.length;
    const focusStats  = simsRef.current[focusIdx]?.stats;

    return (
        <div style={{
            position:   'absolute',
            inset:      0,
            background: '#0c0c16',
            fontFamily: MONO,
            color:      '#fff',
        }}>
            {/* Kopfzeile im TugBar-Streifen (44px) */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 44,
                display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px',
                background: 'rgba(0,0,0,0.55)', boxSizing: 'border-box',
            }}>
                {/* Bewusst schlank: nur Titel, Fortschritt + Fokus-Treffer, ×.
                    Die Erklärung, was hier passiert, steht im Ranking-Footer
                    der linken Seitenleiste. */}
                <span
                    style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', color: AGENT_COL, whiteSpace: 'nowrap' }}
                    title={`${evaluated.length} candidates play a recording of your last round — the best DNA becomes your next opponent`}
                >
                    TRAINING REPLAY
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {focusStats && (
                        <>
                            <span style={{ color: colors[focusIdx] ?? AGENT_COL }}>Agent #{focusIdx + 1}</span>
                            {' '}· hits <span style={{ color: AGENT_COL }}>{focusStats.hitsLanded}</span>
                            {' '}· got hit <span style={{ color: PLAYER_COL }}>{focusStats.hitsReceived}</span>
                            {' '}·{' '}
                        </>
                    )}
                    {Math.floor(Math.min(frame, totalFrames) / ghostFps)}s / {Math.floor(totalFrames / ghostFps)}s
                </span>
                <button
                    onClick={onClose}
                    aria-label="Close replay"
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}
                >×</button>
            </div>

            <canvas
                ref={canvasRef}
                width={ARENA.WIDTH}
                height={ARENA.HEIGHT}
                style={{ position: 'absolute', top: 44, left: 0, display: 'block' }}
            />

            {/* Steuerung. Bewusst groß (btn--lg): das Overlay lebt im 800px-Canvas,
                der auf Handys auf ~halbe Größe skaliert wird — kleinere Buttons
                wären dort kaum noch zu treffen. */}
            <div style={{
                position: 'absolute', left: 14, bottom: 14, display: 'flex', gap: 10, alignItems: 'center',
            }}>
                <button className="btn btn--primary btn--lg" onClick={() => (finished ? restart() : setPlaying(p => !p))}>
                    {finished ? '↻ Replay' : playing ? '❚❚ Pause' : '▶ Play'}
                </button>
                {SPEEDS.map(s => (
                    <button
                        key={s}
                        className={`btn btn--lg${speed === s ? ' btn--active' : ''}`}
                        onClick={() => setSpeed(s)}
                    >
                        ×{s}
                    </button>
                ))}
                <button
                    className={`btn btn--lg${hideOthers ? ' btn--active' : ''}`}
                    onClick={() => setHideOthers(h => !h)}
                    title="Hide all candidates except the focused one"
                >
                    {hideOthers ? '👁 Show other EAs' : '👁 Hide other EAs'}
                </button>
            </div>
        </div>
    );
}

// ---- Fitness-Ranking (linke Seitenleiste, statt Round Stats) ----

/**
 * Wird von ShooterLeftBar gerendert, solange trainingReplayStore offen ist.
 * Klick auf einen Eintrag fokussiert den Kandidaten in Arena + DNA-Panel.
 */
export function TrainingReplayRanking() {
    const ui = useSyncExternalStore(
        trainingReplayStore.subscribe.bind(trainingReplayStore),
        () => trainingReplayStore.state,
    );
    if (!ui) return null;

    const { evaluated, ranking, focusIdx } = ui;

    // Fitness-Balken: min–max-normalisiert (Fitness kann negativ sein).
    const fitMin = evaluated[ranking[ranking.length - 1]].fitness;
    const fitMax = evaluated[ranking[0]].fitness;
    const fitBar = (f: number) => (fitMax === fitMin ? 1 : (f - fitMin) / (fitMax - fitMin));

    return (
        <div style={{
            width: '100%', padding: '0 12px', boxSizing: 'border-box',
            fontFamily: MONO, overflowY: 'auto', minHeight: 0,
        }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                FITNESS RANKING
            </div>
            {ranking.map((idx, rank) => {
                const ind     = evaluated[idx];
                const isElite = rank < GAME_CONFIG.ELITE_COUNT;
                const focused = idx === focusIdx;
                // Rang 1 & 2 sind die beiden Eltern des Crossover-Beispiels
                // im DNA-Reveal (population.individuals[0] und [1]) — gleiche
                // Farben wie dort (Blau = Elter A, Orange = Elter B).
                const parent  = rank === 0 ? { label: 'PARENT A', col: PARENT_A_COL }
                              : rank === 1 ? { label: 'PARENT B', col: PARENT_B_COL }
                              : null;
                return (
                    <button
                        key={idx}
                        onClick={() => trainingReplayStore.setFocus(idx)}
                        style={{
                            display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                            background: focused ? 'rgba(249,115,22,0.15)' : parent ? 'rgba(255,255,255,0.05)' : 'transparent',
                            border: `1px solid ${focused ? AGENT_COL : parent ? parent.col : 'transparent'}`,
                            borderRadius: 6, padding: '4px 6px', marginBottom: 2,
                            fontFamily: 'inherit', color: '#fff',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: parent ? parent.col : isElite ? ELITE_COL : 'rgba(255,255,255,0.65)' }}>
                                #{idx + 1}{rank === 0 ? ' ★' : ''}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {parent
                                    ? <span style={{ color: parent.col, fontWeight: 700, marginRight: 6 }}>{parent.label}</span>
                                    : isElite && <span style={{ color: ELITE_COL, fontWeight: 700, marginRight: 6 }}>ELITE</span>}
                                {Math.round(ind.fitness)}
                            </span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.max(3, fitBar(ind.fitness) * 100)}%`, height: '100%',
                                background: parent ? parent.col : isElite ? ELITE_COL : WEAK_COL, borderRadius: 3,
                            }} />
                        </div>
                    </button>
                );
            })}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, padding: '8px 4px 4px' }}>
                Top {GAME_CONFIG.ELITE_COUNT} survive as elites — <span style={{ color: PARENT_A_COL }}>#1</span> and <span style={{ color: PARENT_B_COL }}>#2</span> are
                the crossover parents shown in the DNA reveal. The rest is replaced by offspring.
            </div>
        </div>
    );
}

// ---- Canvas-Zeichnung (Arena-Koordinaten, 800×800) ----

function draw(ctx: CanvasRenderingContext2D, sims: GhostSim[], ghost: PlayerGhost, focusIdx: number, colors: string[], hideOthers: boolean) {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    const frameIdx = Math.min(sims[0]?.frame ?? 0, ghost.frames.length - 1);
    if (frameIdx < 0) return;

    // Bisheriger Weg des Spieler-Ghosts (grob gesampelt)
    ctx.strokeStyle = 'rgba(96,165,250,0.18)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let i = 0; i <= frameIdx; i += 8) {
        const p = ghost.frames[i].position;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else         ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Nicht fokussierte Agenten zuerst (gedimmt), Fokus zuletzt (obendrauf)
    if (!hideOthers) {
        sims.forEach((sim, i) => { if (i !== focusIdx) drawAgent(ctx, sim, 0.45, false, colors[i] ?? WEAK_COL); });
    }
    const focus = sims[focusIdx];
    if (focus) {
        const focusCol = colors[focusIdx] ?? WEAK_COL;
        // Bullets nur der Fokus-Simulation — alle 20 Kugelschwärme wären Chaos
        for (const b of focus.playerBullets) drawBullet(ctx, b.position.x, b.position.y, PLAYER_COL);
        for (const b of focus.agentBullets)  drawBullet(ctx, b.position.x, b.position.y, focusCol);
        drawAgent(ctx, focus, 1, true, focusCol);
    }

    // Spieler-Ghost (das Recording)
    const pf = ghost.frames[frameIdx];
    ctx.globalAlpha = 0.9;
    ctx.fillStyle   = PLAYER_COL;
    ctx.beginPath();
    ctx.arc(pf.position.x, pf.position.y, GAME_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = 'rgba(96,165,250,0.9)';
    ctx.font        = `11px ${MONO}`;
    ctx.textAlign   = 'center';
    ctx.fillText('YOU (recording)', pf.position.x, pf.position.y - GAME_CONFIG.PLAYER_RADIUS - 8);
    ctx.textAlign   = 'left';
}

function drawAgent(ctx: CanvasRenderingContext2D, sim: GhostSim, alpha: number, focused: boolean, color: string) {
    const { pos, rot } = sim.agent;
    const r = GAME_CONFIG.AGENT_RADIUS;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7,  r * 0.7);
    ctx.lineTo(-r * 0.7, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (focused) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, GAME_CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
}
