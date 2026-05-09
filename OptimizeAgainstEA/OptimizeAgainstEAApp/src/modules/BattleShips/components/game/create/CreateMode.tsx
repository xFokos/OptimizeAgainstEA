import { useState } from 'react';
import type { CreateStep } from '../../../types/game';
import { useGameMap } from '../../../hooks/useGameMap';
import { MinimumPlacer } from './MinimumPlacer';
import { GlobalMinimumPicker } from './GlobalMinimumPicker';
import { CodeModal } from '../shared/CodeModal';

interface CreateModeProps {
  onBack: () => void;
}

export function CreateMode({ onBack }: CreateModeProps) {
  const [step, setStep] = useState<CreateStep>('place');
  const [showModal, setShowModal] = useState(false);

  const {
    minima,
    mapId,
    isFull,
    maxMinima,
    minSpacing,
    //hasGlobal,
    addMinimum,
    removeMinimum,
    setGlobalMinimum,
    clearAll,
    getCode,
  } = useGameMap();

  const selectedId = minima.find((m) => m.isGlobal)?.id ?? null;

  const handleFinish = () => {
    setShowModal(true);
    setStep('done');
  };

  const handleClose = () => {
    setShowModal(false);
  };

  const handleReset = () => {
    clearAll();
    setStep('place');
    setShowModal(false);
  };

  return (
      <div className="create-mode">
        <div className="create-mode__topbar">
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Back
          </button>
          <div className="step-indicator">
            <span className={`step-pip ${step === 'place' || step === 'done' ? 'step-pip--active' : ''}`} />
            <span className="step-pip__line" />
            <span className={`step-pip ${step === 'pick-global' || step === 'done' ? 'step-pip--active' : ''}`} />
            <span className="step-pip__line" />
            <span className={`step-pip ${step === 'done' ? 'step-pip--active' : ''}`} />
          </div>
          {minima.length > 0 && (
              <button className="btn btn--ghost btn--sm btn--danger" onClick={handleReset}>
                Reset
              </button>
          )}
        </div>

        {step === 'place' && (
            <MinimumPlacer
                minima={minima}
                maxMinima={maxMinima}
                minSpacing={minSpacing}
                isFull={isFull}
                onPlace={addMinimum}
                onRemove={removeMinimum}
                onNext={() => setStep('pick-global')}
            />
        )}

        {step === 'pick-global' && (
            <GlobalMinimumPicker
                minima={minima}
                selectedId={selectedId}
                onSelect={setGlobalMinimum}
                onBack={() => setStep('place')}
                onFinish={handleFinish}
            />
        )}

        {step === 'done' && !showModal && (
            <div className="create-done">
              <p>Map created!</p>
              <button className="btn btn--primary" onClick={() => setShowModal(true)}>
                Show Code
              </button>
              <button className="btn btn--ghost" onClick={handleReset}>
                Create Another
              </button>
            </div>
        )}

        {showModal && (
            <CodeModal
                code={getCode()}
                mapId={mapId}
                onClose={handleClose}
            />
        )}
      </div>
  );
}