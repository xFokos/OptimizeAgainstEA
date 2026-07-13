import { useEffect, useState } from 'react';
import type { HelpTopicId } from './helpContent';
import { HELP_TOPICS } from './helpContent';
import compiImg from '../../assets/CompiDerpy.webp';

type HelpTab = 'gameplay' | 'technical';

interface HelpModalProps {
    topic:      HelpTopicId;
    onClose:    () => void;
    onTakeTour?: () => void;
}

export function HelpModal({ topic, onClose, onTakeTour }: HelpModalProps) {
    const def = HELP_TOPICS[topic];
    const [tab, setTab] = useState<HelpTab>('gameplay');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const Content = tab === 'gameplay' ? def.Gameplay : def.Technical;

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal modal--wide help-modal" onClick={e => e.stopPropagation()}>
                <button className="help-modal__close" onClick={onClose} aria-label="Close">×</button>
                <img className="help-modal__compi" src={compiImg} alt="" />

                <div className="help-modal__content">
                    <div className="help-modal__header">
                        <h2 className="help-modal__title">{def.title}</h2>
                    </div>

                    <div className="help-modal__tabs">
                        <button
                            className={`btn btn--sm ${tab === 'gameplay' ? 'btn--outline' : 'btn--ghost'}`}
                            onClick={() => setTab('gameplay')}
                        >
                            How to Play
                        </button>
                        <button
                            className={`btn btn--sm ${tab === 'technical' ? 'btn--outline' : 'btn--ghost'}`}
                            onClick={() => setTab('technical')}
                        >
                            Under the Hood
                        </button>
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

                    <div className="help-modal__body">
                        <Content />
                    </div>
                </div>
            </div>
        </div>
    );
}
