import { useEffect, useState } from 'react';
import type { HelpTopicId } from './helpContent';
import { HELP_TOPICS } from './helpContent';

type HelpTab = 'gameplay' | 'technical';

interface HelpModalProps {
    topic:   HelpTopicId;
    onClose: () => void;
}

export function HelpModal({ topic, onClose }: HelpModalProps) {
    const def = HELP_TOPICS[topic];
    const [tab, setTab] = useState<HelpTab>('gameplay');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const sections = tab === 'gameplay' ? def.gameplay : def.technical;

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal modal--wide help-modal" onClick={e => e.stopPropagation()}>
                <div className="help-modal__header">
                    <h2 className="help-modal__title">{def.title}</h2>
                    <button className="help-modal__close" onClick={onClose} aria-label="Close">×</button>
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
                </div>

                <div className="help-modal__body">
                    {sections.map(section => (
                        <div key={section.heading} className="help-modal__section">
                            <h3 className="help-modal__heading">{section.heading}</h3>
                            {section.body.map((p, i) => (
                                <p key={i} className="help-modal__paragraph">{p}</p>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
