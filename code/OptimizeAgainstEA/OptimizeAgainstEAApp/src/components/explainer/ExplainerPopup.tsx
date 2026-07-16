import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExplainerFlow } from './ExplainerFlow';
import type { ExplainerStep } from './ExplainerFlow';

// On-Demand-Wiederverwendung einzelner Tutorial-Steps: ein "?"-Button neben
// einer Einstellung/Sektion öffnet die passenden Steps (inkl. ihrer
// Arena-Animationen) als Fullscreen-Takeover — dieselbe Optik wie die
// Tutorials selbst, nur eben nur der relevante Ausschnitt.
//
// Die Step-Bundles pro Thema definieren die Content-Dateien der Spiele
// (z.B. tutorialEvolutionContent.tsx exportiert SoloDnaExplainerHint) —
// hier liegt nur der generische Button + Popup-Host.

interface ExplainerPopupProps {
    steps:   ExplainerStep[];
    onClose: () => void;
}

export function ExplainerPopup({ steps, onClose }: ExplainerPopupProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Bewusst KEIN Fullscreen-Takeover wie die Tutorials: ein Hint soll sich
    // wie ein Dialog anfühlen — Hintergrund nur leicht verdunkelt, Klick
    // daneben schließt. Portal trotzdem nötig: Lobby-Wrapper haben `zoom`.
    // Der Dialog gibt dem ExplainerFlow die feste Höhe + position:relative,
    // die er als Ancestor braucht (Compi ankert an dessen Unterkante).
    return createPortal(
        <div className="overlay explainer-popup__overlay" onClick={onClose}>
            <div className="explainer-popup" onClick={e => e.stopPropagation()}>
                <button className="explainer-popup__close" onClick={onClose} aria-label="Close">×</button>
                <ExplainerFlow steps={steps} onFinish={onClose} finishLabel="Got it" compact />
            </div>
        </div>,
        document.body,
    );
}

interface ExplainerHintButtonProps {
    steps: ExplainerStep[];
    /** Tooltip/aria-Beschreibung des Buttons. */
    label?: string;
}

/** Kleiner runder "?"-Button, der die übergebenen Steps als Popup öffnet. */
export function ExplainerHintButton({ steps, label = 'How does this work?' }: ExplainerHintButtonProps) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="explainer-hint-btn"
                onClick={() => setOpen(true)}
                aria-label={label}
                title={label}
            >
                ?
            </button>
            {open && <ExplainerPopup steps={steps} onClose={() => setOpen(false)} />}
        </>
    );
}
