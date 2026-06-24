import { useRef, useCallback, useState } from 'react';
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
import { useInput }          from '../hooks/useInput';
import { useGameLoop }       from '../hooks/useGameLoop';
import { update }            from '../game/core/gameLoop';
import { renderer }          from '../game/core/renderer';
import { calculateFitness }  from '../game/ga/fitness';
import { gameStore }         from '../game/gameStore';
import { analyticsStore }    from '../game/analyticsStore';
import { useSettings }       from '../../../context/SettingsContext.tsx';
import type { ShooterSettings } from '../../../context/SettingsContext.tsx';
import styles                from './ShooterCanvas.module.css';

// ---- Crossover Visualization ----

const COL_A = '#60a5fa';
const COL_B = '#f97316';

function CrossoverViz({ example }: { example: CrossoverExample }) {
    const blockPct = 100 / example.parentA.length;

    const renderRow = (dna: number[], color: string, label: string) => (
        <div className={styles.crossoverRow}>
            <span className={styles.crossoverRowLabel} style={{ color }}>{label}</span>
            <div className={styles.crossoverBlocks}>
                {dna.map((v, i) => (
                    <div
                        key={i}
                        className={styles.crossoverBlock}
                        title={`${DNA_NAMES[i]}: ${v.toFixed(2)}`}
                        style={{ background: color, opacity: 0.2 + v * 0.8 }}
                    />
                ))}
            </div>
        </div>
    );

    const child = [
        ...example.parentA.slice(0, example.crossPoint),
        ...example.parentB.slice(example.crossPoint),
    ];

    return (
        <div className={styles.crossover}>
            <div className={styles.crossoverTitle}>Crossover</div>
            {renderRow(example.parentA, COL_A, 'A')}
            {renderRow(example.parentB, COL_B, 'B')}
            <div className={styles.crossoverMarkerWrap}>
                <div
                    className={styles.crossoverMarkerLine}
                    style={{ left: `${example.crossPoint * blockPct}%` }}
                />
                <span
                    className={styles.crossoverMarkerText}
                    style={{ left: `${example.crossPoint * blockPct}%` }}
                >
                    Punkt
                </span>
            </div>
            <div className={styles.crossoverRow}>
                <span className={styles.crossoverRowLabel} style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Kind
                </span>
                <div className={styles.crossoverBlocks}>
                    {child.map((v, i) => {
                        const fromA = i < example.crossPoint;
                        return (
                            <div
                                key={i}
                                className={styles.crossoverBlock}
                                title={`${DNA_NAMES[i]}: ${v.toFixed(2)} (von ${fromA ? 'A' : 'B'})`}
                                style={{
                                    background:    fromA ? COL_A : COL_B,
                                    opacity:       0.2 + v * 0.8,
                                    outline:       `1.5px solid ${fromA ? COL_A : COL_B}`,
                                    outlineOffset: '1px',
                                }}
                            />
                        );
                    })}
                </div>
            </div>
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
        dna:   settings.starterDna.map(v =>
            Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1))
        ),
        stats: emptyStats(),
    },
});

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?: number;
}

export const ShooterCanvas = ({ scale = 1 }: ShooterCanvasProps) => {
    const { eaSettings, shooterSettings } = useSettings();

    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const gameStateRef   = useRef<GameState | null>(null);
    const agentFramesRef = useRef<AgentGhostFrame[]>([]);
    const inputRef       = useInput();
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

    // onUpdate: Spiellogik – gibt neuen State zurück
    const onUpdate = useCallback((
        state: GameState,
        dt:    number,
        input: InputState,
    ): GameState => {
        const next = update(state, dt, input);

        if (next.lastAgentFrame) {
            agentFramesRef.current.push(next.lastAgentFrame);
        }

        if (next.phase !== state.phase) {
            setPhase(next.phase);
        }

        gameStore.state = next;
        return next;
    }, []);

    // onRender: Canvas zeichnen
    const onRender = useCallback((state: GameState) => {
        renderer.render(canvasRef.current, state);
    }, []);

    useGameLoop({
        gameState:  gameStateRef as React.RefObject<GameState>,
        inputState: inputRef,
        onUpdate,
        onRender,
        isRunning: phase === 'playing',
    });

    const startRound = () => {
        const currentState = gameStateRef.current!;
        const nextRound    = currentState.roundNumber + 1;

        const population = currentState.population ?? initPopulation(shooterSettings.starterDna, eaSettings.populationSize);

        // Runden-Daten für Analytics speichern (nach Runde 1+)
        if (currentState.roundNumber > 0) {
            const s = currentState.agent.stats;
            analyticsStore.push({
                round:        currentState.roundNumber,
                hitsLanded:   s.hitsLanded,
                hitsReceived: s.hitsReceived,
                bulletsFired: s.bulletsFired,
                accuracy:     s.bulletsFired > 0 ? s.hitsLanded / s.bulletsFired : 0,
                dodged:       s.dodgedBullets,
                fitness:      calculateFitness(s),
                generation:   currentState.population?.generation ?? 1,
                bestFitness:  currentState.population?.bestFitness ?? 0,
                playerFrames: currentState.ghostFrames,
                agentFrames:  agentFramesRef.current,
                agentDna:     currentState.agent.dna,
            });
        }

        const crossoverExample: CrossoverExample | null =
            currentState.roundNumber > 0 && population.individuals.length >= 2
                ? {
                    parentA:    population.individuals[0].dna,
                    parentB:    population.individuals[1].dna,
                    crossPoint: Math.floor(Math.random() * (DNA_LENGTH - 1)) + 1,
                }
                : null;

        const evolvedPopulation = currentState.roundNumber > 0
            ? (() => {
                const ghost: PlayerGhost = {
                    frames:        currentState.ghostFrames,
                    roundDuration: shooterSettings.roundDuration,
                };
                return currentState.ghostFrames.length > 0
                    ? presimulateAgainstGhost(eaSettings.presimGenerations, ghost, population, eaSettings.crossoverType)
                    : evolve(
                        population,
                        calculateFitness(currentState.agent.stats),
                        eaSettings.mutationRate,
                        eaSettings.mutationStrength,
                        eaSettings.crossoverType,
                    );
            })()
            : population;

        const nextDna = getNextAgent(evolvedPopulation, nextRound);

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
            height:   ARENA.HEIGHT * scale,
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
                <canvas
                    ref={canvasRef}
                    width={ARENA.WIDTH}
                    height={ARENA.HEIGHT}
                    className={styles.canvas}
                />

                {phase === 'idle' && (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Shooter vs GA</h2>
                        <p className={styles.subtitle}>WASD bewegen · Maus zielen · Linksklick schießen</p>
                        <button className={styles.startBtn} onClick={startRound}>
                            Runde starten
                        </button>
                    </div>
                )}

                {phase === 'roundEnd' && (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Runde beendet</h2>
                        <div className={styles.stats}>
                            <span>Treffer gelandet: {gameStateRef.current?.agent.stats.hitsLanded}</span>
                            <span>Selbst getroffen: {gameStateRef.current?.agent.stats.hitsReceived}</span>
                            <span>Ausgewichen: {gameStateRef.current?.agent.stats.dodgedBullets}</span>
                        </div>
                        {gameStateRef.current?.crossoverExample && (
                            <CrossoverViz example={gameStateRef.current.crossoverExample} />
                        )}
                        <button className={styles.startBtn} onClick={startRound}>
                            Nächste Runde →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};