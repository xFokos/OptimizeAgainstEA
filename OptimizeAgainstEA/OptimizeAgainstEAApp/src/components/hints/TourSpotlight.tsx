import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject, CSSProperties } from 'react';
import type { HintAction } from './HintContext';

interface TourSpotlightProps {
  /** The real UI element to highlight — everything else dims. */
  targetRef: RefObject<HTMLElement | null>;
  title?: string;
  body: string;
  actions: HintAction[];
  /** Backdrop click / × button — ends the whole tour, same as a "Skip". */
  onSkip: () => void;
}

const PAD = 10;
const TOOLTIP_WIDTH = 320;
const GAP = 14;

/**
 * Guided-tour coachmark: dims the whole screen except a rounded cutout around
 * `targetRef`, with a tooltip placed next to it (never pinned to a corner).
 * Re-measures on resize/scroll and whenever the target's own size changes.
 *
 * Rendered via a portal straight into `document.body` — required because
 * `position: fixed` is positioned relative to the nearest ancestor that
 * establishes a containing block for it, and CSS `zoom` (used by some pages,
 * e.g. the Solo lobby, to scale their layout to the window size) creates one
 * just like `transform` does. A fixed-position element left inside a zoomed
 * ancestor would end up offset/scaled by that zoom, even though
 * `getBoundingClientRect()` on the target already reports true viewport
 * coordinates — the portal keeps both in the same coordinate space, so this
 * lines up correctly at any zoom level, window size, or device.
 */
export function TourSpotlight({ targetRef, title, body, actions, onSkip }: TourSpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = targetRef.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = new ResizeObserver(measure);
    if (targetRef.current) ro.observe(targetRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro.disconnect();
    };
  }, [targetRef]);

  if (!rect) return null;

  const holeStyle: CSSProperties = {
    top:    rect.top - PAD,
    left:   rect.left - PAD,
    width:  rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Prefer below the target; flip above if there isn't room.
  const spaceBelow  = window.innerHeight - rect.bottom;
  const placeBelow  = spaceBelow > 180;
  const clampedLeft = Math.min(
    Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 16),
    window.innerWidth - TOOLTIP_WIDTH - 16,
  );
  const tooltipStyle: CSSProperties = {
    left: clampedLeft,
    ...(placeBelow
      ? { top: rect.bottom + PAD + GAP }
      : { bottom: window.innerHeight - rect.top + PAD + GAP }),
  };

  return createPortal(
    <>
      <div className="tour-spotlight__catcher" onClick={onSkip} />
      <div className="tour-spotlight__hole" style={holeStyle} />
      <div className="tour-spotlight__tooltip" style={tooltipStyle} role="status">
        <button className="tour-spotlight__close" onClick={onSkip} aria-label="Skip tour">×</button>
        {title && <div className="tour-spotlight__title">{title}</div>}
        <div className="tour-spotlight__body">{body}</div>
        <div className="tour-spotlight__actions">
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
      </div>
    </>,
    document.body,
  );
}
