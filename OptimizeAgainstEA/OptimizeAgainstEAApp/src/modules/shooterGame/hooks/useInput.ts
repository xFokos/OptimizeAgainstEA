import { useEffect, useRef } from 'react';
import type { InputState } from '../shooter.types';
import { ARENA } from '../shooter.types';

export const useInput = (): React.RefObject<InputState> => {
    const input = useRef<InputState>({
        up:     false,
        down:   false,
        left:   false,
        right:  false,
        shoot:  false,
        mouseX: 0,
        mouseY: 0,
    });

    useEffect(() => {
        // ---- Keyboard ----
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': e.preventDefault(); input.current.up    = true; break;
                case 'ArrowDown':  case 'KeyS': e.preventDefault(); input.current.down  = true; break;
                case 'ArrowLeft':  case 'KeyA': e.preventDefault(); input.current.left  = true; break;
                case 'ArrowRight': case 'KeyD': e.preventDefault(); input.current.right = true; break;
                case 'Space':                   e.preventDefault(); input.current.shoot = true; break;
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

        // ---- Maus ----
        const onMouseMove = (e: MouseEvent) => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            // Mausposition auf interne Canvas-Auflösung skalieren
            const scaleX = ARENA.WIDTH  / rect.width;
            const scaleY = ARENA.HEIGHT / rect.height;
            input.current.mouseX = (e.clientX - rect.left) * scaleX;
            input.current.mouseY = (e.clientY - rect.top)  * scaleY;
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button === 0) input.current.shoot = true; // Linksklick
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button === 0) input.current.shoot = false;
        };

        window.addEventListener('keydown',   onKeyDown);
        window.addEventListener('keyup',     onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup',   onMouseUp);

        return () => {
            window.removeEventListener('keydown',   onKeyDown);
            window.removeEventListener('keyup',     onKeyUp);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup',   onMouseUp);
        };
    }, []);

    return input;
};