import { useState } from 'react';
import type { ReactNode } from 'react';
import type { HintId } from './hintContent';
import { HINTS } from './hintContent';
import { useHints, fillTemplate } from './HintContext';
import type { HintAction } from './HintContext';

type Placement = 'top' | 'bottom' | 'left' | 'right';

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
}

/**
 * An anchored, non-blocking hint bubble positioned next to whatever element
 * you wrap. Wording still comes from hintContent.ts; positioning is pure CSS
 * relative to the anchor, so it tracks the element on layout changes.
 *
 *   <HintPopover id="vsEa.replayButton" placement="top" show={canReplay}>
 *     <button>▶ Watch Last Replay</button>
 *   </HintPopover>
 */
export function HintPopover({
  id, children, placement = 'right', show = true, vars, actions,
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

  const resolvedActions: HintAction[] = actions ?? [
    { label: 'Got it', onClick: close, variant: 'primary' },
  ];

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
