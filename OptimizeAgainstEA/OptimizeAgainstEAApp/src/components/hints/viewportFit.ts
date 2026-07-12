/** A fixed-position box expressed the same way CSS does: top XOR bottom,
 * left XOR right (in px, relative to the viewport edges). Exactly one of
 * top/bottom and one of left/right should be set. */
export interface FixedOffset {
  top?:    number;
  bottom?: number;
  left?:   number;
  right?:  number;
}

/**
 * Clamps a preferred fixed-position offset so the box it describes can never
 * render off-screen — the one shared implementation behind both TourSpotlight
 * and the hint bubbles (CompiBubble/HintPopover). `size` is the box's own
 * (known or estimated) width/height in px; when the real size isn't known in
 * advance, a generous over-estimate is safe here — it just clamps a little
 * earlier than strictly necessary, never causes an actual cutoff.
 */
export function clampToViewport(
  box:    FixedOffset,
  size:   { width: number; height: number },
  margin = 12,
): FixedOffset {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const result: FixedOffset = { ...box };

  if (result.left !== undefined) {
    result.left = Math.min(Math.max(result.left, margin), Math.max(margin, vw - size.width - margin));
  } else if (result.right !== undefined) {
    result.right = Math.min(Math.max(result.right, margin), Math.max(margin, vw - size.width - margin));
  }

  if (result.top !== undefined) {
    result.top = Math.min(Math.max(result.top, margin), Math.max(margin, vh - size.height - margin));
  } else if (result.bottom !== undefined) {
    result.bottom = Math.min(Math.max(result.bottom, margin), Math.max(margin, vh - size.height - margin));
  }

  return result;
}
