import { useRef, useState } from 'react';

// How long a step must have been visible before the *next* one is allowed to
// show — without this, a step whose action a player does instantly (already
// moving, or a very short aim wiggle) flashes by before it can be read.
const MIN_STEP_MS = 3000;

/**
 * Drives an in-game tutorial's coachmark steps (move → aim → shoot → …),
 * shared by both ShooterCanvas's and HordeCanvas's practice-round tutorials.
 *
 * Per-frame condition checks call `request(next)` instead of advancing
 * directly — if the current step has been on screen for at least
 * MIN_STEP_MS it switches immediately, otherwise the request is queued and
 * `tick()` (call once per frame) commits it as soon as that minimum is up.
 * `advance(next)` bypasses the gate entirely, for a hard reset (e.g. the
 * round restarting) rather than a natural step transition.
 */
export function useTutorialStep<T extends string>(initial: T) {
    const stepRef    = useRef<T>(initial);
    const shownAtRef = useRef(0);
    const pendingRef = useRef<T | null>(null);
    const [step, setStep] = useState<T>(initial);
    const [bubbleClosed, setBubbleClosed] = useState(false);

    const advance = (next: T) => {
        stepRef.current    = next;
        shownAtRef.current = performance.now();
        pendingRef.current = null;
        setStep(next);
        setBubbleClosed(false);
    };

    const request = (next: T) => {
        if (stepRef.current === next || pendingRef.current === next) return;
        if (performance.now() - shownAtRef.current >= MIN_STEP_MS) advance(next);
        else pendingRef.current = next;
    };

    const tick = () => {
        if (pendingRef.current !== null && performance.now() - shownAtRef.current >= MIN_STEP_MS) {
            advance(pendingRef.current);
        }
    };

    return { stepRef, step, bubbleClosed, setBubbleClosed, advance, request, tick };
}
