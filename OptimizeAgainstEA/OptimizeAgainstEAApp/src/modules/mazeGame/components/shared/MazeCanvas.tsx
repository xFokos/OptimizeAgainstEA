import type { Cell } from '../../types/maze';
import { MOVE_WALL_BIT, cellIndex } from '../../types/maze';

export interface MazeTrail {
  points: Cell[];
  color: string;
  opacity?: number;
  width?: number;
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
}

const WALL_COLOR = 'rgba(255, 255, 255, 0.55)';
const WALL_W = 0.12;
const SOLID_FILL = 'rgba(255, 255, 255, 0.09)';
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
  previewWall = null, showGrid = false,
}: MazeCanvasProps) {
  // Build wall segments (closed edges only).
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = cellIndex(x, y, cols);
      // Solid blocks are drawn as filled cells; skip their edge strokes so the
      // editor view stays clean (adjacent blocks would double-stroke anyway).
      if (solidCells?.has(i)) continue;
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

        {/* Start & goal markers */}
        <rect
          x={start.x + 0.18} y={start.y + 0.18} width={0.64} height={0.64} rx={0.12}
          fill={START_COLOR} opacity={0.85}
        />
        <rect
          x={goal.x + 0.12} y={goal.y + 0.12} width={0.76} height={0.76} rx={0.14}
          fill="var(--accent-global)" opacity={0.95}
        />

        {/* Trails */}
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {trails.map((t, idx) => (
            <path
              key={idx}
              d={trailPath(t.points)}
              stroke={t.color}
              strokeWidth={t.width ?? 0.12}
              opacity={t.opacity ?? 1}
            />
          ))}
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

        {/* Animated agents — a transform transition glides them between cells. */}
        <g>
          {agents.map((a) => (
            <g
              key={a.id}
              style={{
                transform: `translate(${cx(a.cell)}px, ${cy(a.cell)}px)`,
                transition: 'transform 0.12s linear',
              }}
              opacity={a.opacity ?? 1}
            >
              <circle
                r={a.r ?? 0.28}
                fill={a.color}
                stroke={a.emphasis ? '#ffffff' : 'none'}
                strokeWidth={a.emphasis ? 0.08 : 0}
                style={a.emphasis ? { filter: `drop-shadow(0 0 0.3px ${a.color})` } : undefined}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
