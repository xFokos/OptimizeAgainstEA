import type { Cell } from '../../types/maze';
import { MOVE_WALL_BIT, cellIndex } from '../../types/maze';

export interface MazeTrail {
  points: Cell[];
  color: string;
  opacity?: number;
  width?: number;
}

interface MazeCanvasProps {
  cols: number;
  rows: number;
  walls: Uint8Array;
  start: Cell;
  goal: Cell;
  /** Population / player trails to overlay, drawn in order (last on top). */
  trails?: MazeTrail[];
  /**
   * Fog-of-war: if provided, only these cell indices are revealed; everything
   * else is drawn as fog and their walls are hidden.
   */
  fog?: Set<number>;
  /** Player marker cell. */
  playerPos?: Cell;
  /** Whether to show the goal beacon even under fog (player mode). */
  goalVisible?: boolean;
  /** Cell highlights drawn as filled dots (e.g. splice / mutated cells in replay). */
  markers?: MazeMarker[];
}

export interface MazeMarker {
  cell: Cell;
  color: string;
  radius?: number;
  /** Draw a hollow ring instead of a filled dot. */
  ring?: boolean;
}

const WALL_COLOR = 'rgba(255,255,255,0.55)';
const WALL_W = 0.12;

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
 * start/goal markers, any number of overlaid trails (EA population spaghetti or
 * the player route), and — when `fog` is supplied — hides unrevealed cells.
 */
export function MazeCanvas({
  cols, rows, walls, start, goal, trails = [], fog, playerPos, goalVisible = true, markers = [],
}: MazeCanvasProps) {
  const revealed = (i: number) => !fog || fog.has(i);

  // Build wall segments for revealed cells (closed edges only).
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = cellIndex(x, y, cols);
      if (!revealed(i)) continue;
      const w = walls[i];
      if (!(w & MOVE_WALL_BIT[0])) segs.push({ x1: x, y1: y, x2: x + 1, y2: y });       // N
      if (!(w & MOVE_WALL_BIT[1])) segs.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 }); // E
      if (!(w & MOVE_WALL_BIT[2])) segs.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 }); // S
      if (!(w & MOVE_WALL_BIT[3])) segs.push({ x1: x, y1: y, x2: x, y2: y + 1 });        // W
    }
  }

  return (
    <div style={{ width: '100%', aspectRatio: `${cols} / ${rows}`, background: '#0c0d12', borderRadius: 8 }}>
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Fog backdrop for unrevealed cells */}
        {fog && (
          <g>
            {Array.from({ length: cols * rows }, (_, i) =>
              fog.has(i) ? null : (
                <rect key={i} x={i % cols} y={Math.floor(i / cols)} width={1} height={1} fill="#070709" />
              ),
            )}
          </g>
        )}

        {/* Start & goal markers */}
        {revealed(cellIndex(start.x, start.y, cols)) && (
          <rect x={start.x + 0.18} y={start.y + 0.18} width={0.64} height={0.64} rx={0.12} fill="#4af0a0" opacity={0.85} />
        )}
        {(goalVisible || revealed(cellIndex(goal.x, goal.y, cols))) && (
          <rect x={goal.x + 0.12} y={goal.y + 0.12} width={0.76} height={0.76} rx={0.14} fill="#f0c44a" opacity={0.95} />
        )}

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

        {/* Player marker */}
        {playerPos && (
          <circle cx={cx(playerPos)} cy={cy(playerPos)} r={0.3} fill="#ffffff" stroke="#4af0a0" strokeWidth={0.08} />
        )}
      </svg>
    </div>
  );
}
