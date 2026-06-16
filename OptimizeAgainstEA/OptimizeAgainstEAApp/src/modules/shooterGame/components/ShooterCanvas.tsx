import { useRef, useCallback, useState } from 'react';
import {
    ARENA,
    GAME_CONFIG,
    emptyStats,
    type GameState,
    type GamePhase,
    type InputState,
    type PlayerGhost,
} from '../shooter.types';
import { evolve, getNextAgent, presimulateAgainstGhost } from '../game/ga/evolution';
import { initPopulation } from '../game/ga/population';
import { useInput }          from '../hooks/useInput';
import { useGameLoop }       from '../hooks/useGameLoop';
import { update }            from '../game/core/gameLoop';
import { renderer }          from '../game/core/renderer';
import { calculateFitness }  from '../game/ga/fitness';
import { gameStore }         from '../game/gameStore';
import { useSettings }       from '../../../context/SettingsContext.tsx';
import type { ShooterSettings } from '../../../context/SettingsContext.tsx';
import styles                from './ShooterCanvas.module.css';

// ---- Hilfsfunktionen ----

const makeInitialGameState = (settings: ShooterSettings): GameState => ({
    phase:       'idle',
    roundTimer:  settings.roundDuration,
    roundNumber: 0,
    bullets:     [],
    population:  null,
    ghostFrames: [],
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
        dna:            settings.starterDna.map(v =>
            Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1))
        ),
        stats:          emptyStats(),
        dodgeSide:      1,
        dodgeSideTimer: 0,
    },
});

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?: number;
}

export const ShooterCanvas = ({ scale = 1 }: ShooterCanvasProps) => {
    const { eaSettings, shooterSettings } = useSettings();

    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState | null>(null);
    const inputRef     = useInput();
    const [phase, setPhase] = useState<GamePhase>('idle');

    // Lazy initialisieren – erst wenn shooterSettings verfügbar
    if (!gameStateRef.current) {
        const state = makeInitialGameState(shooterSettings);
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

        const population = currentState.population ?? initPopulation();

        const evolvedPopulation = currentState.roundNumber > 0
            ? (() => {
                const ghost: PlayerGhost = {
                    frames:        currentState.ghostFrames,
                    roundDuration: shooterSettings.roundDuration,
                };
                return currentState.ghostFrames.length > 0
                    ? presimulateAgainstGhost(eaSettings.presimGenerations, ghost)
                    : evolve(
                        population,
                        calculateFitness(currentState.agent.stats),
                        eaSettings.mutationRate,
                        eaSettings.mutationStrength,
                    );
            })()
            : population;

        const nextDna = getNextAgent(evolvedPopulation, nextRound);

        const newState: GameState = {
            ...makeInitialGameState(shooterSettings),
            phase:       'playing',
            roundNumber: nextRound,
            population:  evolvedPopulation,
            ghostFrames: [],
            agent: {
                ...makeInitialGameState(shooterSettings).agent,
                dna: nextDna,
            },
        };

        gameStateRef.current = newState;
        gameStore.state      = newState;
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
                        <button className={styles.startBtn} onClick={startRound}>
                            Nächste Runde →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};