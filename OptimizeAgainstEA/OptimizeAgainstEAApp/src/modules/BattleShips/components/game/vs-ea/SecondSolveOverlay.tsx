interface SecondSolveOverlayProps {
  /** Which side reached the optimum *second*, after the race was already won. */
  who:     'player' | 'ea';
  onClose: () => void;
}

/**
 * Shown when the side that lost the race nevertheless also reaches the global
 * minimum. Purely informational — the race result is already locked in by then.
 */
export function SecondSolveOverlay({ who, onClose }: SecondSolveOverlayProps) {
  const isEA = who === 'ea';
  return (
    <div className="ea-win-backdrop" onClick={onClose}>
      <div className="ea-win-card" onClick={(e) => e.stopPropagation()}>
        <div className="badge badge--outline badge--gold">{isEA ? 'EA CAUGHT UP' : 'YOU CAUGHT UP'}</div>
        <h2 className="ea-win-card__title">
          {isEA ? 'The EA found it too' : 'You found it too!'}
        </h2>
        <p className="ea-win-card__sub">
          {isEA
            ? 'The algorithm has now also reached the global minimum.'
            : 'You’ve now also reached the global minimum.'}
        </p>

        <div className="ea-win-card__actions">
          <button className="btn btn--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
