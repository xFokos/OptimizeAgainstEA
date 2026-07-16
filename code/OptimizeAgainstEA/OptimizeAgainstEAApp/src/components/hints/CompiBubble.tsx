import type { HintAction } from './HintContext';
import type { CompiPosition } from './hintContent';
import type { FixedOffset } from './viewportFit';
import compiImg from '../../assets/CompiDerpy.webp';

interface CompiBubbleProps {
  title?: string;
  body: string;
  actions: HintAction[];
  /** Omit when there's no sensible "dismiss" action (e.g. a step embedded in
   * an ExplainerFlow, where Back/Next/Finish already cover navigation) — the
   * × button only renders when this is given. */
  onClose?: () => void;
  /** When true, dims the screen and blocks interaction until dismissed. */
  blocking?: boolean;
  /** Fixed screen corner for ambient hints (see HintLayer/hintContent's
   * per-hint `position`). Ignored if `offset` is given. Default 'bottom-right'. */
  position?: CompiPosition;
  /** Explicit, already-viewport-clamped pixel offset — used by HintPopover to
   * anchor near a specific control instead of a fixed screen corner. Overrides
   * `position` when given. */
  offset?: FixedOffset;
  /** Renders in normal document flow instead of floating fixed to a screen
   * corner — for embedding inside a caller's own centered layout (e.g. a
   * game overlay) so it can never overlap other content on that screen.
   * Overrides both `position` and `offset` when given. */
  inline?: boolean;
  /** Smaller bubble + mascot — for hosts much smaller than a full page (e.g.
   * an 800px game canvas), where the default site-wide size covers too much
   * of the action underneath it. Default false. */
  compact?: boolean;
}

/**
 * Compi — the website mascot (a derpy old CRT PC). Renders the hint as a
 * Clippy-style speech bubble, with Compi tucked into the bubble's bottom-right
 * corner and a tail pointing down toward him. Fixed to a screen corner by
 * default (`position`), or to an explicit clamped pixel offset (`offset`,
 * used by anchored hints) — either way it's positioned via plain CSS
 * top/left/bottom/right, so the bubble's own internal layout never changes.
 *
 * Used for every hint when COMPI_MODE is on (see hintContent.ts).
 */
export function CompiBubble({ title, body, actions, onClose, blocking, position = 'bottom-right', offset, inline, compact }: CompiBubbleProps) {
  const className = [
    'compi',
    inline ? 'compi--inline' : offset ? '' : `compi--${position}`,
    compact ? 'compi--compact' : '',
  ].filter(Boolean).join(' ');
  const style = (!inline && offset) ? { top: offset.top, bottom: offset.bottom, left: offset.left, right: offset.right } : undefined;

  const bubble = (
    <div className={className} style={style} role="status">
      <div className="compi__bubble">
        {onClose && <button className="compi__close" onClick={onClose} aria-label="Dismiss hint">×</button>}
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
