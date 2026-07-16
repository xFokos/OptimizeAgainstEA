import { useState } from 'react';
import type { HelpTopicId } from './helpContent';
import { HelpModal } from './HelpModal';
import compiImg from '../../assets/CompiDerpy.webp';

interface HelpButtonProps {
    topic:      HelpTopicId;
    label?:     string;
    className?: string;
    onTakeTour?: () => void;
    /** Durchgereicht an HelpModal — öffnet das technische Tutorial des Modus. */
    onOpenTutorial?: () => void;
}

/** Drop-in "explain this" button — Compi peeks out of the corner offering help; opens the general overview modal for `topic`. */
export function HelpButton({ topic, label = 'How does it work?', className = 'btn btn--outline help-button', onTakeTour, onOpenTutorial }: HelpButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button className={className} onClick={() => setOpen(true)}>
                <img className="help-button__mascot" src={compiImg} alt="" />
                <span className="help-button__label">{label}</span>
            </button>
            {open && (
                <HelpModal
                    topic={topic}
                    onClose={() => setOpen(false)}
                    onTakeTour={onTakeTour}
                    onOpenTutorial={onOpenTutorial}
                />
            )}
        </>
    );
}
