/**
 * Marching Squares — produces SVG polyline point strings for a set of iso-levels.
 *
 * The grid is sampled at `resolution × resolution` points over the [0,1]² space.
 * Each iso-level gets back an array of line segments as [x1,y1,x2,y2] tuples
 * in the same [0,1]² normalized coordinate space.
 */

export interface ContourSegment {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface ContourLevel {
  level: number;
  segments: ContourSegment[];
}

type EvalFn = (x: number, y: number) => number;

// Linear interpolation helper
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Build contour line segments for each requested iso-level.
 * @param evaluate   The surface function, returns values in [0,1]
 * @param levels     Iso-values to trace, e.g. [0.1, 0.2, 0.3, …]
 * @param resolution Grid density — higher = smoother but slower (default 80)
 */
export function buildContours(
  evaluate: EvalFn,
  levels: number[],
  resolution: number = 80,
): ContourLevel[] {
  const step = 1 / resolution;

  // Sample the grid once
  const grid: number[][] = [];
  for (let row = 0; row <= resolution; row++) {
    grid[row] = [];
    for (let col = 0; col <= resolution; col++) {
      grid[row][col] = evaluate(col * step, row * step);
    }
  }

  return levels.map((level) => {
    const segments: ContourSegment[] = [];

    for (let row = 0; row < resolution; row++) {
      for (let col = 0; col < resolution; col++) {
        // Corner values of this cell
        const tl = grid[row][col];
        const tr = grid[row][col + 1];
        const bl = grid[row + 1][col];
        const br = grid[row + 1][col + 1];

        // Corner coordinates in [0,1] space
        const x0 = col * step,       y0 = row * step;
        const x1 = (col + 1) * step, y1 = (row + 1) * step;

        // Marching squares case index
        const idx =
          (tl < level ? 8 : 0) |
          (tr < level ? 4 : 0) |
          (br < level ? 2 : 0) |
          (bl < level ? 1 : 0);

        if (idx === 0 || idx === 15) continue; // fully outside or inside

        // Interpolated edge crossing points
        // Top edge    (tl → tr)
        const topT  = (level - tl) / (tr - tl);
        const top   = { x: lerp(x0, x1, topT), y: y0 };
        // Right edge  (tr → br)
        const rightT = (level - tr) / (br - tr);
        const right  = { x: x1, y: lerp(y0, y1, rightT) };
        // Bottom edge (bl → br)
        const botT  = (level - bl) / (br - bl);
        const bot   = { x: lerp(x0, x1, botT), y: y1 };
        // Left edge   (tl → bl)
        const leftT = (level - tl) / (bl - tl);
        const left  = { x: x0, y: lerp(y0, y1, leftT) };

        // Emit segments based on case
        const push = (a: {x:number,y:number}, b: {x:number,y:number}) =>
          segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

        switch (idx) {
          case 1:  case 14: push(left, bot);   break;
          case 2:  case 13: push(bot,  right);  break;
          case 3:  case 12: push(left, right);  break;
          case 4:  case 11: push(top,  right);  break;
          case 5:            push(left, top); push(bot, right); break;
          case 6:  case 9:  push(top,  bot);   break;
          case 7:  case 8:  push(left, top);   break;
          case 10:           push(top, right); push(left, bot); break;
        }
      }
    }

    return { level, segments };
  });
}
