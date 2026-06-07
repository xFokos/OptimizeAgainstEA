import { useRef, useCallback, useState } from 'react';
import { ARENA, GAME_CONFIG, DNA_LENGTH, emptyStats , type GameState, type GamePhase, type InputState} from '../shooter.types';
import { evolve, getNextAgent, presimulateAgainstGhost } from '../game/ga/evolution';
import { initPopulation } from '../game/ga/population';
import type { PlayerGhost } from '../shooter.types';
import { useInput }  from '../hooks/useInput';
import { useGameLoop }  from '../hooks/useGameLoop';
import { update }       from '../game/core/gameLoop';
import { renderer }     from '../game/core/renderer';
import { calculateFitness } from '../game/ga/fitness';
import { gameStore } from '../game/gameStore';
import styles           from './ShooterCanvas.module.css';



// ---- Hilfsfunktionen ----

const randomDNA = (): number[] =>
    Array.from({ length: DNA_LENGTH }, () => Math.random());

const initialGameState = (): GameState => ({
    phase:       'idle',
    roundTimer:  GAME_CONFIG.ROUND_DURATION,
    roundNumber: 1,
    bullets:     [],
    population:  null,
    player: {
        id:       'player',
        position: { x: 200, y: ARENA.HEIGHT / 2 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius:   GAME_CONFIG.PLAYER_RADIUS,
        health:   100,
    },
    agent: {
        id:       'agent',
        position: { x: ARENA.WIDTH - 200, y: ARENA.HEIGHT / 2 },
        velocity: { x: 0, y: 0 },
        rotation: Math.PI, // schaut nach links
        radius:   GAME_CONFIG.AGENT_RADIUS,
        health:   100,
        dna:      randomDNA(),
        stats:    emptyStats(),
        dodgeSide:      1,
        dodgeSideTimer: 0,
    },
    ghostFrames: [],
});

gameStore.state = initialGameState();
// ---- Komponente ----

interface ShooterCanvasProps {
    scale?: number;
}

export const ShooterCanvas = ({ scale = 1 }: ShooterCanvasProps) =>  {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>(initialGameState());
    const inputRef    = useInput();
    const [phase, setPhase] = useState<GamePhase>('idle');


    // onUpdate: Spiellogik – gibt neuen State zurück
    const onUpdate = useCallback((
        state: GameState,
        dt: number,
        input: InputState,
    ): GameState => {
        const next = update(state, dt, input);

        // Phasen-Wechsel an React melden (für UI-Updates)
        if (next.phase !== state.phase) {
            setPhase(next.phase);
        }

        //Export GameState
        gameStore.state = next;


        return next;
    }, []);

    // onRender: Canvas zeichnen
    const onRender = useCallback((state: GameState) => {
        renderer.render(canvasRef.current, state);
    }, []);

    useGameLoop({
        gameState:  gameStateRef,
        inputState: inputRef,
        onUpdate,
        onRender,
        isRunning: phase === 'playing',
    });

    const startRound = () => {

        gameStore.state = gameStateRef.current;
        gameStore.notify();
        console.log('notify called, dna:', gameStateRef.current.agent.dna);

        const currentState = gameStateRef.current;


        const population = currentState.population ?? initPopulation();

        const evolvedPopulation = currentState.roundNumber > 1
            ? (() => {
                const ghost: PlayerGhost = {
                    frames:        currentState.ghostFrames,
                    roundDuration: GAME_CONFIG.ROUND_DURATION,
                };
                return currentState.ghostFrames.length > 0
                    ? presimulateAgainstGhost(3, ghost)
                    : evolve(population, calculateFitness(currentState.agent.stats));
            })()
            : population;

        // Nächste DNA holen
        const nextDna = getNextAgent(evolvedPopulation, currentState.roundNumber);

        gameStateRef.current = {
            ...initialGameState(),
            phase:       'playing',
            roundNumber: currentState.roundNumber + 1,
            population:  evolvedPopulation,
            agent: {
                ...initialGameState().agent,
                dna: nextDna,
            },
        };
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
                width={ARENA.WIDTH}   // immer fix – nie skalieren!
                height={ARENA.HEIGHT} // immer fix – nie skalieren!
                className={styles.canvas}
            />

            {phase === 'idle' && (
                <div className={styles.overlay}>
                    <h2 className={styles.title}>Shooter vs GA</h2>
                    <p className={styles.subtitle}>WASD bewegen · Leertaste schießen</p>
                    <button className={styles.startBtn} onClick={startRound}>
                        Runde starten
                    </button>
                </div>
            )}

            {phase === 'roundEnd' && (
                <div className={styles.overlay}>
                    <h2 className={styles.title}>Runde beendet</h2>
                    <div className={styles.stats}>
                        <span>Treffer gelandet: {gameStateRef.current.agent.stats.hitsLanded}</span>
                        <span>Selbst getroffen: {gameStateRef.current.agent.stats.hitsReceived}</span>
                        <span>Ausgewichen: {gameStateRef.current.agent.stats.dodgedBullets}</span>
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