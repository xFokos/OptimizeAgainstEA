import type {GameMode} from '../../../types/game.ts';

interface ModeSelectorProps {
  onSelect: (mode: GameMode) => void;
}

const MODES: { id: GameMode; label: string; sub: string; key: string }[] = [
  {
    id: 'create',
    label: 'Create',
    sub: 'Place minima and share a map',
    key: 'C',
  },
  {
    id: 'play',
    label: 'Play',
    sub: 'Find the global minimum',
    key: 'P',
  },
  {
    id: 'vs-ea',
    label: 'Vs EA',
    sub: 'Race against an evolutionary algorithm',
    key: 'E',
  },
];

export function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <div className="mode-selector__header">
        <h1 className="mode-selector__title">Battleships</h1>
        <p className="mode-selector__subtitle">
          Like the board game, but made for optimization
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
