import { useEffect } from 'react';
import type {GameMode} from '../../../types/game.ts';
import { useHints } from '../../../../../components/hints';

interface ModeSelectorProps {
  onSelect: (mode: GameMode) => void;
}

const MODES: { id: GameMode; label: string; sub: string; key: string }[] = [
  {
    id: 'create',
    label: 'Create',
    sub: 'Create a Mountain Range',
    key: 'C',
  },
  {
    id: 'play',
    label: 'Play',
    sub: 'Find the Tallest Peak',
    key: 'P',
  },
  {
    id: 'vs-ea',
    label: 'Vs EA',
    sub: 'Race against an evolutionary algorithm to the top',
    key: 'E',
  },
];

export function ModeSelector({ onSelect }: ModeSelectorProps) {
  const { showHint } = useHints();

  useEffect(() => {
    showHint('selector.welcome');
  }, [showHint]);

  return (
    <div className="mode-selector">
      <div className="mode-selector__header">
        <h1 className="mode-selector__title">Peak Finder</h1>
        <p className="mode-selector__subtitle">
          Can you reach the top of this Mountain Range?
        </p>
      </div>

      <div className="mode-selector__grid">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className="mode-card"
            onClick={() => onSelect(mode.id)}
          >
            <span className="mode-card__key">{mode.key}</span>
            <span className="mode-card__label">{mode.label}</span>
            <span className="mode-card__sub">{mode.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
