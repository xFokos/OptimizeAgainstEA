import { useEffect, useRef } from 'react';
import type { InputState } from '../shooter.types';
import { ARENA } from '../shooter.types';

export interface TouchVisualState {
    joystick: { originX: number; originY: number; dx: number; dy: number } | null;
    aimX:     number | null;
    aimY:     number | null;
}

const JOYSTICK_RADIUS = 55;
const DEADZONE        = 12;

export function useTouchControls(
    inputRef:  React.RefObject<InputState>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
): React.RefObject<TouchVisualState> {
    const visualRef = useRef<TouchVisualState>({ joystick: null, aimX: null, aimY: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const toCanvas = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (clientX - rect.left) * (ARENA.WIDTH  / rect.width),
                y: (clientY - rect.top)  * (ARENA.HEIGHT / rect.height),
            };
        };

        let leftId  = -1, rightId = -1;
        let originX = 0,  originY = 0;

        const applyJoystick = (cx: number, cy: number) => {
            const rawDx = cx - originX;
            const rawDy = cy - originY;
            const len   = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
            const c     = Math.min(len, JOYSTICK_RADIUS);
            const ndx   = len > 0 ? rawDx / len : 0;
            const ndy   = len > 0 ? rawDy / len : 0;

            visualRef.current.joystick = { originX, originY, dx: ndx * c, dy: ndy * c };
            inputRef.current.left  = rawDx < -DEADZONE;
            inputRef.current.right = rawDx >  DEADZONE;
            inputRef.current.up    = rawDy < -DEADZONE;
            inputRef.current.down  = rawDy >  DEADZONE;
        };

        const applyAim = (cx: number, cy: number) => {
            visualRef.current.aimX  = cx;
            visualRef.current.aimY  = cy;
            inputRef.current.mouseX = cx;
            inputRef.current.mouseY = cy;
            inputRef.current.shoot  = true;
        };

        const clearLeft = () => {
            leftId = -1;
            visualRef.current.joystick = null;
            inputRef.current.left  = false;
            inputRef.current.right = false;
            inputRef.current.up    = false;
            inputRef.current.down  = false;
        };

        const clearRight = () => {
            rightId = -1;
            visualRef.current.aimX = null;
            visualRef.current.aimY = null;
            inputRef.current.shoot = false;
        };

        const onStart = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                const pos = toCanvas(t.clientX, t.clientY);
                if (pos.x < ARENA.WIDTH / 2 && leftId === -1) {
                    leftId  = t.identifier;
                    originX = pos.x;
                    originY = pos.y;
                    applyJoystick(pos.x, pos.y);
                } else if (pos.x >= ARENA.WIDTH / 2 && rightId === -1) {
                    rightId = t.identifier;
                    applyAim(pos.x, pos.y);
                }
            }
        };

        const onMove = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                const pos = toCanvas(t.clientX, t.clientY);
                if (t.identifier === leftId)  applyJoystick(pos.x, pos.y);
                if (t.identifier === rightId) applyAim(pos.x, pos.y);
            }
        };

        const onEnd = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === leftId)  clearLeft();
                if (t.identifier === rightId) clearRight();
            }
        };

        canvas.addEventListener('touchstart',  onStart, { passive: false });
        canvas.addEventListener('touchmove',   onMove,  { passive: false });
        canvas.addEventListener('touchend',    onEnd,   { passive: false });
        canvas.addEventListener('touchcancel', onEnd,   { passive: false });

        return () => {
            canvas.removeEventListener('touchstart',  onStart);
            canvas.removeEventListener('touchmove',   onMove);
            canvas.removeEventListener('touchend',    onEnd);
            canvas.removeEventListener('touchcancel', onEnd);
        };
    }, [canvasRef, inputRef]);

    return visualRef;
}
