import { useRef, useCallback, useState } from 'react';
import { ARENA, GAME_CONFIG, DNA_LENGTH, emptyStats , type GameState, type GamePhase, type InputState} from '../shooter.types';
import { useKeyboard }  from '../hooks/useKeyboard';
import { useGameLoop }  from '../hooks/useGameLoop';
import { update }       from '../game/core/gameLoop';
import { renderer }     from '../game/core/renderer';
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
});

export const gameStore = {
    state: initialGameState(),
};

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?: number;
}

export const ShooterCanvas = ({ scale = 1 }: ShooterCanvasProps) =>  {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>(initialGameState());
    const inputRef    = useKeyboard();
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
        gameStateRef.current = {
            ...initialGameState(),
            phase:       'playing',
            roundNumber: gameStateRef.current.roundNumber,
            population:  gameStateRef.current.population,
            // DNA vom letzten Agenten übernehmen (wird später von GA befüllt)
            agent: {
                ...initialGameState().agent,
                dna: gameStateRef.current.agent.dna,
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