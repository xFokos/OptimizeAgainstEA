import type { SerializedMaze } from '../types/maze';

/**
 * Maze share codes — the maze twin of BattleShips' mapCodec. A maze encodes to
 * a compact URL-safe base64 string so it can be saved to the player's library
 * and pasted between browsers.
 *
 * Format (JSON → base64url):
 * { v: 1, id: string, c: cols, r: rows, s: [x, y], g: [x, y], w: hex, t: ms }
 *
 * `w` is one hex digit per cell — the cell's open-passage nibble (N/E/S/W
 * bits), row-major. 32×32 (the creator's max) is 1024 digits, well within
 * comfortable copy-paste size.
 */

const MAX_DIM = 64;

function wallsToHex(walls: Uint8Array): string {
  let out = '';
  for (let i = 0; i < walls.length; i++) out += (walls[i] & 0xf).toString(16);
  return out;
}

function hexToWalls(hex: string): Uint8Array {
  const walls = new Uint8Array(hex.length);
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i], 16);
    if (Number.isNaN(v)) throw new Error('bad wall digit');
    walls[i] = v;
  }
  return walls;
}

/**
 * Content-derived id (djb2 → base36, 6 chars): identical mazes get identical
 * ids, which is what the saved-maze library de-duplicates on.
 */
export function mazeId(maze: SerializedMaze): string {
  const s = `${maze.cols}x${maze.rows};${wallsToHex(maze.walls)};${maze.start.x},${maze.start.y};${maze.goal.x},${maze.goal.y}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

export function encodeMaze(maze: SerializedMaze): string {
  const payload = {
    v: 1,
    id: mazeId(maze),
    c: maze.cols,
    r: maze.rows,
    s: [maze.start.x, maze.start.y],
    g: [maze.goal.x, maze.goal.y],
    w: wallsToHex(maze.walls),
    t: Date.now(),
  };
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a maze code back into a SerializedMaze. Throws if invalid. */
export function decodeMaze(code: string): SerializedMaze {
  try {
    const json = atob(code.trim().replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json);
    if (p.v !== 1) throw new Error('unknown version');

    const cols = p.c, rows = p.r;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)
      || cols < 2 || rows < 2 || cols > MAX_DIM || rows > MAX_DIM) throw new Error('bad dims');
    if (typeof p.w !== 'string' || p.w.length !== cols * rows) throw new Error('bad walls');

    const inBounds = (c: unknown): c is [number, number] =>
      Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1])
      && c[0] >= 0 && c[0] < cols && c[1] >= 0 && c[1] < rows;
    if (!inBounds(p.s) || !inBounds(p.g)) throw new Error('bad markers');

    return {
      cols,
      rows,
      walls: hexToWalls(p.w),
      start: { x: p.s[0], y: p.s[1] },
      goal: { x: p.g[0], y: p.g[1] },
    };
  } catch {
    throw new Error('Invalid maze code');
  }
}
