import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { InputState } from '../shooter.types';

interface Props {
    inputRef: RefObject<InputState>;
}

const RADIUS  = 55;
const DEADZONE = 14;

export function MobileJoystickZone({ inputRef }: Props) {
    const zoneRef = useRef<HTMLDivElement>(null);
    const [joy, setJoy] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

    useEffect(() => {
        const el = zoneRef.current;
        if (!el) return;

        let touchId = -1, originX = 0, originY = 0;

        const update = (cx: number, cy: number) => {
            const rawDx = cx - originX;
            const rawDy = cy - originY;
            const len   = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
            const c     = Math.min(len, RADIUS);
            const dx    = len > 0 ? (rawDx / len) * c : 0;
            const dy    = len > 0 ? (rawDy / len) * c : 0;

            setJoy({ ox: originX, oy: originY, dx, dy });
            inputRef.current.left  = rawDx < -DEADZONE;
            inputRef.current.right = rawDx >  DEADZONE;
            inputRef.current.up    = rawDy < -DEADZONE;
            inputRef.current.down  = rawDy >  DEADZONE;
        };

        const onStart = (e: TouchEvent) => {
            e.preventDefault();
            if (touchId !== -1) return;
            const t    = e.changedTouches[0];
            touchId    = t.identifier;
            const rect = el.getBoundingClientRect();
            originX    = t.clientX - rect.left;
            originY    = t.clientY - rect.top;
            update(originX, originY);
        };

        const onMove = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier !== touchId) continue;
                const rect = el.getBoundingClientRect();
                update(t.clientX - rect.left, t.clientY - rect.top);
            }
        };

        const onEnd = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier !== touchId) continue;
                touchId = -1;
                setJoy(null);
                inputRef.current.left  = false;
                inputRef.current.right = false;
                inputRef.current.up    = false;
                inputRef.current.down  = false;
            }
        };

        el.addEventListener('touchstart',  onStart, { passive: false });
        el.addEventListener('touchmove',   onMove,  { passive: false });
        el.addEventListener('touchend',    onEnd,   { passive: false });
        el.addEventListener('touchcancel', onEnd,   { passive: false });

        return () => {
            el.removeEventListener('touchstart',  onStart);
            el.removeEventListener('touchmove',   onMove);
            el.removeEventListener('touchend',    onEnd);
            el.removeEventListener('touchcancel', onEnd);
        };
    }, [inputRef]);

    return (
        <div ref={zoneRef} style={styles.zone}>
            {!joy ? (
                <div style={styles.hint}>
                    <div style={styles.hintRing} />
                    <span style={styles.hintLabel}>BEWEGEN</span>
                </div>
            ) : (
                <>
                    <div style={{ ...styles.ring, left: joy.ox - RADIUS, top: joy.oy - RADIUS }} />
                    <div style={{ ...styles.innerRing, left: joy.ox - 20, top: joy.oy - 20 }} />
                    <div style={{ ...styles.knob, left: joy.ox + joy.dx - 22, top: joy.oy + joy.dy - 22 }} />
                </>
            )}
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    zone: {
        position:   'relative',
        width:      '100%',
        height:     '100%',
        overflow:   'hidden',
        touchAction: 'none',
        userSelect: 'none',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            8,
        pointerEvents:  'none',
    },
    hintRing: {
        width:        64,
        height:       64,
        borderRadius: '50%',
        border:       '2px solid rgba(255,255,255,0.15)',
    },
    hintLabel: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      10,
        letterSpacing: '0.1em',
        color:         'rgba(255,255,255,0.25)',
    },
    ring: {
        position:     'absolute',
        width:        RADIUS * 2,
        height:       RADIUS * 2,
        borderRadius: '50%',
        border:       '2px solid rgba(255,255,255,0.2)',
        pointerEvents: 'none',
    },
    innerRing: {
        position:     'absolute',
        width:        40,
        height:       40,
        borderRadius: '50%',
        border:       '1px solid rgba(255,255,255,0.1)',
        pointerEvents: 'none',
    },
    knob: {
        position:     'absolute',
        width:        44,
        height:       44,
        borderRadius: '50%',
        background:   'rgba(255,255,255,0.22)',
        border:       '2px solid rgba(255,255,255,0.5)',
        pointerEvents: 'none',
    },
};
