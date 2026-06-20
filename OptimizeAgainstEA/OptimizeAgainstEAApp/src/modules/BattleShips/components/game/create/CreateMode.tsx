import { Fragment, useEffect, useState } from 'react';
import type { CreateStep, GameMode } from '../../../types/game.ts';
import { useGameMap } from '../../../hooks/useGameMap';
import { useHints } from '../../../hints/HintContext';
import type { HintId } from '../../../hints/hintContent';
import { MinimumPlacer } from './MinimumPlacer';
import { TuneValues } from './TuneValues';
import { GlobalMinimumPicker } from './GlobalMinimumPicker';

interface CreateModeProps {
  onBack: () => void;
  /** Navigate to another mode, optionally preloading the just-created map code. */
  onUseMap: (mode: GameMode, code: string) => void;
}

const stepOrder: Record<CreateStep, number> = {
  place: 0,
  tune: 1,
  'pick-global': 2,
  done: 3,
};

// One-time hint shown the first time the player reaches each phase this session.
const stepHint: Record<CreateStep, HintId> = {
  place: 'create.place',
  tune: 'create.tune',
  'pick-global': 'create.pickGlobal',
  done: 'create.done',
};

export function CreateMode({ onBack, onUseMap }: CreateModeProps) {
  const [step, setStep] = useState<CreateStep>('place');
  const [copied, setCopied] = useState(false);
  const { showHint } = useHints();

  // Fire the phase's one-time hint whenever the player enters a new phase.
  useEffect(() => {
    showHint(stepHint[step]);
  }, [step, showHint]);

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
    setFloor,
    clearAll,
    getCode,
  } = useGameMap();

  const selectedId = minima.find((m) => m.isGlobal)?.id ?? null;

  const handleFinish = () => {
    setStep('done');
  };

  const handleReset = () => {
    clearAll();
    setStep('place');
    setCopied(false);
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
      <div className="create-mode">
        <div className="create-mode__topbar">
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Back
          </button>
          <div className="step-indicator">
            {(['place', 'tune', 'pick-global', 'done'] as const).map((s, i) => (
              <Fragment key={s}>
                {i > 0 && <span className="step-pip__line" />}
                <span className={`step-pip ${stepOrder[step] >= i ? 'step-pip--active' : ''}`} />
              </Fragment>
            ))}
          </div>
          {step === 'done' ? (
              <button className="btn btn--ghost btn--sm" onClick={handleReset}>
                Create Another
              </button>
          ) : minima.length > 0 ? (
              <button className="btn btn--ghost btn--sm btn--danger" onClick={handleReset}>
                Reset
              </button>
          ) : (
              <span />
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
                onNext={() => setStep('tune')}
            />
        )}

        {step === 'tune' && (
            <TuneValues
                minima={minima}
                onSetFloor={setFloor}
                onBack={() => setStep('place')}
                onNext={() => setStep('pick-global')}
            />
        )}

        {step === 'pick-global' && (
            <GlobalMinimumPicker
                minima={minima}
                selectedId={selectedId}
                onSelect={setGlobalMinimum}
                onBack={() => setStep('tune')}
                onFinish={handleFinish}
            />
        )}

        {step === 'done' && (() => {
            const code = getCode();
            return (
                <div className="create-done">
                  <span className="modal__tag">MAP CREATED</span>
                  <span className="modal__id">#{mapId}</span>
                  <p className="create-done__desc">
                    Share this code so others can load your map.
                  </p>

                  <div className="modal__code-block create-done__codebox">
                    <code className="modal__code">{code}</code>
                    <button className="modal__copy-btn" onClick={() => handleCopy(code)}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="create-done__links">
                    <button className="btn btn--primary" onClick={() => onUseMap('play', code)}>
                      ▶ Play this map
                    </button>
                    <button className="btn btn--primary" onClick={() => onUseMap('vs-ea', code)}>
                      🤖 Play vs EA
                    </button>
                  </div>
                </div>
            );
        })()}
      </div>
  );
}