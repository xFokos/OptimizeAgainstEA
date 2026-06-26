import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { HintId } from './hintContent';
import { HINTS, COMPI_MODE } from './hintContent';
import { useHints, fillTemplate } from './HintContext';
import type { HintAction } from './HintContext';
import { CompiBubble } from './CompiBubble';

type Placement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'left' | 'right';

interface HintPopoverProps {
  /** Which hint (from hintContent.ts) to show. */
  id: HintId;
  /** The element to anchor the popover to — pass the button/control as a child. */
  children: ReactNode;
  /** Side of the anchor the bubble appears on. Default 'right'. */
  placement?: Placement;
  /** Extra condition for showing (on top of enabled / once-seen). Default true. */
  show?: boolean;
  /** Fills {placeholders} in the hint body. */
  vars?: Record<string, string>;
  /** Contextual buttons. Falls back to a single "Got it" button. */
  actions?: HintAction[];
  /** If set, the bubble auto-dismisses itself after this many ms (like a toast). */
  dismissAfter?: number;
}

/**
 * An anchored, non-blocking hint bubble positioned next to whatever element
 * you wrap. Wording still comes from hintContent.ts; positioning is pure CSS
 * relative to the anchor, so it tracks the element on layout changes.
 *
 * When COMPI_MODE is on, the hint instead speaks through Compi (a fixed
 * bottom-right speech bubble) rather than pinning to the wrapped element.
 *
 *   <HintPopover id="vsEa.replayButton" placement="top" show={canReplay}>
 *     <button>▶ Watch Last Replay</button>
 *   </HintPopover>
 */
export function HintPopover({
  id, children, placement = 'right', show = true, vars, actions, dismissAfter,
}: HintPopoverProps) {
  const { enabled, isSeen, markSeen } = useHints();
  const [dismissed, setDismissed] = useState(false);
  const def = HINTS[id];

  const visible =
    enabled && show && !dismissed && !!def && !(def.once && isSeen(id));

  const close = () => {
    if (def?.once) markSeen(id);
    setDismissed(true);
  };

  // Optional toast-like self-dismiss once the bubble is actually on screen.
  useEffect(() => {
    if (!visible || !dismissAfter) return;
    const t = setTimeout(() => {
      if (def?.once) markSeen(id);
      setDismissed(true);
    }, dismissAfter);
    return () => clearTimeout(t);
  }, [visible, dismissAfter, def, id, markSeen]);

  const resolvedActions: HintAction[] = actions ?? [
    { label: 'Got it', onClick: close, variant: 'primary' },
  ];

  // ── Compi presentation: a fixed bottom-right mascot bubble ────────────────
  if (COMPI_MODE) {
    return (
      <>
        {children}
        {visible && def && (
          <CompiBubble
            title={def.title}
            body={fillTemplate(def.body, vars)}
            actions={resolvedActions}
            onClose={close}
          />
        )}
      </>
    );
  }

  // ── Plain presentation: a popover pinned to the wrapped element ────────────
  return (
    <span className="hint-anchor">
      {children}
      {visible && def && (
        <span className={`hint-popover hint-popover--${placement}`} role="status">
          {def.title && <span className="hint-popover__title">💡 {def.title}</span>}
          <span className="hint-popover__body">{fillTemplate(def.body, vars)}</span>
          <span className="hint-popover__actions">
            {resolvedActions.map((a, i) => (
              <button
                key={i}
                className={`btn btn--sm ${a.variant === 'primary' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </span>
          <button className="hint-popover__close" onClick={close} aria-label="Dismiss hint">×</button>
        </span>
      )}
    </span>
  );
}
