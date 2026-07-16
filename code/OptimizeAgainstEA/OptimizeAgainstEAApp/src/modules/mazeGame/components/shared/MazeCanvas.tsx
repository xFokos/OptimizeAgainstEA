import type { Cell } from '../../types/maze';
import { MOVE_WALL_BIT, cellIndex } from '../../types/maze';

export interface MazeTrail {
  points: Cell[];
  color: string;
  opacity?: number;
  width?: number;
  /** Per-segment colours (length = points.length - 1). When set, each segment
   * is stroked with its own colour instead of the single `color` — used to
   * paint the trail by a fitness field (warm = far, cool = near the goal). */
  segColors?: string[];
}

export interface MazeMarker {
  cell: Cell;
  color: string;
  radius?: number;
  /** Draw a hollow ring instead of a filled dot. */
  ring?: boolean;
}

/**
 * A moving dot (best walker, ghost individuals). Rendered with a CSS
 * transform transition so stepping cell-to-cell glides instead of teleporting.
 */
/**
 * Ghost wall segment shown under the cursor in the creator: where a wall would
 * be added, or which existing wall would be erased. Its span matches the
 * edge's clickable zone.
 */
export interface MazeWallPreview {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'add' | 'remove';
}

export interface MazeAgent {
  id: string | number;
  cell: Cell;
  color: string;
  opacity?: number;
  r?: number;
  /** Outline + glow for the highlighted agent. */
  emphasis?: boolean;
  /** Extra CSS transition appended to the position glide — e.g. an `opacity …`
   * rule so the dot fades in/out in step with its move (used to fade a probe
   * out mid-step as it crosses into the fog of war). */
  opacityTransition?: string;
}

interface MazeCanvasProps {
  cols: number;
  rows: number;
  walls: Uint8Array;
  start: Cell;
  goal: Cell;
  /** Population / player trails to overlay, drawn in order (last on top). */
  trails?: MazeTrail[];
  /** Cells drawn as solid blocks (the creator's painted walls). */
  solidCells?: Set<number>;
  /** Cell highlights drawn as filled dots (e.g. splice / mutated cells in replay). */
  markers?: MazeMarker[];
  /** Animated agent dots (drawn above walls so they always stay visible). */
  agents?: MazeAgent[];
  /** Hover ghost for the creator: wall about to be added / erased. */
  previewWall?: MazeWallPreview | null;
  /** Faint interior grid lines (creator) so the clickable cell borders are visible. */
  showGrid?: boolean;
  /** Fog of war: cell indices to hide. Their walls are not drawn and an opaque
   * tile covers them — used by Solve mode so the maze is revealed as it is
   * explored. By default the goal marker stays visible even under fog. */
  fogCells?: Set<number>;
  /** When true, a fogged goal is NOT re-drawn on top of the fog, so its location
   * stays hidden until the cell is explored. */
  hideGoalUnderFog?: boolean;
}

const WALL_COLOR = 'rgba(255, 255, 255, 0.55)';
const WALL_W = 0.12;
const SOLID_FILL = 'rgba(255, 255, 255, 0.09)';
const FOG_FILL = 'rgba(8, 10, 16, 0.96)';
const START_COLOR = '#4af0a0';

/** Cell centre in viewBox units. */
function cx(c: Cell): number { return c.x + 0.5; }
function cy(c: Cell): number { return c.y + 0.5; }

function trailPath(points: Cell[]): string {
  if (points.length === 0) return '';
  let d = `M ${cx(points[0])} ${cy(points[0])}`;
  for (let i = 1; i < points.length; i++) d += ` L ${cx(points[i])} ${cy(points[i])}`;
  return d;
}

/**
 * SVG maze renderer. Scales to its container via viewBox. Draws walls, the
 * start/goal markers, any number of overlaid trails (EA population spaghetti),
 * solid creator blocks, replay markers, and animated agent dots.
 */
export function MazeCanvas({
  cols, rows, walls, start, goal, trails = [], solidCells, markers = [], agents = [],
  previewWall = null, showGrid = false, fogCells, hideGoalUnderFog = false,
}: MazeCanvasProps) {
  const renderAgent = (a: MazeAgent) => (
    <g
      key={a.id}
      style={{
        transform: `translate(${cx(a.cell)}px, ${cy(a.cell)}px)`,
        transition: `transform 0.12s linear${a.opacityTransition ? `, ${a.opacityTransition}` : ''}`,
        opacity: a.opacity ?? 1,
      }}
    >
      <circle
        r={a.r ?? 0.28}
        fill={a.color}
        stroke={a.emphasis ? '#ffffff' : 'none'}
        strokeWidth={a.emphasis ? 0.08 : 0}
        style={a.emphasis ? { filter: `drop-shadow(0 0 0.3px ${a.color})` } : undefined}
      />
    </g>
  );

  // Build wall segments (closed edges only).
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = cellIndex(x, y, cols);
      // Solid blocks are drawn as filled cells; skip their edge strokes so the
      // editor view stays clean (adjacent blocks would double-stroke anyway).
      if (solidCells?.has(i)) continue;
      // Fogged cells hide their walls until explored; a revealed neighbour still
      // draws the shared edge, so corridors stay outlined at the fog boundary.
      if (fogCells?.has(i)) continue;
      const w = walls[i];
      if (!(w & MOVE_WALL_BIT[0])) segs.push({ x1: x, y1: y, x2: x + 1, y2: y });         // N
      if (!(w & MOVE_WALL_BIT[1])) segs.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 }); // E
      if (!(w & MOVE_WALL_BIT[2])) segs.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 }); // S
      if (!(w & MOVE_WALL_BIT[3])) segs.push({ x1: x, y1: y, x2: x, y2: y + 1 });         // W
    }
  }

  return (
    <div className="maze-canvas" style={{ aspectRatio: `${cols} / ${rows}` }}>
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Faint interior grid (creator) — shows where walls can be placed. */}
        {showGrid && (
          <g stroke="rgba(255, 255, 255, 0.10)" strokeWidth={0.025}>
            {Array.from({ length: cols - 1 }, (_, i) => (
              <line key={`gv${i}`} x1={i + 1} y1={0} x2={i + 1} y2={rows} />
            ))}
            {Array.from({ length: rows - 1 }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={i + 1} x2={cols} y2={i + 1} />
            ))}
          </g>
        )}

        {/* Solid wall blocks (creator mode) */}
        {solidCells && (
          <g fill={SOLID_FILL}>
            {Array.from(solidCells, (i) => (
              <rect key={i} x={i % cols} y={Math.floor(i / cols)} width={1} height={1} />
            ))}
          </g>
        )}

        {/* Start & goal markers. A fogged goal isn't drawn here at all (the fog
            is only ~opaque, so it would bleed through) — it is re-drawn on top of
            the fog below unless `hideGoalUnderFog` keeps it hidden. */}
        <rect
          x={start.x + 0.18} y={start.y + 0.18} width={0.64} height={0.64} rx={0.12}
          fill={START_COLOR} opacity={0.85}
        />
        {!fogCells?.has(cellIndex(goal.x, goal.y, cols)) && (
          <rect
            x={goal.x + 0.12} y={goal.y + 0.12} width={0.76} height={0.76} rx={0.14}
            fill="var(--accent-global)" opacity={0.95}
          />
        )}

        {/* Trails — a single stroked path, unless per-segment colours are given
            (fitness-painted), in which case each segment is stroked on its own. */}
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {trails.map((t, idx) =>
            t.segColors
              ? t.points.slice(1).map((p, i) => (
                  <line
                    key={`${idx}-${i}`}
                    x1={cx(t.points[i])} y1={cy(t.points[i])}
                    x2={cx(p)} y2={cy(p)}
                    stroke={t.segColors![i] ?? t.color}
                    strokeWidth={t.width ?? 0.12}
                    opacity={t.opacity ?? 1}
                  />
                ))
              : (
                <path
                  key={idx}
                  d={trailPath(t.points)}
                  stroke={t.color}
                  strokeWidth={t.width ?? 0.12}
                  opacity={t.opacity ?? 1}
                />
              ),
          )}
        </g>

        {/* Cell markers (splice / mutated cells) */}
        {markers.map((m, i) => (
          <circle
            key={i}
            cx={cx(m.cell)}
            cy={cy(m.cell)}
            r={m.radius ?? 0.22}
            fill={m.ring ? 'none' : m.color}
            stroke={m.ring ? m.color : 'rgba(0,0,0,0.5)'}
            strokeWidth={m.ring ? 0.1 : 0.04}
          />
        ))}

        {/* Fog of war (Solve mode): opaque tiles over unexplored cells, drawn
            above trails/markers. Unless `hideGoalUnderFog` is set, the goal is
            re-drawn on top so its location stays visible even while fogged. */}
        {fogCells && fogCells.size > 0 && (
          <>
            <g fill={FOG_FILL}>
              {Array.from(fogCells, (i) => (
                <rect key={`fog${i}`} x={i % cols} y={Math.floor(i / cols)} width={1} height={1} />
              ))}
            </g>
            {!hideGoalUnderFog && fogCells.has(cellIndex(goal.x, goal.y, cols)) && (
              <rect
                x={goal.x + 0.12} y={goal.y + 0.12} width={0.76} height={0.76} rx={0.14}
                fill="var(--accent-global)" opacity={0.95}
              />
            )}
          </>
        )}

        {/* Walls (drawn on top so trails read as "inside" corridors) */}
        <g stroke={WALL_COLOR} strokeWidth={WALL_W} strokeLinecap="round">
          {segs.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          ))}
        </g>

        {/* Hover ghost wall (creator) */}
        {previewWall && (
          <line
            x1={previewWall.x1} y1={previewWall.y1}
            x2={previewWall.x2} y2={previewWall.y2}
            stroke={previewWall.kind === 'add' ? 'rgba(122, 162, 255, 0.9)' : 'rgba(255, 107, 107, 0.9)'}
            strokeWidth={WALL_W}
            strokeLinecap="round"
            strokeDasharray="0.16 0.14"
            pointerEvents="none"
          />
        )}

        {/* Animated agents (above fog) — a transform transition glides them. */}
        <g>{agents.map(renderAgent)}</g>
      </svg>
    </div>
  );
}
