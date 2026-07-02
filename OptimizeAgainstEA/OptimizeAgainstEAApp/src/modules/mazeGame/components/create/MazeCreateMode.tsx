import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Cell, SerializedMaze } from '../../types/maze';
import { cellIndex } from '../../types/maze';
import { gridFromWallCells } from '../../engine/mazeGen';
import { computeGeodesic } from '../../engine/geodesic';
import { MazeCanvas } from '../shared/MazeCanvas';

interface MazeCreateModeProps {
  /** A previously created maze to continue editing (or null for a blank grid). */
  initialMaze: SerializedMaze | null;
  onBack: () => void;
  /** Hand the finished maze to the experiment mode. */
  onExperiment: (maze: SerializedMaze) => void;
}

type Tool = 'wall' | 'floor' | 'start' | 'goal';

const SIZES = [8, 12, 16] as const;
const DEFAULT_SIZE = 12;

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'wall',  label: '🧱 Wall',  hint: 'drag to paint solid blocks' },
  { id: 'floor', label: '⬜ Floor', hint: 'drag to erase blocks' },
  { id: 'start', label: '🟢 Start', hint: 'click to place the start' },
  { id: 'goal',  label: '🏁 Goal',  hint: 'click to place the goal' },
];

/**
 * Rebuilds the editor's paint model from a serialized maze: a cell is a solid
 * block exactly when it has no open passage. (Editor-built mazes round-trip;
 * a floor cell fully sealed in by blocks re-imports as a block — it was
 * unreachable anyway.)
 */
function wallCellsFrom(maze: SerializedMaze): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < maze.walls.length; i++) {
    if (maze.walls[i] === 0) out.add(i);
  }
  out.delete(cellIndex(maze.start.x, maze.start.y, maze.cols));
  out.delete(cellIndex(maze.goal.x, maze.goal.y, maze.cols));
  return out;
}

/**
 * Maze creator: paint solid wall blocks on a grid, place start & goal, and
 * hand the result to the EA experiment. Cell-painting (not edge-carving) keeps
 * the editor touch-friendly; gridFromWallCells converts the painted model into
 * the edge-bitmask Grid the engine understands.
 */
export function MazeCreateMode({ initialMaze, onBack, onExperiment }: MazeCreateModeProps) {
  const [size, setSize] = useState<number>(initialMaze?.cols ?? DEFAULT_SIZE);
  const [wallCells, setWallCells] = useState<Set<number>>(
    () => (initialMaze ? wallCellsFrom(initialMaze) : new Set()),
  );
  const [start, setStart] = useState<Cell>(initialMaze?.start ?? { x: 0, y: 0 });
  const [goal, setGoal] = useState<Cell>(
    initialMaze?.goal ?? { x: DEFAULT_SIZE - 1, y: DEFAULT_SIZE - 1 },
  );
  const [tool, setTool] = useState<Tool>('wall');

  const cols = size;
  const rows = size;

  // Painted cells → engine grid → live reachability check.
  const grid = useMemo(
    () => gridFromWallCells(cols, rows, (x, y) => wallCells.has(cellIndex(x, y, cols))),
    [cols, rows, wallCells],
  );
  const geo = useMemo(() => computeGeodesic(grid, goal, start), [grid, goal, start]);
  const reachable = geo.shortestFromStart > 0;

  // ── Painting ──────────────────────────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const applyTool = (x: number, y: number) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    const i = cellIndex(x, y, cols);
    const isStart = start.x === x && start.y === y;
    const isGoal = goal.x === x && goal.y === y;

    if (tool === 'wall') {
      if (isStart || isGoal || wallCells.has(i)) return;
      setWallCells((prev) => new Set(prev).add(i));
    } else if (tool === 'floor') {
      if (!wallCells.has(i)) return;
      setWallCells((prev) => { const next = new Set(prev); next.delete(i); return next; });
    } else if (tool === 'start') {
      if (isGoal || isStart) return;
      setWallCells((prev) => { const next = new Set(prev); next.delete(i); return next; });
      setStart({ x, y });
    } else if (tool === 'goal') {
      if (isStart || isGoal) return;
      setWallCells((prev) => { const next = new Set(prev); next.delete(i); return next; });
      setGoal({ x, y });
    }
  };

  const cellFromEvent = (e: ReactPointerEvent): Cell | null => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * cols),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * rows),
    };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = cellFromEvent(e);
    if (c) applyTool(c.x, c.y);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    const c = cellFromEvent(e);
    if (c) applyTool(c.x, c.y);
  };
  const stopDragging = () => { draggingRef.current = false; };

  // ── Actions ───────────────────────────────────────────────────────────────
  const changeSize = (next: number) => {
    setSize(next);
    // Keep blocks that still fit; clamp the markers into the new bounds.
    setWallCells((prev) => {
      const kept = new Set<number>();
      prev.forEach((i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        if (x < next && y < next) kept.add(cellIndex(x, y, next));
      });
      return kept;
    });
    setStart((s) => ({ x: Math.min(s.x, next - 1), y: Math.min(s.y, next - 1) }));
    setGoal((g) => ({ x: Math.min(g.x, next - 1), y: Math.min(g.y, next - 1) }));
  };

  const handleExperiment = () => {
    onExperiment({ cols, rows, walls: grid.walls, start, goal });
  };

  return (
    <div className="maze-app">
      <header className="maze-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <span className="maze-topbar__title">🧱 Maze Creator</span>
        <span className="maze-topbar__meta">
          {reachable
            ? <>shortest path <b className="maze-topbar__meta-accent">{geo.shortestFromStart}</b> steps</>
            : <b className="maze-topbar__meta-warn">goal unreachable</b>}
        </span>
      </header>

      <div className="maze-layout">
        <div className="maze-map-col">
          <div
            ref={wrapRef}
            className="maze-paint-surface"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <MazeCanvas
              cols={cols}
              rows={rows}
              walls={grid.walls}
              start={start}
              goal={goal}
              solidCells={wallCells}
            />
          </div>
        </div>

        <div className="maze-side">
          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Tools</div>
            <div className="maze-toolbar">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  className={`btn btn--sm ${tool === t.id ? 'btn--active' : 'btn--ghost'}`}
                  onClick={() => setTool(t.id)}
                  title={t.hint}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="maze-note">
              {TOOLS.find((t) => t.id === tool)?.hint}. The border is always
              walled — agents can never leave the grid.
            </p>
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Grid</div>
            <div className="maze-toolbar">
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`btn btn--sm ${size === s ? 'btn--active' : 'btn--ghost'}`}
                  onClick={() => changeSize(s)}
                >
                  {s}×{s}
                </button>
              ))}
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setWallCells(new Set())}
                disabled={wallCells.size === 0}
              >
                🧹 Clear walls
              </button>
            </div>
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Status</div>
            {reachable ? (
              <p className="maze-note">
                ✓ The goal is reachable — the shortest path takes{' '}
                <b>{geo.shortestFromStart}</b> steps.
              </p>
            ) : (
              <p className="maze-note maze-note--warn">
                ✕ The goal cannot be reached from the start. Erase some walls
                to open a corridor.
              </p>
            )}
            <button
              className="btn btn--primary btn--block"
              disabled={!reachable}
              onClick={handleExperiment}
            >
              🧬 Experiment on this maze →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
