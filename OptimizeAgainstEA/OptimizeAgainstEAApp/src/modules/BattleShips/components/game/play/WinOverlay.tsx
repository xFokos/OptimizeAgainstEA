import type { ProbeResult } from '../../../types/map.ts';

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
        <div className="win-card__tag">GLOBAL MIN FOUND</div>
        <h2 className="win-card__title">You solved it</h2>
        <p className="win-card__sub">Map #{mapId}</p>

        <div className="win-card__stats">
          <div className="win-stat">
            <span className="win-stat__value">{probeCount}</span>
            <span className="win-stat__label">probes placed</span>
          </div>
          <div className="win-stat">
            <span className="win-stat__value">{bestProbe.value.toFixed(3)}</span>
            <span className="win-stat__label">best value</span>
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
