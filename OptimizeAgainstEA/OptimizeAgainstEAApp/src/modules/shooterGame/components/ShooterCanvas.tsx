import { useRef, useCallback, useState, useEffect, type CSSProperties, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ARENA,
    GAME_CONFIG,
    DNA_LENGTH,
    DNA_NAMES,
    type GameState,
    type GamePhase,
    type InputState,
    type PlayerGhost,
    type AgentGhostFrame,
    type PlayerGhostFrame,
    type Population,
    type CrossoverExample,
} from '../shooter.types';
import { makeInitialGameState } from '../game/makeGameState';

import { evolve, getNextAgent } from '../game/ga/evolution';
import type { EvolutionWorkerIn, EvolutionWorkerOut } from '../game/ga/evolution.worker';
import { initPopulation } from '../game/ga/population';
import { consumePendingSlot, submitRaidbossFitness, claimRaidbossSlot, setRaidbossActive } from '../game/raidbossStore';
import type { RaidbossSlot } from '../game/raidbossStore';
import { useInput }          from '../hooks/useInput';
import { useTouchControls } from '../hooks/useTouchControls';
import { useGameLoop }       from '../hooks/useGameLoop';
import { update, resetGameLoop } from '../game/core/gameLoop';
import { renderer }          from '../game/core/renderer';
import { calculateFitness, calculateRaidbossFitness } from '../game/ga/fitness';
import { gameStore }         from '../game/gameStore';
import { analyticsStore }    from '../game/analyticsStore';
import { useSettings }       from '../../../context/SettingsContext.tsx';
import type { ShooterSettings } from '../../../context/SettingsContext.tsx';
import styles                from './ShooterCanvas.module.css';

// ---- Crossover Visualization ----

const COL_A = '#60a5fa';
const COL_B = '#f97316';

// ---- Tug of War Bar ----

const BAR_HEIGHT = 44;

function TugOfWarBar({ score, threshold }: { score: number; threshold: number }) {
    const pct         = (score / threshold) * 50 + 50; // 0–100 %
    const playerWins  = score > 0;
    const fillWidth   = Math.abs(score / threshold) * 50;

    return (
        <div className={styles.tugBar}>
            <span className={styles.tugLabelEA}>EA</span>
            <div className={styles.tugTrack}>
                {score !== 0 && (
                    <div
                        className={styles.tugFill}
                        style={{
                            left:       playerWins ? '50%' : `${50 - fillWidth}%`,
                            width:      `${fillWidth}%`,
                            background: playerWins ? '#60a5fa' : '#f97316',
                        }}
                    />
                )}
                <div className={styles.tugCenter} />
                <div className={styles.tugKnot} style={{ left: `${pct}%` }} />
            </div>
            <span className={styles.tugLabelPlayer}>YOU</span>
        </div>
    );
}

// ---- Raidboss-feste Spielkonfiguration ----
// Unabhängig von den Spielereinstellungen, damit Fitness-Werte verschiedener Spieler vergleichbar sind
const RAIDBOSS_ROUND_DURATION = 30;
const RAIDBOSS_TUG_THRESHOLD  = 15;

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?:            number;
    externalInputRef?: RefObject<InputState>;           // von ShooterGamePage; wenn gesetzt → Zone-Touch-Modus
    leaveHandlerRef?:  RefObject<(() => Promise<void>) | undefined>;  // ShooterGamePage registriert sich hier für sauberes Verlassen
}

export const ShooterCanvas = ({ scale = 1, externalInputRef, leaveHandlerRef }: ShooterCanvasProps) => {
    const { eaSettings, shooterSettings } = useSettings();
    const navigate = useNavigate();

    const canvasRef            = useRef<HTMLCanvasElement>(null);
    const nullCanvasRef        = useRef<HTMLCanvasElement | null>(null);  // immer null → deaktiviert Canvas-Touch
    const gameStateRef         = useRef<GameState | null>(null);
    const agentFramesRef       = useRef<AgentGhostFrame[]>([]);
    const playerFramesRef      = useRef<PlayerGhostFrame[]>([]);
    const matchScoreRef        = useRef(0);
    const prevHitsRef          = useRef({ landed: 0, received: 0 });
    const analyticsLoggedRef   = useRef(false);
    const hallOfFameGhostRef   = useRef<PlayerGhost | null>(null);
    const hallOfFameHitsRef    = useRef<number>(-1);
    const evolutionWorkerRef   = useRef<Worker | null>(null);
    const pendingRoundDataRef  = useRef<{
        nextRound:        number;
        crossoverExample: CrossoverExample | null;
        overrideDna:      number[] | null;
        settings:         typeof shooterSettings;
    } | null>(null);
    const _internalInputRef     = useInput();
    const inputRef              = externalInputRef ?? _internalInputRef;
    const shooterSettingsRef    = useRef(shooterSettings);
    // Wenn externe Input-Refs (Zone-Touch) aktiv: Canvas-Touch deaktivieren
    const touchCanvasRef       = externalInputRef ? nullCanvasRef : canvasRef;
    const touchVisualRef       = useTouchControls(inputRef, touchCanvasRef);

    const [matchScore, setMatchScore]                     = useState(0);
    const [isRaidbossRound, setIsRaidbossRound]           = useState(false);
    const [trainNextLoading, setTrainNextLoading]         = useState(false);
    const [revealDna, setRevealDna]                       = useState<number[] | null>(null);
    const [displayedRevealDna, setDisplayedRevealDna]     = useState<number[]>([]);
    const [revealGeneration, setRevealGeneration]         = useState<number | null>(null);
    const [revealCrossoverExample, setRevealCrossoverExample] = useState<CrossoverExample | null>(null);
    const raidbossSlotRef    = useRef<RaidbossSlot | null>(null);
    const raidbossInfoRef    = useRef<{ generation: number; index: number; total: number } | null>(null);
    const pendingSubmitRef   = useRef<Promise<void>>(Promise.resolve());
    const pendingNewStateRef = useRef<GameState | null>(null);
    const revealAnimTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Im Raidboss-Modus feste Spielwerte verwenden damit Fitness-Vergleiche zwischen Spielern fair sind
    const gameShooterSettings: ShooterSettings = isRaidbossRound
        ? {
            ...shooterSettings,
            roundDuration:   RAIDBOSS_ROUND_DURATION,
            tugWinThreshold: RAIDBOSS_TUG_THRESHOLD,
            playerStats: {
                bulletSpeed:   GAME_CONFIG.BULLET_SPEED,
                moveSpeed:     GAME_CONFIG.PLAYER_SPEED,
                shootCooldown: GAME_CONFIG.SHOOT_COOLDOWN,
            },
        }
        : shooterSettings;

    useEffect(() => {
        const slot = consumePendingSlot();
        if (slot) {
            raidbossSlotRef.current = slot;
            setIsRaidbossRound(true);
            setRaidbossActive(true);
            raidbossInfoRef.current = {
                generation: slot.doc.generation,
                index:      slot.index + 1,
                total:      slot.doc.populationSize,
            };
            // Idle-DNA auf Slot-DNA setzen, damit DNADisplay beim Rundenstart keine Änderung zeigt
            const current = gameStateRef.current!;
            const withSlotDna = { ...current, agent: { ...current.agent, dna: slot.dna } };
            gameStateRef.current = withSlotDna;
            gameStore.state      = withSlotDna;
            gameStore.notify();
        }
        return () => { setRaidbossActive(false); };
    }, []);

    useEffect(() => {
        shooterSettingsRef.current = gameShooterSettings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRaidbossRound, shooterSettings]);

    useEffect(() => {
        return () => {
            evolutionWorkerRef.current?.terminate();

            // Raidboss-Fitness beim Verlassen einreichen falls noch nicht geschehen.
            // Deckt alle Exit-Pfade ab (Overlay-Button, Mobile-Nav-Button, Browser-Back).
            const slot  = raidbossSlotRef.current;
            const state = gameStateRef.current;
            if (slot && state && state.roundNumber > 0) {
                const fitness = calculateRaidbossFitness(
                    state.agent.stats,
                    shooterSettingsRef.current.roundDuration,
                );
                submitRaidbossFitness(slot.index, fitness, slot.doc).catch(console.error);
                setRaidbossActive(false);
            }
        };
    }, []);

    // Wird aufgerufen sobald die Evolution (Worker oder sync) eine neue Population hat
    const completeRound = useCallback((evolvedPopulation: Population) => {
        const pending = pendingRoundDataRef.current;
        if (!pending) return;
        pendingRoundDataRef.current = null;

        const nextDna = pending.overrideDna ?? getNextAgent(evolvedPopulation);
        const base    = makeInitialGameState(pending.settings);
        const newState: GameState = {
            ...base,
            phase:            'playing',
            roundNumber:      pending.nextRound,
            population:       evolvedPopulation,
            lastPlayerFrame:  null,
            lastAgentFrame:   null,
            crossoverExample: pending.crossoverExample,
            agent: { ...base.agent, dna: nextDna },
        };

        playerFramesRef.current = [];
        agentFramesRef.current  = [];

        // Kein DNA-Reveal für Runde 1 oder Raidboss (DNA hat sich nicht durch Evolution geändert)
        if (pending.overrideDna !== null) {
            gameStateRef.current = newState;
            gameStore.state      = newState;
            gameStore.notify();
            setPhase('playing');
            return;
        }

        // DNA-Reveal: neue evolved DNA animiert zeigen, bevor nächste Runde startet
        const oldDna = gameStateRef.current?.agent.dna ?? nextDna;
        setDisplayedRevealDna([...oldDna]);

        // gameStore schon jetzt mit neuer DNA updaten → DNADisplay rechts aktualisiert sich sofort
        const revealState: GameState = { ...newState, phase: gameStateRef.current?.phase ?? 'roundEnd' };
        gameStateRef.current = revealState;
        gameStore.state      = revealState;
        gameStore.notify();

        pendingNewStateRef.current = newState;
        setRevealGeneration(evolvedPopulation.generation);
        setRevealCrossoverExample(pending.crossoverExample);
        setRevealDna([...nextDna]);
    }, []);

    useEffect(() => {
        if (!revealDna) return;

        revealAnimTimersRef.current.forEach(clearTimeout);
        revealAnimTimersRef.current = [];

        revealDna.forEach((target, i) => {
            const t = setTimeout(() => {
                setDisplayedRevealDna(prev => {
                    const next = [...prev];
                    next[i] = target;
                    return next;
                });
            }, Math.floor(i / 2) * 200 + 150);
            revealAnimTimersRef.current.push(t);
        });

        return () => {
            revealAnimTimersRef.current.forEach(clearTimeout);
            revealAnimTimersRef.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealDna]);

    const saved = gameStore.state;
    const restoredPhase: GamePhase =
        saved?.roundNumber > 0
            ? (saved.phase === 'playing' ? 'roundEnd' : saved.phase)
            : 'idle';
    const [phase, setPhase] = useState<GamePhase>(restoredPhase);

    // Lazy initialisieren – vorherigen State wiederherstellen falls vorhanden
    if (!gameStateRef.current) {
        const state =
            saved?.roundNumber > 0
                ? { ...saved, phase: restoredPhase }
                : makeInitialGameState(gameShooterSettings);
        gameStateRef.current = state;
        gameStore.state      = state;
    }

    const pushRoundAnalytics = useCallback((roundState: GameState) => {
        if (analyticsLoggedRef.current || roundState.roundNumber === 0) return;
        analyticsLoggedRef.current = true;
        const s = roundState.agent.stats;
        analyticsStore.push({
            round:        roundState.roundNumber,
            hitsLanded:   s.hitsLanded,
            hitsReceived: s.hitsReceived,
            bulletsFired: s.bulletsFired,
            accuracy:     s.bulletsFired > 0 ? s.hitsLanded / s.bulletsFired : 0,
            dodged:       s.dodgedBullets,
            fitness:      calculateFitness(s),
            generation:   roundState.population?.generation ?? 1,
            bestFitness:  roundState.population?.bestFitness ?? 0,
            playerFrames: playerFramesRef.current,
            agentFrames:  agentFramesRef.current,
            agentDna:     roundState.agent.dna,
        }, eaSettings.maxAnalyticsRounds);
    }, [eaSettings.maxAnalyticsRounds]);

    // Raidboss-Fitness beim Rundenende einreichen (fire-and-forget, idempotent via slot=null).
    // Slot wird sofort auf null gesetzt → kein Doppel-Submit egal welcher Exit-Pfad folgt.
    const submitRaidbossOnRoundEnd = (endState: GameState) => {
        const slot = raidbossSlotRef.current;
        if (!slot || endState.roundNumber <= 0) return;
        const fitness = calculateRaidbossFitness(
            endState.agent.stats,
            shooterSettingsRef.current.roundDuration,
        );
        // Speichert die Promise damit submitCurrentRaidbossFitness sie awaiten kann
        pendingSubmitRef.current = submitRaidbossFitness(slot.index, fitness, slot.doc)
            .catch(console.error)
            .then(() => undefined);
        raidbossSlotRef.current = null;  // verhindert Doppel-Submit
    };

    // onUpdate: Spiellogik – gibt neuen State zurück
    const onUpdate = useCallback((
        state: GameState,
        dt:    number,
        input: InputState,
    ): GameState => {
        const next = update(state, dt, input, gameShooterSettings.playerStats);

        if (next.lastPlayerFrame) playerFramesRef.current.push(next.lastPlayerFrame);
        if (next.lastAgentFrame)  agentFramesRef.current.push(next.lastAgentFrame);

        if (next.phase !== state.phase) {
            setPhase(next.phase);
            if (next.phase === 'roundEnd') {
                pushRoundAnalytics(next);
                submitRaidbossOnRoundEnd(next);
            }
        }

        // Tug of war: live hit tracking
        const landedDelta   = next.agent.stats.hitsLanded   - prevHitsRef.current.landed;
        const receivedDelta = next.agent.stats.hitsReceived  - prevHitsRef.current.received;
        if (landedDelta > 0 || receivedDelta > 0) {
            prevHitsRef.current = { landed: next.agent.stats.hitsLanded, received: next.agent.stats.hitsReceived };
            const threshold = gameShooterSettings.tugWinThreshold;
            const newScore = Math.max(-threshold,
                Math.min(threshold, matchScoreRef.current + receivedDelta - landedDelta));
            matchScoreRef.current = newScore;
            setMatchScore(newScore);
            if (Math.abs(newScore) >= threshold) {
                setPhase('roundEnd');
                pushRoundAnalytics(next);
                submitRaidbossOnRoundEnd(next);
            }
        }

        gameStore.state = next;
        return next;
    }, []);

    // onRender: Canvas zeichnen
    const onRender = useCallback((state: GameState) => {
        // Touch-Overlay nur für Canvas-basierte Steuerung (nicht im Zone-Modus)
        const touch = (!externalInputRef && state.phase === 'playing')
            ? touchVisualRef.current
            : null;
        // Ziellaser im Mobile-Zone-Modus (externalInputRef gesetzt)
        const aimLaser = (externalInputRef && state.phase === 'playing')
            ? { mouseX: externalInputRef.current.mouseX, mouseY: externalInputRef.current.mouseY }
            : null;
        renderer.render(canvasRef.current, state, raidbossInfoRef.current ?? undefined, touch, aimLaser);
    }, [externalInputRef]);

    useGameLoop({
        gameState:  gameStateRef as RefObject<GameState>,
        inputState: inputRef,
        onUpdate,
        onRender,
        isRunning: phase === 'playing',
    });

    const submitCurrentRaidbossFitness = (): Promise<void> => {
        const slot  = raidbossSlotRef.current;
        const state = gameStateRef.current;
        if (slot && state && state.roundNumber > 0) {
            const fitness = calculateRaidbossFitness(state.agent.stats, gameShooterSettings.roundDuration);
            const p = submitRaidbossFitness(slot.index, fitness, slot.doc)
                .catch(console.error)
                .then(() => undefined);
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setRaidbossActive(false);
            pendingSubmitRef.current = p;
            return p;
        }
        // Slot bereits durch submitRaidbossOnRoundEnd geleert → auf laufende Transaktion warten
        return pendingSubmitRef.current;
    };

    // leaveHandlerRef immer aktuell halten damit ShooterGamePage awaiten kann
    if (leaveHandlerRef) leaveHandlerRef.current = submitCurrentRaidbossFitness;

    const handleTrainNext = async () => {
        if (trainNextLoading) return;
        setTrainNextLoading(true);

        try {
            await submitCurrentRaidbossFitness();
            await claimRaidbossSlot();
            const slot = consumePendingSlot();
            raidbossSlotRef.current = slot;
            raidbossInfoRef.current = slot
                ? { generation: slot.doc.generation, index: slot.index + 1, total: slot.doc.populationSize }
                : null;
            setIsRaidbossRound(!!slot);
            setRaidbossActive(!!slot);

            const baseReset  = makeInitialGameState(shooterSettings);
            const resetState = slot
                ? { ...baseReset, agent: { ...baseReset.agent, dna: slot.dna } }
                : baseReset;
            gameStateRef.current = resetState;
            gameStore.state      = resetState;
            gameStore.notify();
            matchScoreRef.current = 0;
            setMatchScore(0);
            setPhase('idle');
        } catch (err) {
            console.error('[Raidboss] Slot claim fehlgeschlagen:', err);
            // Fallback: normaler Modus
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setIsRaidbossRound(false);
        } finally {
            setTrainNextLoading(false);
        }
    };

    const startRound = () => {
        resetGameLoop();
        prevHitsRef.current   = { landed: 0, received: 0 };
        matchScoreRef.current = 0;
        setMatchScore(0);

        const currentState = gameStateRef.current!;
        const nextRound    = currentState.roundNumber + 1;

        if (currentState.roundNumber === 0) analyticsStore.clear();
        analyticsLoggedRef.current = false;

        const population = currentState.population
            ?? initPopulation(shooterSettings.starterDna, eaSettings.populationSize);

        const crossoverExample: CrossoverExample | null =
            currentState.roundNumber > 0 && population.individuals.length >= 2
                ? {
                    parentA:     population.individuals[0].dna,
                    parentB:     population.individuals[1].dna,
                    type:        eaSettings.crossoverType,
                    geneOrigins: eaSettings.crossoverType === 'single-point'
                        ? (() => {
                            const point = Math.floor(Math.random() * (DNA_LENGTH - 1)) + 1;
                            return Array.from({ length: DNA_LENGTH }, (_, i) => i < point);
                        })()
                        : Array.from({ length: DNA_LENGTH }, () => Math.random() < 0.5),
                }
                : null;

        // Raidboss: Fitness einreichen und Slot leeren
        const slot = raidbossSlotRef.current;
        const useRaidbossDna = slot !== null && currentState.roundNumber === 0;
        if (slot && currentState.roundNumber > 0) {
            const raidbossFitness = calculateRaidbossFitness(currentState.agent.stats, gameShooterSettings.roundDuration);
            submitRaidbossFitness(slot.index, raidbossFitness, slot.doc).catch(console.error);
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setIsRaidbossRound(false);
            setRaidbossActive(false);
        }

        pendingRoundDataRef.current = {
            nextRound,
            crossoverExample,
            overrideDna: useRaidbossDna
                ? slot!.dna
                : currentState.roundNumber === 0
                    ? [...shooterSettings.starterDna]
                    : null,
            settings: gameShooterSettings,
        };

        // Runde 0 oder kein Presim → direkt synchron
        if (currentState.roundNumber === 0) {
            completeRound(population);
            return;
        }

        const realFitness = calculateFitness(currentState.agent.stats);

        if (eaSettings.presimGenerations === 0 || playerFramesRef.current.length === 0) {
            completeRound(evolve(population, realFitness, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.crossoverType, eaSettings.injectionDeviation));
            return;
        }

        // Schwere Arbeit → Web Worker
        const ghost: PlayerGhost = {
            frames:        playerFramesRef.current,
            roundDuration: gameShooterSettings.roundDuration,
        };

        const playerHitsThisRound = currentState.agent.stats.hitsReceived;
        if (playerHitsThisRound > hallOfFameHitsRef.current) {
            hallOfFameHitsRef.current  = playerHitsThisRound;
            hallOfFameGhostRef.current = ghost;
        }

        const hofGhost = eaSettings.useHallOfFame && hallOfFameGhostRef.current !== ghost
            ? hallOfFameGhostRef.current ?? undefined
            : undefined;

        setPhase('evolving');

        evolutionWorkerRef.current?.terminate();
        const worker = new Worker(
            new URL('../game/ga/evolution.worker.ts', import.meta.url),
            { type: 'module' },
        );
        worker.onmessage = (e: MessageEvent<EvolutionWorkerOut>) => {
            if (e.data.type === 'DONE') {
                completeRound(e.data.population);
            } else {
                console.error('[EvolutionWorker]', (e.data as { message: string }).message);
                // Fallback: synchron ohne Presim
                completeRound(evolve(population, realFitness, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.crossoverType, eaSettings.injectionDeviation));
            }
            worker.terminate();
            evolutionWorkerRef.current = null;
        };
        evolutionWorkerRef.current = worker;
        worker.postMessage({
            type: 'PRESIM',
            ghost,
            hofGhost,
            population,
            realFitness,
            generations:         eaSettings.presimGenerations,
            mutationRate:        eaSettings.mutationRate,
            mutationStrength:    eaSettings.mutationStrength,
            crossoverType:       eaSettings.crossoverType,
            injectionDeviation:  eaSettings.injectionDeviation,
        } satisfies EvolutionWorkerIn);
    };

    const applyAndPlay = () => {
        const newState = pendingNewStateRef.current;
        if (!newState) return;
        pendingNewStateRef.current = null;
        setRevealDna(null);
        setRevealGeneration(null);
        setRevealCrossoverExample(null);
        gameStateRef.current = newState;
        gameStore.state      = newState;
        gameStore.notify();
        setPhase('playing');
    };

    return (
        <div style={{
            width:    ARENA.WIDTH  * scale,
            height:   (ARENA.HEIGHT + BAR_HEIGHT) * scale,
            position: 'relative',
        }}>
            <div
                className={styles.wrapper}
                style={{
                    transform:       `scale(${scale})`,
                    transformOrigin: 'top left',
                    position:        'absolute',
                    top:  0,
                    left: 0,
                }}
            >
                <TugOfWarBar score={matchScore} threshold={gameShooterSettings.tugWinThreshold} />

                <canvas
                    ref={canvasRef}
                    width={ARENA.WIDTH}
                    height={ARENA.HEIGHT}
                    className={styles.canvas}
                />

                {revealDna !== null ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>New DNA</h2>
                        <p className={styles.subtitle}>Generation {revealGeneration ?? '—'}</p>
                        <div style={{
                            display:       'flex',
                            flexDirection: 'column',
                            gap:           8,
                            width:         'min(300px, 80%)',
                        }}>
                            {DNA_NAMES.map((name, i) => {
                                const cx    = revealCrossoverExample;
                                const color = cx ? (cx.geneOrigins[i] ? COL_A : COL_B) : COL_B;
                                const val   = displayedRevealDna[i] ?? 0;
                                return (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <span style={{
                                                fontFamily:    'var(--font-mono)',
                                                fontSize:      10,
                                                color:         'rgba(255,255,255,0.38)',
                                                textTransform: 'uppercase' as const,
                                                letterSpacing: '0.06em',
                                            }}>{name}</span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{val.toFixed(2)}</span>
                                        </div>
                                        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${val * 100}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.65, transition: 'width 0.15s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="btn btn--primary" onClick={applyAndPlay}>
                            Next Round →
                        </button>
                    </div>
                ) : phase === 'idle' ? (
                    <div className={styles.overlay}>
                        {isRaidbossRound && raidbossInfoRef.current ? (
                            <>
                                <h2 className={styles.title} style={{ color: '#a855f7' }}>Community Raidboss</h2>
                                <p className={styles.subtitle} style={{ color: 'rgba(168,85,247,0.7)' }}>
                                    Generation {raidbossInfoRef.current.generation} · Individual {raidbossInfoRef.current.index}/{raidbossInfoRef.current.total}
                                </p>
                                <p className={styles.subtitle}>WASD to move · Mouse to aim · Left-click to shoot</p>
                            </>
                        ) : (
                            <>
                                <h2 className={styles.title}>Shooter vs GA</h2>
                                <p className={styles.subtitle}>WASD to move · Mouse to aim · Left-click to shoot</p>
                            </>
                        )}
                        <button className="btn btn--primary" onClick={() => startRound()}>
                            Start Round
                        </button>
                    </div>
                ) : phase === 'roundEnd' ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Round Over</h2>
                        <div className={styles.roundStats}>
                            <div className={styles.roundStatSide}>
                                <span className={styles.roundStatLabel} style={{ color: '#f97316' }}>EA</span>
                                <span className={styles.roundStatCount} style={{ color: '#f97316' }}>
                                    {gameStateRef.current?.agent.stats.hitsLanded ?? 0}
                                </span>
                                <span className={styles.roundStatSub}>Hits</span>
                            </div>
                            <span className={styles.roundStatDivider}>:</span>
                            <div className={styles.roundStatSide}>
                                <span className={styles.roundStatLabel} style={{ color: '#60a5fa' }}>YOU</span>
                                <span className={styles.roundStatCount} style={{ color: '#60a5fa' }}>
                                    {gameStateRef.current?.agent.stats.hitsReceived ?? 0}
                                </span>
                                <span className={styles.roundStatSub}>Hits</span>
                            </div>
                        </div>
                        {isRaidbossRound ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className="btn btn--soft"
                                    style={{ '--btn-color': '#a855f7' } as CSSProperties}
                                    onClick={async () => {
                                        setTrainNextLoading(true);
                                        try { await submitCurrentRaidbossFitness(); } finally { setTrainNextLoading(false); }
                                        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                                        navigate('/lobby/shooter', { state: { mode: 'raidboss' } });
                                    }}
                                    disabled={trainNextLoading}
                                >
                                    {trainNextLoading ? 'Saving...' : '← Lobby'}
                                </button>
                                <button
                                    className="btn btn--outline"
                                    style={{ '--btn-color': '#a855f7' } as CSSProperties}
                                    onClick={handleTrainNext}
                                    disabled={trainNextLoading}
                                >
                                    {trainNextLoading ? 'Loading...' : 'Contribute more →'}
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn--primary" onClick={startRound}>
                                Continue →
                            </button>
                        )}
                    </div>
                ) : phase === 'evolving' ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>EA is evolving...</h2>
                        <p className={styles.subtitle}>
                            Generation {(gameStateRef.current?.population?.generation ?? 0) + 1}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};