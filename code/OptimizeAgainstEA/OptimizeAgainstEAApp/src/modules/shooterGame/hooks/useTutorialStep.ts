import { useCallback, useRef, useState } from 'react';

// Kurze Übungs-Gnadenfrist nach dem Schließen eines Coachmarks: erst nach
// dieser Zeit darf die nächste Aktion den Schritt weiterschalten — sonst
// springt schon die kleinste Bewegung sofort zum nächsten Hinweis, ohne dass
// der Spieler die aktuelle Aktion in Ruhe ausprobieren konnte.
const STEP_GRACE_MS = 1700;

/**
 * Drives an in-game tutorial's coachmark steps (move → aim → shoot → …),
 * shared by both ShooterCanvas's and HordeCanvas's practice-round tutorials.
 *
 * Model: while a step's bubble is open the round is frozen. The canvas
 * computes its own pause condition (it may involve more than `bubbleClosed`,
 * e.g. the score coachmark) and mirrors it in via `setPaused` — the game
 * loops read only `pausedRef`, plain state would be stale there.
 *
 * `advance(next)` switches steps AND locks detection until `dismiss()` is
 * called: it sets the unpause timestamp to Infinity synchronously (via ref),
 * because the mirrored pause flag only lands a frame later — in that gap the
 * new step's detection would already run (twin-stick: aim stick still held →
 * the step would be skipped instantly). `dismiss()` stamps the time and
 * un-pauses; `graceOver()` then stays false for STEP_GRACE_MS so the very
 * first twitch of input doesn't immediately complete the new step.
 */
export function useTutorialStep<T extends string>(initial: T) {
    const stepRef       = useRef<T>(initial);
    const unpausedAtRef = useRef(0);
    const pausedRef     = useRef(false);
    const [step, setStep] = useState<T>(initial);
    const [bubbleClosed, setBubbleClosed] = useState(false);

    const advance = useCallback((next: T) => {
        unpausedAtRef.current = Number.POSITIVE_INFINITY;
        stepRef.current       = next;
        setStep(next);
        setBubbleClosed(false);
    }, []);

    const dismiss = useCallback(() => {
        unpausedAtRef.current = performance.now();
        setBubbleClosed(true);
    }, []);

    const graceOver = useCallback(
        () => performance.now() - unpausedAtRef.current >= STEP_GRACE_MS,
        [],
    );

    const setPaused = useCallback((paused: boolean) => {
        pausedRef.current = paused;
    }, []);

    return { stepRef, step, bubbleClosed, setBubbleClosed, advance, dismiss, graceOver, pausedRef, setPaused };
}
