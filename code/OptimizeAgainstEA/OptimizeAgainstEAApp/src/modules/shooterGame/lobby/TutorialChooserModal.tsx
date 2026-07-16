import { useEffect, type CSSProperties } from 'react';
import compiImg from '../../../assets/CompiDerpy.webp';
import '../../../components/help/help.css';

// Auswahlfenster für den Tutorial-Button, sobald das Tutorial einmal komplett
// durchlaufen wurde (TUTORIAL_COMPLETED_KEY) — statt Neulinge erneut durch den
// vollen Durchlauf zu schicken, springt man gezielt in einen der beiden Teile.
// Chrome bewusst identisch zum HelpModal (.overlay/.modal + help-modal-Klassen,
// Compi links), damit es als dasselbe Hilfe-System liest, nicht als neues UI.
// Bewusst textarm: nur zwei gleichwertige Buttons, keine Beschreibungen.

const optionBtn: CSSProperties = {
    flex:     1,
    padding:  '16px 22px',
    fontSize: 16,
};

interface TutorialChooserModalProps {
    onPractice:  () => void;
    onExplainer: () => void;
    onClose:     () => void;
    /** Modus-Akzentfarbe für die Buttons (Horde orange, Raidboss lila) —
     * ohne bleibt es beim Standard-Akzent der Solo-Lobby. */
    accent?:     string;
}

export function TutorialChooserModal({ onPractice, onExplainer, onClose, accent }: TutorialChooserModalProps) {
    const btnStyle: CSSProperties = accent
        ? { ...optionBtn, '--btn-color': accent } as CSSProperties
        : optionBtn;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="overlay" onClick={onClose}>
            {/* Bewusst 1:1 die HelpModal-Struktur (Compi links, Titel-Header,
              * darunter eine Button-Reihe wie dessen Tab-Zeile), nur eben mit
              * den zwei Tutorial-Zielen statt Tabs. */}
            <div className="modal help-modal help-modal--chooser" onClick={e => e.stopPropagation()}>
                <button className="help-modal__close" onClick={onClose} aria-label="Close">×</button>
                <img className="help-modal__compi" src={compiImg} alt="" />

                <div className="help-modal__content">
                    <div className="help-modal__header">
                        <h2 className="help-modal__title">Tutorial</h2>
                    </div>
                    <div className="help-modal__tabs">
                        <button className="btn btn--outline" style={btnStyle} onClick={onPractice}>
                            Gameplay
                        </button>
                        <button className="btn btn--outline" style={btnStyle} onClick={onExplainer}>
                            Technical
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
