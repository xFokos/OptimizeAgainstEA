import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { HintId } from './hintContent';
import { HINTS, COMPI_MODE } from './hintContent';
import { useHints, fillTemplate } from './HintContext';
import type { HintAction } from './HintContext';
import { CompiBubble } from './CompiBubble';
import { clampToViewport, type FixedOffset } from './viewportFit';

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

// Nominal size used only for viewport clamping (see clampToViewport) — the
// bubble's real width is responsive (`min(420px, 94vw)`) and its height
// varies with content, so these are deliberately generous over-estimates:
// clamping a little earlier than strictly necessary is harmless, an
// under-estimate would risk an actual cutoff.
const BUBBLE_WIDTH  = 420;
const BUBBLE_HEIGHT = 340; // bubble + the mascot image hanging below it
const GAP = 12;

/**
 * An anchored, non-blocking hint bubble positioned next to whatever element
 * you wrap. Wording still comes from hintContent.ts; `placement` decides
 * which side of the anchor it prefers, and the result is always clamped to
 * stay fully on-screen (see clampToViewport) — important on mobile, where an
 * anchor near a screen edge is common.
 *
 * When COMPI_MODE is on, the hint speaks through Compi (see CompiBubble)
 * positioned near the anchor per `placement`, instead of pinned to a screen
 * corner. Rendered via a portal to `document.body` so it isn't affected by
 * any zoomed/transformed ancestor (see TourSpotlight for why that matters).
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState<FixedOffset | null>(null);
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

  // Measure the anchor and derive a clamped position from `placement`.
  useEffect(() => {
    if (!COMPI_MODE || !visible) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const naive: FixedOffset = (() => {
        switch (placement) {
          case 'top':      return { bottom: window.innerHeight - rect.top + GAP, left: rect.left + rect.width / 2 - BUBBLE_WIDTH / 2 };
          case 'top-start': return { bottom: window.innerHeight - rect.top + GAP, left: rect.left };
          case 'top-end':   return { bottom: window.innerHeight - rect.top + GAP, left: rect.right - BUBBLE_WIDTH };
          case 'bottom':    return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 - BUBBLE_WIDTH / 2 };
          case 'left':      return { top: rect.top + rect.height / 2 - BUBBLE_HEIGHT / 2, left: rect.left - BUBBLE_WIDTH - GAP };
          case 'right':     return { top: rect.top + rect.height / 2 - BUBBLE_HEIGHT / 2, left: rect.right + GAP };
        }
      })();
      setOffset(clampToViewport(naive, { width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT }, 16));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = new ResizeObserver(measure);
    if (anchorRef.current) ro.observe(anchorRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro.disconnect();
    };
  }, [visible, placement]);

  const resolvedActions: HintAction[] = actions ?? [
    { label: 'Got it', onClick: close, variant: 'primary' },
  ];

  // ── Compi presentation: mascot bubble anchored near the wrapped element ───
  if (COMPI_MODE) {
    return (
      <>
        <span ref={anchorRef} className="hint-anchor">{children}</span>
        {visible && def && offset && createPortal(
          <CompiBubble
            title={def.title}
            body={fillTemplate(def.body, vars)}
            actions={resolvedActions}
            onClose={close}
            offset={offset}
          />,
          document.body,
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
