import type { Individual } from '../../../types/ea';

interface EAWinOverlayProps {
  generationCount: number;
  best:            Individual | null;
  mapId:           string;
  onWatchReplay:   () => void;
  onDismiss:       () => void;
}

export function EAWinOverlay({
  generationCount, best, mapId, onWatchReplay, onDismiss,
}: EAWinOverlayProps) {
  return (
    <div className="ea-win-backdrop" onClick={onDismiss}>
      <div className="ea-win-card" onClick={(e) => e.stopPropagation()}>
        <div className="ea-win-card__tag">EA SOLVED IT</div>
        <h2 className="ea-win-card__title">The algorithm won</h2>
        <p className="ea-win-card__sub">Map #{mapId}</p>

        <div className="ea-win-card__stats">
          <div className="ea-win-stat">
            <span className="ea-win-stat__value">{generationCount}</span>
            <span className="ea-win-stat__label">generations</span>
          </div>
          {best && (
            <div className="ea-win-stat">
              <span className="ea-win-stat__value">{best.fitness.toFixed(4)}</span>
              <span className="ea-win-stat__label">best fitness</span>
            </div>
          )}
        </div>

        {best && (
          <div className="ea-win-card__pos">
            ({best.position.x.toFixed(3)}, {best.position.y.toFixed(3)})
          </div>
        )}

        <div className="ea-win-card__actions">
          <button className="btn btn--primary" onClick={onWatchReplay}>
            ▶ Watch Replay
          </button>
          <button className="btn btn--ghost" onClick={onDismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}