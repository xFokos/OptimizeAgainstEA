import { useEffect } from 'react';
import { useHints } from './HintContext';
import type { HintAction } from './HintContext';
import { COMPI_MODE } from './hintContent';
import { CompiBubble } from './CompiBubble';

/** How long a non-blocking toast stays on screen before auto-dismissing. */
const TOAST_DURATION = 7000;

/**
 * Renders the currently active hint. When COMPI_MODE is on, every hint speaks
 * through Compi (bottom-right speech bubble); otherwise hints render as a
 * blocking modal or a corner toast. Mount once near the page root, inside
 * <HintsProvider>.
 */
export function HintLayer() {
  const { active, dismiss } = useHints();

  // Toasts auto-dismiss (unless sticky). In Compi mode, the same applies to
  // non-blocking toast-style hints so they don't pile up.
  useEffect(() => {
    if (!active || active.style !== 'toast' || active.sticky) return;
    const t = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [active, dismiss]);

  if (!active) return null;

  const actions: HintAction[] = active.actions.length > 0
    ? active.actions
    : [{ label: 'Got it', onClick: dismiss, variant: 'primary' }];

  // ── Compi presentation: one consistent mascot bubble for every hint ───────
  if (COMPI_MODE) {
    // Modals block (dim backdrop); toasts float free and rely on auto-dismiss.
    const blocking = active.style === 'modal';
    return (
      <CompiBubble
        title={active.title}
        body={active.body}
        actions={active.style === 'toast' && active.actions.length === 0 ? [] : actions}
        onClose={dismiss}
        blocking={blocking}
        position={active.position}
      />
    );
  }

  // ── Plain presentation (original behaviour) ───────────────────────────────
  if (active.style === 'toast') {
    return (
      <div className="hint-toast" role="status">
        {active.title && <div className="hint-toast__title">💡 {active.title}</div>}
        <div className="hint-toast__body">{active.body}</div>
        <button className="hint-toast__close" onClick={dismiss} aria-label="Dismiss hint">×</button>
      </div>
    );
  }

  return (
    <div className="hint-modal-backdrop" onClick={active.pauses ? undefined : dismiss}>
      <div className="hint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hint-modal__tag">💡 Hint</div>
        {active.title && <h2 className="hint-modal__title">{active.title}</h2>}
        <p className="hint-modal__body">{active.body}</p>
        <div className="hint-modal__actions">
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
