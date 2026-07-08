import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import compiImg from '../../assets/CompiDerpy.webp';

// Mouse hover has to linger this long before the bubble appears, so it
// doesn't flash open every time the cursor merely passes over a label.
// Keyboard focus (a deliberate action) skips the delay — see onFocus below.
const HOVER_DELAY_MS = 1200;

interface CompiTooltipProps {
    /** Explanation text shown in the bubble. */
    text: ReactNode;
    /** The element that triggers the tooltip on hover/focus. */
    children: ReactNode;
    /** Which side of the trigger the bubble opens on. Default 'top'. */
    placement?: 'top' | 'bottom';
}

/**
 * Drop-in replacement for a native title="" tooltip — Compi peeks out of the
 * bubble's corner as if he's the one explaining it. Site-styled (accent
 * border, --bg-light chrome) instead of the browser's plain tooltip box.
 *
 * Rendered through a portal into document.body and positioned with
 * getBoundingClientRect() rather than CSS position:absolute — most call
 * sites live inside a scrolling tab panel (overflowY: auto), which would
 * otherwise clip the bubble whenever the trigger sits near the panel edge.
 *
 * Styling lives in styles/primitives/compiTooltip.css (loaded globally).
 */
export function CompiTooltip({ text, children, placement = 'top' }: CompiTooltipProps) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const showNow = () => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;
        setCoords({
            left: rect.left,
            top:  placement === 'top' ? rect.top - 12 : rect.bottom + 12,
        });
        setOpen(true);
    };

    // Hover has to linger — schedule instead of showing immediately.
    const handleMouseEnter = () => {
        clearTimer();
        timerRef.current = setTimeout(showNow, HOVER_DELAY_MS);
    };
    // Keyboard focus is a deliberate action, so it shows right away.
    const handleFocus = () => {
        clearTimer();
        showNow();
    };
    const hide = () => {
        clearTimer();
        setOpen(false);
    };

    useEffect(() => clearTimer, []);

    return (
        <>
            <span
                ref={anchorRef}
                className="compi-tip"
                tabIndex={0}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={hide}
                onFocus={handleFocus}
                onBlur={hide}
            >
                {children}
            </span>
            {open && coords && createPortal(
                <span
                    className={`compi-tip__pop compi-tip__pop--${placement}`}
                    style={{ top: coords.top, left: coords.left }}
                    role="tooltip"
                >
                    <span className="compi-tip__bubble">
                        {text}
                        <span className="compi-tip__tail" />
                    </span>
                    <img className="compi-tip__mascot" src={compiImg} alt="" />
                </span>,
                document.body,
            )}
        </>
    );
}
