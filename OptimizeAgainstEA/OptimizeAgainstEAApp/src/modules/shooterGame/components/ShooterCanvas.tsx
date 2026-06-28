import { useRef, useCallback, useState, useEffect } from 'react';
import {
    ARENA,
    GAME_CONFIG,
    DNA_LENGTH,
    DNA_NAMES,
    emptyStats,
    type GameState,
    type GamePhase,
    type InputState,
    type PlayerGhost,
    type AgentGhostFrame,
    type CrossoverExample,
} from '../shooter.types';

import { evolve, getNextAgent, presimulateAgainstGhost } from '../game/ga/evolution';
import { initPopulation } from '../game/ga/population';
import { consumePendingSlot, submitRaidbossFitness, claimRaidbossSlot, setRaidbossActive } from '../game/raidbossStore';
import type { RaidbossSlot } from '../game/raidbossStore';
import { useInput }          from '../hooks/useInput';
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

const GENE_LABELS: Record<string, string> = {
    AGGRESSION:      'Aggression',
    DODGE_WEIGHT:    'Dodge',
    SHOOT_ACCURACY:  'Accuracy',
    PREFERRED_RANGE: 'Range',
    MOVEMENT_SPEED:  'Speed',
    PREDICT_LEAD:    'Lead',
    FIRE_RATE:       'Fire Rate',
    BULLET_SPEED:    'Bullet Speed',
};

function Bar({ value, color }: { value: number; color: string }) {
    return (
        <div className={styles.crossoverBar}>
            <div className={styles.crossoverBarTrack}>
                <div style={{ width: `${value * 100}%`, background: color, height: '100%', borderRadius: 3, opacity: 0.8 }} />
            </div>
            <span className={styles.crossoverBarVal} style={{ color }}>{value.toFixed(2)}</span>
        </div>
    );
}

function CrossoverViz({ example }: { example: CrossoverExample }) {
    const child = [
        ...example.parentA.slice(0, example.crossPoint),
        ...example.parentB.slice(example.crossPoint),
    ];

    return (
        <div className={styles.crossover}>
            <div className={styles.crossoverTitle}>Neue DNA</div>

            <div className={styles.crossoverGeneRow}>
                <span className={styles.crossoverGeneName} />
                <span className={styles.crossoverColLabel} style={{ color: COL_A }}>DNA A</span>
                <span className={styles.crossoverColLabel} style={{ color: COL_B }}>DNA B</span>
                <span className={styles.crossoverColLabel} style={{ color: 'rgba(255,255,255,0.7)' }}>Neu</span>
            </div>

            {DNA_NAMES.map((name, i) => (
                <div key={i} className={styles.crossoverGeneRow}>
                    <span className={styles.crossoverGeneName}>{GENE_LABELS[name] ?? name}</span>
                    <Bar value={example.parentA[i]} color={COL_A} />
                    <Bar value={example.parentB[i]} color={COL_B} />
                    <Bar value={child[i]}           color={i < example.crossPoint ? COL_A : COL_B} />
                </div>
            ))}
        </div>
    );
}

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
            <span className={styles.tugLabelPlayer}>DU</span>
        </div>
    );
}

// ---- Hilfsfunktionen ----

const makeInitialGameState = (settings: ShooterSettings): GameState => ({
    phase:            'idle',
    roundTimer:       settings.roundDuration,
    roundNumber:      0,
    bullets:          [],
    population:       null,
    ghostFrames:      [],
    lastAgentFrame:   null,
    crossoverExample: null,
    player: {
        id:       'player',
        position: { x: 200, y: ARENA.HEIGHT / 2 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius:   GAME_CONFIG.PLAYER_RADIUS,
        health:   100,
    },
    agent: {
        id:             'agent',
        position:       { x: ARENA.WIDTH - 200, y: ARENA.HEIGHT / 2 },
        velocity:       { x: 0, y: 0 },
        rotation:       Math.PI,
        radius:         GAME_CONFIG.AGENT_RADIUS,
        health:         100,
        dna: [...settings.starterDna],
        stats: emptyStats(),
    },
});

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?: number;
}

export const ShooterCanvas = ({ scale = 1 }: ShooterCanvasProps) => {
    const { eaSettings, shooterSettings } = useSettings();

    const canvasRef            = useRef<HTMLCanvasElement>(null);
    const gameStateRef         = useRef<GameState | null>(null);
    const agentFramesRef       = useRef<AgentGhostFrame[]>([]);
    const matchScoreRef        = useRef(0);
    const prevHitsRef          = useRef({ landed: 0, received: 0 });
    const analyticsLoggedRef   = useRef(false);
    const hallOfFameGhostRef   = useRef<PlayerGhost | null>(null);
    const hallOfFameHitsRef    = useRef<number>(-1);
    const inputRef             = useInput();

    const [matchScore, setMatchScore]           = useState(0);
    const [isRaidbossRound, setIsRaidbossRound] = useState(false);
    const [trainNextLoading, setTrainNextLoading] = useState(false);
    const raidbossSlotRef = useRef<RaidbossSlot | null>(null);
    const raidbossInfoRef = useRef<{ generation: number; index: number; total: number } | null>(null);

    useEffect(() => {
        const slot = consumePendingSlot();
        raidbossSlotRef.current = slot;
        if (slot) {
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
                : makeInitialGameState(shooterSettings);
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
            playerFrames: roundState.ghostFrames,
            agentFrames:  agentFramesRef.current,
            agentDna:     roundState.agent.dna,
        });
    }, []);

    // onUpdate: Spiellogik – gibt neuen State zurück
    const onUpdate = useCallback((
        state: GameState,
        dt:    number,
        input: InputState,
    ): GameState => {
        const next = update(state, dt, input, shooterSettings.playerStats);

        if (next.lastAgentFrame) {
            agentFramesRef.current.push(next.lastAgentFrame);
        }

        if (next.phase !== state.phase) {
            setPhase(next.phase);
            if (next.phase === 'roundEnd') pushRoundAnalytics(next);
        }

        // Tug of war: live hit tracking
        const landedDelta   = next.agent.stats.hitsLanded   - prevHitsRef.current.landed;
        const receivedDelta = next.agent.stats.hitsReceived  - prevHitsRef.current.received;
        if (landedDelta > 0 || receivedDelta > 0) {
            prevHitsRef.current = { landed: next.agent.stats.hitsLanded, received: next.agent.stats.hitsReceived };
            const threshold = shooterSettings.tugWinThreshold;
            const newScore = Math.max(-threshold,
                Math.min(threshold, matchScoreRef.current + receivedDelta - landedDelta));
            matchScoreRef.current = newScore;
            setMatchScore(newScore);
            if (Math.abs(newScore) >= threshold) {
                setPhase('roundEnd');
                pushRoundAnalytics(next);
            }
        }

        gameStore.state = next;
        return next;
    }, []);

    // onRender: Canvas zeichnen
    const onRender = useCallback((state: GameState) => {
        renderer.render(canvasRef.current, state, raidbossInfoRef.current ?? undefined);
    }, []);

    useGameLoop({
        gameState:  gameStateRef as React.RefObject<GameState>,
        inputState: inputRef,
        onUpdate,
        onRender,
        isRunning: phase === 'playing',
    });

    const submitCurrentRaidbossFitness = (): Promise<void> => {
        const slot  = raidbossSlotRef.current;
        const state = gameStateRef.current;
        if (slot && state && state.roundNumber > 0) {
            const fitness = calculateRaidbossFitness(state.agent.stats, shooterSettings.roundDuration);
            const p = submitRaidbossFitness(slot.index, fitness, slot.doc);
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setRaidbossActive(false);
            return p;
        }
        return Promise.resolve();
    };

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

        // Frische Session: Analytics der alten Session leeren
        if (currentState.roundNumber === 0) {
            analyticsStore.clear();
        }

        analyticsLoggedRef.current = false;

        const population = currentState.population ?? initPopulation(shooterSettings.starterDna, eaSettings.populationSize);

        const crossoverExample: CrossoverExample | null =
            currentState.roundNumber > 0 && population.individuals.length >= 2
                ? {
                    parentA:    population.individuals[0].dna,
                    parentB:    population.individuals[1].dna,
                    crossPoint: Math.floor(Math.random() * (DNA_LENGTH - 1)) + 1,
                }
                : null;

        const realFitness = calculateFitness(currentState.agent.stats);
        const evolvedPopulation = currentState.roundNumber > 0
            ? (() => {
                const ghost: PlayerGhost = {
                    frames:        currentState.ghostFrames,
                    roundDuration: shooterSettings.roundDuration,
                };

                // Hall of Fame: Runde mit den meisten Spieler-Treffern merken
                const playerHitsThisRound = currentState.agent.stats.hitsReceived;
                if (playerHitsThisRound > hallOfFameHitsRef.current && currentState.ghostFrames.length > 0) {
                    hallOfFameHitsRef.current  = playerHitsThisRound;
                    hallOfFameGhostRef.current = ghost;
                }

                // Nicht gegen HoF trainieren wenn es derselbe Ghost ist (erste Runde)
                const hofGhost = hallOfFameGhostRef.current !== ghost
                    ? hallOfFameGhostRef.current ?? undefined
                    : undefined;

                const ghostPop = currentState.ghostFrames.length > 0
                    ? presimulateAgainstGhost(eaSettings.presimGenerations, ghost, population, eaSettings.crossoverType, hofGhost)
                    : population;
                // Echte Spieler-Runde immer als finalen Selektionsdruck einbauen
                return evolve(
                    ghostPop,
                    realFitness,
                    eaSettings.mutationRate,
                    eaSettings.mutationStrength,
                    eaSettings.crossoverType,
                );
            })()
            : population;

        // Raidboss: Slot nur beim ersten Mal (roundNumber === 0) als DNA nutzen.
        // Nach der gespielten Runde Fitness einreichen und Slot leeren.
        const slot = raidbossSlotRef.current;
        const useRaidbossDna = slot !== null && currentState.roundNumber === 0;

        if (slot && currentState.roundNumber > 0) {
            const raidbossFitness = calculateRaidbossFitness(currentState.agent.stats, shooterSettings.roundDuration);
            submitRaidbossFitness(slot.index, raidbossFitness, slot.doc).catch(console.error);
            raidbossSlotRef.current  = null;
            raidbossInfoRef.current  = null;
            setIsRaidbossRound(false);
            setRaidbossActive(false);
        }

        const nextDna = useRaidbossDna
            ? slot!.dna
            : currentState.roundNumber === 0
                ? [...shooterSettings.starterDna]
                : getNextAgent(evolvedPopulation);

        const newState: GameState = {
            ...makeInitialGameState(shooterSettings),
            phase:            'playing',
            roundNumber:      nextRound,
            population:       evolvedPopulation,
            ghostFrames:      [],
            lastAgentFrame:   null,
            crossoverExample,
            agent: {
                ...makeInitialGameState(shooterSettings).agent,
                dna: nextDna,
            },
        };

        agentFramesRef.current = [];
        gameStateRef.current   = newState;
        gameStore.state        = newState;
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
                <TugOfWarBar score={matchScore} threshold={shooterSettings.tugWinThreshold} />

                <canvas
                    ref={canvasRef}
                    width={ARENA.WIDTH}
                    height={ARENA.HEIGHT}
                    className={styles.canvas}
                />

                {phase === 'idle' ? (
                    <div className={styles.overlay}>
                        {isRaidbossRound && raidbossInfoRef.current ? (
                            <>
                                <h2 className={styles.title} style={{ color: '#a855f7' }}>Community Raidboss</h2>
                                <p className={styles.subtitle} style={{ color: 'rgba(168,85,247,0.7)' }}>
                                    Generation {raidbossInfoRef.current.generation} · Individuum {raidbossInfoRef.current.index}/{raidbossInfoRef.current.total}
                                </p>
                                <p className={styles.subtitle}>WASD bewegen · Maus zielen · Linksklick schießen</p>
                            </>
                        ) : (
                            <>
                                <h2 className={styles.title}>Shooter vs GA</h2>
                                <p className={styles.subtitle}>WASD bewegen · Maus zielen · Linksklick schießen</p>
                            </>
                        )}
                        <button className={styles.startBtn} onClick={() => startRound()}>
                            Runde starten
                        </button>
                    </div>
                ) : phase === 'roundEnd' ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Runde beendet</h2>
                        <div className={styles.stats}>
                            <span>Treffer gelandet: {gameStateRef.current?.agent.stats.hitsLanded}</span>
                            <span>Selbst getroffen: {gameStateRef.current?.agent.stats.hitsReceived}</span>
                            <span>Ausgewichen: {gameStateRef.current?.agent.stats.dodgedBullets}</span>
                        </div>
                        {!isRaidbossRound && gameStateRef.current?.crossoverExample && (
                            <CrossoverViz example={gameStateRef.current.crossoverExample} />
                        )}
                        {isRaidbossRound ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className={styles.startBtn}
                                    style={{ borderColor: '#a855f7', color: '#a855f7', opacity: trainNextLoading ? 0.6 : 1 }}
                                    onClick={handleTrainNext}
                                    disabled={trainNextLoading}
                                >
                                    {trainNextLoading ? 'Lade...' : 'Weiter beitragen →'}
                                </button>
                                <button
                                    className={styles.startBtn}
                                    style={{ borderColor: 'rgba(168,85,247,0.4)', color: 'rgba(168,85,247,0.6)', fontSize: 13 }}
                                    onClick={() => { submitCurrentRaidbossFitness(); window.location.href = '/lobby/shooter'; }}
                                    disabled={trainNextLoading}
                                >
                                    ← Lobby
                                </button>
                            </div>
                        ) : (
                            <button className={styles.startBtn} onClick={startRound}>
                                Nächste Runde →
                            </button>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};