import { useState } from 'react';
import type { HelpTopicId } from './helpContent';
import { HelpModal } from './HelpModal';
import compiImg from '../../assets/CompiDerpy.webp';

interface HelpButtonProps {
    topic:     HelpTopicId;
    label?:    string;
    className?: string;
}

/** Drop-in "explain this" button — Compi peeks out of the corner offering help; opens a tabbed Gameplay / Under the Hood modal for `topic`. */
export function HelpButton({ topic, label = 'How does it work?', className = 'btn btn--outline help-button' }: HelpButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button className={className} onClick={() => setOpen(true)}>
                <img className="help-button__mascot" src={compiImg} alt="" />
                <span className="help-button__label">{label}</span>
            </button>
            {open && <HelpModal topic={topic} onClose={() => setOpen(false)} />}
        </>
    );
}
