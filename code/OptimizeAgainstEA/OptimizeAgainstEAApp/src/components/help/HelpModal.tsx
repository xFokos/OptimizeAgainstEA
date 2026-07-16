import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { HelpTopicId } from './helpContent';
import { HELP_TOPICS } from './helpContent';
import compiImg from '../../assets/CompiDerpy.webp';

interface HelpModalProps {
    topic:      HelpTopicId;
    onClose:    () => void;
    onTakeTour?: () => void;
    /** Opens the mode's technical tutorial (its ExplainerFlow). The modal only
     * gives the general picture — this is where the EA itself gets explained. */
    onOpenTutorial?: () => void;
}

export function HelpModal({ topic, onClose, onTakeTour, onOpenTutorial }: HelpModalProps) {
    const def = HELP_TOPICS[topic];
    const Content = def.Content;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Portalled to document.body so the fixed .overlay always resolves against
    // the viewport — when opened from the mobile help drawer (MobileHelpBar),
    // that drawer's slide `transform` would otherwise become the containing
    // block and trap/offset the modal inside the (sliding) panel.
    return createPortal(
        <div className="overlay" onClick={onClose}>
            <div className="modal modal--wide help-modal" onClick={e => e.stopPropagation()}>
                <button className="help-modal__close" onClick={onClose} aria-label="Close">×</button>
                <img className="help-modal__compi" src={compiImg} alt="" />

                <div className="help-modal__content">
                    <div className="help-modal__header">
                        <h2 className="help-modal__title">{def.title}</h2>
                    </div>

                    {/* Weiterführendes, kein Tab-Umschalter: das Fenster hat nur noch
                        eine Ansicht. Das Tutorial steht vorne (dort geht es weiter,
                        wenn der Überblick nicht reicht), die Tour rechts abgesetzt. */}
                    {(onOpenTutorial || onTakeTour) && (
                        <div className="help-modal__actions">
                            {onOpenTutorial && (
                                <button
                                    className="btn btn--outline btn--sm"
                                    onClick={() => { onClose(); onOpenTutorial(); }}
                                >
                                    🔧 Technical Tutorial
                                </button>
                            )}
                            {onTakeTour && (
                                <button
                                    className="btn btn--ghost btn--sm"
                                    style={{ marginLeft: 'auto' }}
                                    onClick={() => { onClose(); onTakeTour(); }}
                                >
                                    🧭 Take the Tour
                                </button>
                            )}
                        </div>
                    )}

                    <div className="help-modal__body">
                        <Content />
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
