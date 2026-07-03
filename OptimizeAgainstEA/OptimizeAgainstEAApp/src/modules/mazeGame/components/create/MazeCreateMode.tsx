import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Cell, SerializedMaze } from '../../types/maze';
import { MOVE_WALL_BIT, cellIndex } from '../../types/maze';
import { gridFromEdgeWalls } from '../../engine/mazeGen';
import { computeGeodesic } from '../../engine/geodesic';
import { MAX_PATH_LENGTH } from '../../engine/mazeProblem';
import { useSavedMazes } from '../../hooks/useSavedMazes';
import type { MazeWallPreview } from '../shared/MazeCanvas';
import { MazeCanvas } from '../shared/MazeCanvas';
import { SliderRow } from '../../../../components/settings/eaControls';
import { Switch } from '../../../../components/ui/Switch';

interface MazeCreateModeProps {
  /** A previously created maze to continue editing (or null for a blank grid). */
  initialMaze: SerializedMaze | null;
  onBack: () => void;
  /** Hand the finished maze to the experiment mode. */
  onExperiment: (maze: SerializedMaze) => void;
}

type Tool = 'wall' | 'floor' | 'start' | 'goal';

/** Square quick-pick sizes; width & height are also freely adjustable. */
const SIZES = [8, 12, 16] as const;
const DEFAULT_SIZE = 12;
const MIN_SIZE = 4;
const MAX_SIZE = 32;

/** How close (in cell units) the pointer must be to a grid line to hit an edge. */
const EDGE_SNAP = 0.34;
/**
 * Fraction of an edge's length (centered) that accepts the pointer. The
 * hitbox is an ellipse — full EDGE_SNAP tolerance at the segment's middle,
 * tapering to zero at 10% from each corner — so near grid intersections no
 * edge is grabbable and free-form strokes can't pick up stray orthogonal
 * walls. The hover highlight spans exactly this active zone.
 */
const EDGE_ACTIVE = 0.7;
/** Drag sampling step (in cell units) so fast strokes don't skip edges. */
const DRAG_STEP = 0.2;
/**
 * Once a stroke has locked onto a grid line, how far (in cell units) the
 * pointer may drift off it and still paint. More generous than EDGE_SNAP —
 * wobble along a locked line is harmless — but under 0.5 so the pointer
 * visibly nearer a parallel line paints nothing rather than the wrong line.
 */
const STROKE_KEEP = 0.45;

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'wall',  label: '🧱 Wall',  hint: 'draw walls on the lines between cells' },
  { id: 'floor', label: '⬜ Erase', hint: 'drag over walls to remove them' },
  { id: 'start', label: '🟢 Start', hint: 'click a cell to place the start' },
  { id: 'goal',  label: '🏁 Goal',  hint: 'click a cell to place the goal' },
];

/**
 * Edge-wall model: walls live BETWEEN cells, exactly as the engine's
 * edge-bitmask Grid and the experiment view render them. Internal edges are
 * flat-indexed — horizontal edges (between (x,y) and (x,y+1)) first, then
 * vertical edges (between (x,y) and (x+1,y)).
 */
const hEdgeId = (x: number, y: number, cols: number) => y * cols + x;
const vEdgeId = (x: number, y: number, cols: number, rows: number) =>
  cols * (rows - 1) + y * (cols - 1) + x;

/**
 * Reads the closed internal edges out of a serialized maze so a previously
 * created (or generated) maze can be re-edited in place.
 */
function edgeWallsFrom(maze: SerializedMaze): Set<number> {
  const out = new Set<number>();
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      const w = maze.walls[cellIndex(x, y, maze.cols)];
      if (y < maze.rows - 1 && !(w & MOVE_WALL_BIT[2])) out.add(hEdgeId(x, y, maze.cols));
      if (x < maze.cols - 1 && !(w & MOVE_WALL_BIT[1])) out.add(vEdgeId(x, y, maze.cols, maze.rows));
    }
  }
  return out;
}

/** An edge under the pointer: its id plus endpoints in grid units. */
interface EdgeHit {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The grid line a wall/erase stroke is locked to: a horizontal line y = k or
 * a vertical line x = k. Locked on the stroke's first edge so finger wobble
 * can't paint stray orthogonal walls.
 */
interface StrokeLine {
  axis: 'h' | 'v';
  k: number;
}

/**
 * Maze creator: draw walls on the borders between cells (click or drag along
 * a grid line), place start & goal, and hand the result to the EA experiment.
 * The edge-wall model matches what the engine simulates and what the
 * experiment tab renders, so the maze looks identical in both modes.
 */
export function MazeCreateMode({ initialMaze, onBack, onExperiment }: MazeCreateModeProps) {
  const [cols, setCols] = useState<number>(initialMaze?.cols ?? DEFAULT_SIZE);
  const [rows, setRows] = useState<number>(initialMaze?.rows ?? DEFAULT_SIZE);
  const [wallEdges, setWallEdges] = useState<Set<number>>(
    () => (initialMaze ? edgeWallsFrom(initialMaze) : new Set()),
  );
  const [start, setStart] = useState<Cell>(initialMaze?.start ?? { x: 0, y: 0 });
  const [goal, setGoal] = useState<Cell>(
    initialMaze?.goal ?? { x: DEFAULT_SIZE - 1, y: DEFAULT_SIZE - 1 },
  );
  const [tool, setTool] = useState<Tool>('wall');
  const [hoverEdge, setHoverEdge] = useState<EdgeHit | null>(null);
  /** Lock each stroke to the grid line it starts on (prevents stray
   * orthogonal walls from touch wobble). Off = free-form drawing. */
  const [axisLock, setAxisLock] = useState(true);
  // Saving: a name prompt folds open in the Status panel; `savedFlash`
  // acknowledges the save for a moment afterwards.
  const { saveMaze } = useSavedMazes();
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  // Edge walls → engine grid → live reachability check.
  const grid = useMemo(
    () => gridFromEdgeWalls(
      cols, rows,
      (x, y) => wallEdges.has(hEdgeId(x, y, cols)),
      (x, y) => wallEdges.has(vEdgeId(x, y, cols, rows)),
    ),
    [cols, rows, wallEdges],
  );
  const geo = useMemo(() => computeGeodesic(grid, goal, start), [grid, goal, start]);
  const reachable = geo.shortestFromStart > 0;
  // The EA's genome is capped; a longer shortest path makes the maze unwinnable.
  const exceedsGenome = reachable && geo.shortestFromStart > MAX_PATH_LENGTH;

  // ── Drawing ───────────────────────────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef<{ fx: number; fy: number } | null>(null);
  const strokeLineRef = useRef<StrokeLine | null>(null);

  /** Pointer position in fractional grid units, or null before layout. */
  const posFromEvent = (e: ReactPointerEvent): { fx: number; fy: number } | null => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      fx: ((e.clientX - rect.left) / rect.width) * cols,
      fy: ((e.clientY - rect.top) / rect.height) * rows,
    };
  };

  // Preview/highlight endpoints span exactly the active (clickable) zone.
  const inset = (1 - EDGE_ACTIVE) / 2;
  const hEdgeHit = (x: number, hy: number): EdgeHit =>
    ({ id: hEdgeId(x, hy - 1, cols), x1: x + inset, y1: hy, x2: x + 1 - inset, y2: hy });
  const vEdgeHit = (vx: number, y: number): EdgeHit =>
    ({ id: vEdgeId(vx - 1, y, cols, rows), x1: vx, y1: y + inset, x2: vx, y2: y + 1 - inset });

  /**
   * The internal edge under (fx, fy). The hitbox is elliptical: perpendicular
   * tolerance EDGE_SNAP at the segment's centre, shrinking to zero towards the
   * corners (only the central EDGE_ACTIVE fraction is clickable) — see
   * EDGE_ACTIVE. Border edges are excluded — the outer wall is fixed.
   * With `lock` set, only edges on that exact grid line qualify (within the
   * looser STROKE_KEEP band) — the stroke never jumps to another line.
   */
  const edgeAt = (fx: number, fy: number, lock: StrokeLine | null = null): EdgeHit | null => {
    if (lock) {
      if (lock.axis === 'h') {
        if (Math.abs(fy - lock.k) > STROKE_KEEP) return null;
        const x = Math.min(Math.max(Math.floor(fx), 0), cols - 1);
        return hEdgeHit(x, lock.k);
      }
      if (Math.abs(fx - lock.k) > STROKE_KEEP) return null;
      const y = Math.min(Math.max(Math.floor(fy), 0), rows - 1);
      return vEdgeHit(lock.k, y);
    }

    const vx = Math.round(fx); // nearest vertical grid line
    const hy = Math.round(fy); // nearest horizontal grid line
    const halfAlong = EDGE_ACTIVE / 2;
    // Normalized ellipse score: <= 1 means inside the hitbox, lower = closer.
    const score = (dPerp: number, dAlong: number) =>
      (dPerp / EDGE_SNAP) ** 2 + (dAlong / halfAlong) ** 2;

    let vScore = Infinity;
    const vy = Math.min(Math.max(Math.floor(fy), 0), rows - 1);
    if (vx >= 1 && vx <= cols - 1) {
      vScore = score(Math.abs(fx - vx), Math.abs(fy - (vy + 0.5)));
    }
    let hScore = Infinity;
    const hx = Math.min(Math.max(Math.floor(fx), 0), cols - 1);
    if (hy >= 1 && hy <= rows - 1) {
      hScore = score(Math.abs(fy - hy), Math.abs(fx - (hx + 0.5)));
    }

    if (Math.min(vScore, hScore) > 1) return null;
    return vScore <= hScore ? vEdgeHit(vx, vy) : hEdgeHit(hx, hy);
  };

  const applyAt = (fx: number, fy: number) => {
    if (tool === 'wall' || tool === 'floor') {
      const edge = edgeAt(fx, fy, axisLock ? strokeLineRef.current : null);
      if (!edge) return;
      // First edge of the stroke decides the line every later sample sticks to.
      strokeLineRef.current ??= edge.x1 === edge.x2
        ? { axis: 'v', k: edge.x1 }
        : { axis: 'h', k: edge.y1 };
      if (tool === 'wall') {
        if (wallEdges.has(edge.id)) return;
        setWallEdges((prev) => new Set(prev).add(edge.id));
      } else {
        if (!wallEdges.has(edge.id)) return;
        setWallEdges((prev) => { const next = new Set(prev); next.delete(edge.id); return next; });
      }
      return;
    }

    const x = Math.floor(fx);
    const y = Math.floor(fy);
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    const isStart = start.x === x && start.y === y;
    const isGoal = goal.x === x && goal.y === y;
    if (tool === 'start' && !isStart && !isGoal) setStart({ x, y });
    if (tool === 'goal' && !isStart && !isGoal) setGoal({ x, y });
  };

  const updateHover = (fx: number, fy: number) => {
    const edge = (tool === 'wall' || tool === 'floor')
      ? edgeAt(fx, fy, axisLock ? strokeLineRef.current : null)
      : null;
    setHoverEdge((prev) => (prev?.id === edge?.id ? prev : edge));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeLineRef.current = null;
    const p = posFromEvent(e);
    if (!p) return;
    lastPosRef.current = p;
    applyAt(p.fx, p.fy);
    updateHover(p.fx, p.fy);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = posFromEvent(e);
    if (!p) return;
    updateHover(p.fx, p.fy);
    if (!draggingRef.current) return;
    // Sample the stroke so fast drags paint every edge they cross.
    const last = lastPosRef.current ?? p;
    const dist = Math.hypot(p.fx - last.fx, p.fy - last.fy);
    const steps = Math.max(1, Math.ceil(dist / DRAG_STEP));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      applyAt(last.fx + (p.fx - last.fx) * t, last.fy + (p.fy - last.fy) * t);
    }
    lastPosRef.current = p;
  };

  const stopDragging = () => {
    draggingRef.current = false;
    lastPosRef.current = null;
    strokeLineRef.current = null;
  };

  const onPointerLeave = () => setHoverEdge(null);

  // The ghost is only shown where the tool would actually change something.
  const previewWall: MazeWallPreview | null = useMemo(() => {
    if (!hoverEdge) return null;
    const exists = wallEdges.has(hoverEdge.id);
    if (tool === 'wall' && !exists) return { ...hoverEdge, kind: 'add' };
    if (tool === 'floor' && exists) return { ...hoverEdge, kind: 'remove' };
    return null;
  }, [hoverEdge, tool, wallEdges]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const resize = (nextCols: number, nextRows: number) => {
    if (nextCols === cols && nextRows === rows) return;
    // Keep edges that still fit; clamp the markers into the new bounds.
    setWallEdges((prev) => {
      const kept = new Set<number>();
      const hCount = cols * (rows - 1);
      prev.forEach((id) => {
        if (id < hCount) {
          const x = id % cols;
          const y = Math.floor(id / cols);
          if (x < nextCols && y < nextRows - 1) kept.add(hEdgeId(x, y, nextCols));
        } else {
          const r = id - hCount;
          const x = r % (cols - 1);
          const y = Math.floor(r / (cols - 1));
          if (x < nextCols - 1 && y < nextRows) kept.add(vEdgeId(x, y, nextCols, nextRows));
        }
      });
      return kept;
    });
    setStart((s) => ({ x: Math.min(s.x, nextCols - 1), y: Math.min(s.y, nextRows - 1) }));
    setGoal((g) => ({ x: Math.min(g.x, nextCols - 1), y: Math.min(g.y, nextRows - 1) }));
    setCols(nextCols);
    setRows(nextRows);
  };

  const handleExperiment = () => {
    onExperiment({ cols, rows, walls: grid.walls, start, goal });
  };

  const handleSave = () => {
    saveMaze({ cols, rows, walls: grid.walls, start, goal }, nameDraft);
    setNaming(false);
    setNameDraft('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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

      <div className="maze-layout maze-layout--wide-side">
        {/* The stylesheet's width cap assumes a square maze; correct it by the
            aspect ratio so tall mazes still fit the viewport height. */}
        <div
          className="maze-map-col"
          style={{ maxWidth: `min(100%, calc((100dvh - 160px) * ${cols / rows}))` }}
        >
          <div
            ref={wrapRef}
            className="maze-paint-surface"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onPointerLeave={onPointerLeave}
          >
            <MazeCanvas
              cols={cols}
              rows={rows}
              walls={grid.walls}
              start={start}
              goal={goal}
              previewWall={previewWall}
              showGrid
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
            <Switch
              checked={axisLock}
              onChange={setAxisLock}
              label="Straight-line strokes"
              title="Each stroke only draws along the grid line it starts on — no stray sideways walls from a wobbly finger."
            />
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Grid</div>
            <SliderRow
              label="Width" value={cols}
              min={MIN_SIZE} max={MAX_SIZE} step={1} format={String}
              onChange={(v) => resize(Math.round(v), rows)}
            />
            <SliderRow
              label="Height" value={rows}
              min={MIN_SIZE} max={MAX_SIZE} step={1} format={String}
              onChange={(v) => resize(cols, Math.round(v))}
            />
            <div className="maze-toolbar">
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`btn btn--sm ${cols === s && rows === s ? 'btn--active' : 'btn--ghost'}`}
                  onClick={() => resize(s, s)}
                >
                  {s}×{s}
                </button>
              ))}
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setWallEdges(new Set())}
                disabled={wallEdges.size === 0}
              >
                🧹 Clear walls
              </button>
            </div>
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Status</div>
            {exceedsGenome && (
              <p className="maze-note maze-note--warn">
                ⚠ The shortest path ({geo.shortestFromStart} steps) is longer
                than an EA genome ({MAX_PATH_LENGTH} moves) — the EA can never
                reach the goal. Open a shortcut or shrink the maze.
              </p>
            )}
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
            {naming ? (
              <div className="maze-row">
                <input
                  className="maze-input"
                  placeholder="Maze name (optional)"
                  value={nameDraft}
                  autoFocus
                  spellCheck={false}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setNaming(false);
                  }}
                />
                <button className="btn btn--primary btn--sm" onClick={handleSave}>
                  Save
                </button>
              </div>
            ) : (
              <button
                className="btn btn--ghost btn--block"
                disabled={!reachable}
                onClick={() => setNaming(true)}
              >
                {savedFlash ? '✓ Saved to your mazes' : '💾 Save maze'}
              </button>
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
