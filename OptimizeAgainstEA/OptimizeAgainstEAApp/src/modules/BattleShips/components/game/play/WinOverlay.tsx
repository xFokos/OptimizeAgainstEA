import type { ProbeResult } from '../../../types/map.ts';
import { valueToHeight } from '../../../engine/height';

interface WinOverlayProps {
  probeCount:    number;
  bestProbe:     ProbeResult;
  mapId:         string;
  onPlayAgain:   () => void;
  onHome:        () => void;
  onKeepPlaying?: () => void;
}

export function WinOverlay({ probeCount, bestProbe, mapId, onPlayAgain, onHome, onKeepPlaying }: WinOverlayProps) {
  return (
    <div className="win-overlay">
      <div className="win-card">
        <div className="win-card__tag">SUMMIT REACHED</div>
        <h2 className="win-card__title">You reached the peak</h2>
        <p className="win-card__sub">Map #{mapId}</p>

        <div className="win-card__stats">
          <div className="win-stat">
            <span className="win-stat__value">{probeCount}</span>
            <span className="win-stat__label">probes placed</span>
          </div>
          <div className="win-stat">
            <span className="win-stat__value">{valueToHeight(bestProbe.value).toFixed(3)}</span>
            <span className="win-stat__label">best height</span>
          </div>
        </div>

        <div className="win-card__actions">
          <button className="btn btn--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          {onKeepPlaying && (
            <button className="btn btn--ghost" onClick={onKeepPlaying}>
              Keep Playing
            </button>
          )}
          <button className="btn btn--ghost" onClick={onHome}>
            ← Home
          </button>
        </div>
      </div>
    </div>
  );
}
