import { useEffect } from 'react';
import { useHints } from './HintContext';
import type { HintAction } from './HintContext';

/** How long a non-blocking toast stays on screen before auto-dismissing. */
const TOAST_DURATION = 7000;

/**
 * Renders the currently active hint as either a blocking modal or a corner
 * toast. Mount this once near the page root, inside <HintsProvider>.
 */
export function HintLayer() {
  const { active, dismiss } = useHints();

  useEffect(() => {
    if (!active || active.style !== 'toast' || active.sticky) return;
    const t = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [active, dismiss]);

  if (!active) return null;

  if (active.style === 'toast') {
    return (
      <div className="hint-toast" role="status">
        {active.title && <div className="hint-toast__title">💡 {active.title}</div>}
        <div className="hint-toast__body">{active.body}</div>
        <button className="hint-toast__close" onClick={dismiss} aria-label="Dismiss hint">×</button>
      </div>
    );
  }

  const actions: HintAction[] = active.actions.length > 0
    ? active.actions
    : [{ label: 'Got it', onClick: dismiss, variant: 'primary' }];

  return (
    <div className="modal-backdrop hint-modal-backdrop" onClick={active.pauses ? undefined : dismiss}>
      <div className="modal hint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hint-modal__tag">💡 Hint</div>
        {active.title && <h2 className="hint-modal__title">{active.title}</h2>}
        <p className="hint-modal__body">{active.body}</p>
        <div className="modal__actions">
          {actions.map((a, i) => (
            <button
              key={i}
              className={`btn ${a.variant === 'primary' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
