import { useState } from 'react';
import type { HelpTopicId } from './helpContent';
import { HelpButton } from './HelpButton';

interface MobileHelpBarProps {
    topic:       HelpTopicId;
    onTakeTour?: () => void;
}

/**
 * Mobile-only home for the chunky "How does it work?" button. That button is
 * tall (Compi pokes out top and bottom) and eats a lot of the phone button
 * row — so on mobile it lives inside a left-sliding drawer instead, opened by
 * a slim pull-tab on the screen's left edge. Same drawer pattern as the
 * Dashboard's navigation sidebar (see dashboard.css). The lobbies mount this
 * only in their `isMobile` branch; the desktop layout keeps the inline button.
 */
export function MobileHelpBar({ topic, onTakeTour }: MobileHelpBarProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                className="help-bar-tab"
                onClick={() => setOpen(true)}
                aria-label="Open help"
            >
                <span className="help-bar-tab__icon">?</span>
                <span className="help-bar-tab__text">Help</span>
            </button>

            {open && <div className="help-bar-backdrop" onClick={() => setOpen(false)} />}

            <aside className={`help-bar${open ? ' open' : ''}`}>
                <div className="help-bar__head">
                    <span className="help-bar__title">Learn</span>
                    <button className="help-bar__close" onClick={() => setOpen(false)} aria-label="Close help">✕</button>
                </div>
                {/* Tapping the help button opens its own modal on top — close the
                    drawer at the same time so closing the modal lands back in the
                    lobby, not on a stale open drawer. */}
                <div onClick={() => setOpen(false)}>
                    <HelpButton topic={topic} onTakeTour={onTakeTour} />
                </div>
            </aside>
        </>
    );
}
