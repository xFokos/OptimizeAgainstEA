import { useEffect, useRef } from 'react';
import type { GameState, InputState } from '../shooter.types.ts';

interface UseGameLoopProps {
    gameState:  React.RefObject<GameState>;
    inputState: React.RefObject<InputState>;
    onUpdate:   (state: GameState, dt: number, input: InputState) => GameState;
    onRender:   (state: GameState) => void;
    isRunning:  boolean;
}

export const useGameLoop = ({
                                gameState,
                                inputState,
                                onUpdate,
                                onRender,
                                isRunning,
                            }: UseGameLoopProps) => {
    const lastTimeRef  = useRef<number>(0);
    const animFrameRef = useRef<number>(0);

    useEffect(() => {
        if (!isRunning) return;

        const loop = (timestamp: number) => {
            // dt = delta time in Sekunden (Zeit seit letztem Frame)
            // Wir cappen bei 100ms damit Lag-Spikes die Physik nicht brechen
            const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
            lastTimeRef.current = timestamp;

            // Update gibt einen neuen State zurück (pure function)
            if (gameState.current && inputState.current) {
                gameState.current = onUpdate(gameState.current, dt, inputState.current);
                onRender(gameState.current);
            }

            animFrameRef.current = requestAnimationFrame(loop);
        };

        // Ersten Frame starten
        lastTimeRef.current = performance.now();
        animFrameRef.current = requestAnimationFrame(loop);

        // Cleanup wenn Komponente unmountet oder isRunning false wird
        return () => {
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [isRunning, onUpdate, onRender]);
};