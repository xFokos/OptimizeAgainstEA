import type {Minimum} from '../../../types/map';
import { GameMap } from '../shared/GameMap';

interface GlobalMinimumPickerProps {
  minima: Minimum[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
}

export function GlobalMinimumPicker({
  minima,
  selectedId,
  onSelect,
  onBack,
  onFinish,
}: GlobalMinimumPickerProps) {
  return (
    <div className="create-step">
      <div className="create-step__info">
        <h2 className="create-step__heading">
          <span className="step-badge">02</span>
          Pick Global Minimum
        </h2>
        <p className="create-step__desc">
          Click the dot that should be the global minimum — the one the
          player must find to win.
        </p>

        {selectedId && (
          <div className="selection-preview">
            <span className="selection-preview__dot" />
            <span>Global minimum selected</span>
          </div>
        )}

        <div className="create-step__actions">
          <button className="btn btn--ghost" onClick={onBack}>
            ← Back
          </button>
          <button
            className="btn btn--primary"
            disabled={!selectedId}
            onClick={onFinish}
          >
            Generate Code →
          </button>
        </div>
      </div>

      <div className="create-step__map-wrap">
        <GameMap
          minima={minima}
          showMinima
          highlightGlobal
          onMinimumClick={onSelect}
          selectedId={selectedId}
          overlayLabel={!selectedId ? 'Click a dot to select it as global' : undefined}
        />
        <p className="map-hint">Click a dot to mark it as the global minimum</p>
      </div>
    </div>
  );
}
