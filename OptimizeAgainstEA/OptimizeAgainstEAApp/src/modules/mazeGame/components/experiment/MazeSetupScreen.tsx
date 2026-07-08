import { useState } from 'react';
import type { SerializedMaze } from '../../types/maze';
import { generateMaze, pickRandomStartGoal } from '../../engine/mazeGen';
import { DEFAULT_BRAID, DEFAULT_OPENNESS } from '../../engine/mazeProblem';
import { makeLCG } from '../../engine/rng';
import { decodeMaze } from '../../engine/mazeCodec';
import { useSavedMazes } from '../../hooks/useSavedMazes';
import { SliderRow } from '../../../../components/settings/eaControls';
import { Switch } from '../../../../components/ui/Switch';
import { HintToggle } from '../../../../components/hints';

interface MazeSetupScreenProps {
  onBack: () => void;
  /** Start the experiment on the chosen / generated maze. */
  onStart: (maze: SerializedMaze) => void;
}

const MIN_SIZE = 4;
const MAX_SIZE = 32;
const DEFAULT_SIZE = 12;

/** The random option's sentinel id — saved mazes use their library id. */
const RANDOM = 'random';

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Experiment entry screen: pick a maze — a fresh random one (at a size of
 * your choosing) or one of your saved creations — then press Play.
 */
export function MazeSetupScreen({ onBack, onStart }: MazeSetupScreenProps) {
  const { savedMazes, removeMaze, renameMaze } = useSavedMazes();
  const [selected, setSelected] = useState<string>(RANDOM);
  const [genCols, setGenCols] = useState(DEFAULT_SIZE);
  const [genRows, setGenRows] = useState(DEFAULT_SIZE);
  const [openness, setOpenness] = useState(DEFAULT_OPENNESS);
  const [randomEndpoints, setRandomEndpoints] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handlePlay = () => {
    if (selected === RANDOM) {
      const seed = Math.floor(Math.random() * 1_000_000_000);
      const grid = generateMaze(genCols, genRows, seed, { braid: DEFAULT_BRAID, openness });
      const endpoints = randomEndpoints
        ? pickRandomStartGoal(grid, makeLCG(seed + 1))
        : { start: { x: 0, y: 0 }, goal: { x: genCols - 1, y: genRows - 1 } };
      onStart({
        cols: genCols,
        rows: genRows,
        walls: grid.walls,
        ...endpoints,
      });
      return;
    }
    const entry = savedMazes.find((m) => m.id === selected);
    if (!entry) return;
    try {
      onStart(decodeMaze(entry.code));
    } catch {
      setError('This saved maze is corrupted and cannot be loaded.');
    }
  };

  const commitRename = () => {
    if (editingId) renameMaze(editingId, draft);
    setEditingId(null);
  };

  const handleRemove = (id: string) => {
    removeMaze(id);
    setConfirmingId(null);
    if (selected === id) setSelected(RANDOM);
  };

  return (
    <div className="maze-app maze-app--menu">
      <header className="maze-topbar maze-topbar--bar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <span className="maze-topbar__title">🧬<span className="maze-topbar__title-label"> EA Experiment</span></span>
        <HintToggle />
      </header>

      <div className="maze-setup">
        <div className="panel panel--surface panel--md maze-panel">
          <div className="eyebrow">Choose a maze</div>

          {/* Adjusting a slider implies "I want a random maze" — select it. */}
          <SliderRow
            label="Width" value={genCols}
            min={MIN_SIZE} max={MAX_SIZE} step={1} format={String}
            onChange={(v) => { setGenCols(Math.round(v)); setSelected(RANDOM); }}
          />
          <SliderRow
            label="Height" value={genRows}
            min={MIN_SIZE} max={MAX_SIZE} step={1} format={String}
            onChange={(v) => { setGenRows(Math.round(v)); setSelected(RANDOM); }}
          />
          <SliderRow
            label="Openness" value={openness}
            min={0} max={0.4} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => { setOpenness(v); setSelected(RANDOM); }}
          />
          <Switch
            checked={randomEndpoints}
            onChange={(v) => { setRandomEndpoints(v); setSelected(RANDOM); }}
            label="Random start & goal"
            title="Place start and goal at random (kept at least 60% of the maze diameter apart) instead of corner to corner."
          />

          <button
            className={`maze-saved__use ${selected === RANDOM ? 'maze-saved__use--active' : ''}`}
            onClick={() => setSelected(RANDOM)}
          >
            <span className="maze-saved__name">🎲 Random maze</span>
            <span className="maze-saved__meta">
              freshly generated · {genCols}×{genRows}
            </span>
          </button>

          <div className="eyebrow">Your mazes</div>

          <ul className="maze-saved__list">
            {savedMazes.map((m) => (
              <li key={m.id} className="maze-saved__item">
                {editingId === m.id ? (
                  <input
                    className="maze-input maze-saved__rename"
                    value={draft}
                    autoFocus
                    spellCheck={false}
                    placeholder={`#${m.id}`}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    className={`maze-saved__use ${selected === m.id ? 'maze-saved__use--active' : ''}`}
                    onClick={() => { setSelected(m.id); setError(''); }}
                  >
                    <span className="maze-saved__name">{m.name ?? `#${m.id}`}</span>
                    <span className="maze-saved__meta">
                      {m.cols}×{m.rows} · {fmtDate(m.createdAt)}
                    </span>
                  </button>
                )}
                {confirmingId === m.id ? (
                  <>
                    <button
                      className="btn btn--sm maze-saved__confirm"
                      onClick={() => handleRemove(m.id)}
                      title="Confirm delete"
                    >
                      Delete?
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setConfirmingId(null)}
                      aria-label="Cancel delete"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setEditingId(m.id); setDraft(m.name ?? ''); }}
                      aria-label={`Rename maze ${m.name ?? m.id}`}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setConfirmingId(m.id)}
                      aria-label={`Delete maze ${m.name ?? m.id}`}
                      title="Delete"
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {savedMazes.length === 0 && (
            <p className="maze-note">
              Mazes you save in the creator appear here. Build one with
              🧱 Create, then hit 💾 Save.
            </p>
          )}

          {error && <p className="maze-note maze-note--warn">{error}</p>}

          <div className="maze-setup__play">
            <button className="btn btn--primary btn--block" onClick={handlePlay}>
              ▶ Play
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
