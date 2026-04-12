import { useEffect, useRef } from 'react';
import type {InputState} from '../shooter.types';

// useRef statt useState – kein Re-render bei jedem Tastendruck
export const useKeyboard = (): React.RefObject<InputState> => {
    const input = useRef<InputState>({
        up:    false,
        down:  false,
        left:  false,
        right: false,
        shoot: false,
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // preventDefault verhindert z.B. Scrollen mit Pfeiltasten
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    e.preventDefault();
                    input.current.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    e.preventDefault();
                    input.current.down = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    e.preventDefault();
                    input.current.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    e.preventDefault();
                    input.current.right = true;
                    break;
                case 'Space':
                    e.preventDefault();
                    input.current.shoot = true;
                    break;
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': input.current.up    = false; break;
                case 'ArrowDown':  case 'KeyS': input.current.down  = false; break;
                case 'ArrowLeft':  case 'KeyA': input.current.left  = false; break;
                case 'ArrowRight': case 'KeyD': input.current.right = false; break;
                case 'Space':                   input.current.shoot = false; break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup',   onKeyUp);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup',   onKeyUp);
        };
    }, []); // Leeres Array = nur einmal beim Mount registrieren

    return input;
};