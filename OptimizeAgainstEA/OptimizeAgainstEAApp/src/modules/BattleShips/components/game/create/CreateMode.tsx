import { Fragment, useEffect, useState } from 'react';
import type { CreateStep, GameMode } from '../../../types/game.ts';
import { useGameMap } from '../../../hooks/useGameMap';
import { copyCode } from
    '../../../engine/codeClipboard';
import { useSavedMaps } from '../../../hooks/useSavedMaps';
import { useHints } from '../../../../../components/hints';
import type { HintId } from '../../../../../components/hints';
import { MinimumPlacer } from './MinimumPlacer';
import { GlobalMinimumPicker } from './GlobalMinimumPicker';

interface CreateModeProps {
  onBack: () => void;
  /** Navigate to another mode, optionally preloading the just-created map code. */
  onUseMap: (mode: GameMode, code: string) => void;
}

const stepOrder: Record<CreateStep, number> = {
  place: 0,
  'pick-global': 1,
  done: 2,
};

// One-time hint shown the first time the player reaches each phase this session.
const stepHint: Record<CreateStep, HintId> = {
  place: 'create.place',
  'pick-global': 'create.pickGlobal',
  done: 'create.done',
};

export function CreateMode({ onBack, onUseMap }: CreateModeProps) {
  const [step, setStep] = useState<CreateStep>('place');
  const [copied, setCopied] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const { showHint, active, isSeen } = useHints();

  // Intro modal, shown once when the player first enters Create mode.
  useEffect(() => {
    showHint('create.start');
  }, [showHint]);

  // Fire the phase's one-time hint whenever the player enters a new phase.
  // On the initial 'place' phase, hold off until the intro modal has actually
  // been dismissed — otherwise the toast would clobber the (single-slot) modal.
  useEffect(() => {
    if (step === 'place' && (!isSeen('create.start') || active?.id === 'create.start')) return;
    showHint(stepHint[step]);
  }, [step, active, isSeen, showHint]);

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
    getMapConfig,
  } = useGameMap();

  const { saveMap } = useSavedMaps();

  const selectedId = minima.find((m) => m.isGlobal)?.id ?? null;

  // Code is generated on entering 'done' — prompt for a name before saving.
  const handleFinish = () => {
    setNameDraft('');
    setShowNameModal(true);
    setStep('done');
  };

  const handleSaveName = () => {
    saveMap(getMapConfig(), nameDraft);
    setShowNameModal(false);
  };

  const handleReset = () => {
    clearAll();
    setStep('place');
    setCopied(false);
    setShowNameModal(false);
    setNameDraft('');
  };

  const handleCopy = async (code: string) => {
    await copyCode(code);
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
            {(['place', 'pick-global', 'done'] as const).map((s, i) => (
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

        {showNameModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <span className="modal__tag">SAVE MAP</span>
                <p className="modal__desc">
                  Give your map a name so you can find it later in “Your Maps”.
                  Leave it blank to keep the id #{mapId}.
                </p>
                <input
                    className="map-loader__input"
                    placeholder={`#${mapId}`}
                    value={nameDraft}
                    autoFocus
                    spellCheck={false}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <div className="modal__actions">
                  <button className="btn btn--primary" onClick={handleSaveName}>
                    Save
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}