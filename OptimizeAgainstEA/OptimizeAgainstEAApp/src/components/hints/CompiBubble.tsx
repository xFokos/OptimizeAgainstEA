import type { HintAction } from './HintContext';
import compiImg from '../../assets/CompiDerpy.webp';

interface CompiBubbleProps {
  title?: string;
  body: string;
  actions: HintAction[];
  onClose: () => void;
  /** When true, dims the screen and blocks interaction until dismissed. */
  blocking?: boolean;
}

/**
 * Compi — the website mascot (a derpy old CRT PC). Renders the hint as a
 * Clippy-style speech bubble fixed to the bottom-right, with Compi tucked into
 * the bubble's bottom-right corner and a tail pointing down toward him.
 *
 * Used for every hint when COMPI_MODE is on (see hintContent.ts).
 */
export function CompiBubble({ title, body, actions, onClose, blocking }: CompiBubbleProps) {
  const bubble = (
    <div className="compi" role="status">
      <div className="compi__bubble">
        <button className="compi__close" onClick={onClose} aria-label="Dismiss hint">×</button>
        {title && <div className="compi__title">{title}</div>}
        <div className="compi__body">{body}</div>
        {actions.length > 0 && (
          <div className="compi__actions">
            {actions.map((a, i) => (
              <button
                key={i}
                className={`btn btn--sm ${a.variant === 'primary' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <span className="compi__tail" />
      </div>
      <img className="compi__mascot" src={compiImg} alt="Compi the PC mascot" />
    </div>
  );

  if (blocking) {
    // Backdrop swallows clicks so the hint interrupts play until dismissed.
    return <div className="compi-backdrop" onClick={(e) => e.stopPropagation()}>{bubble}</div>;
  }
  return bubble;
}
