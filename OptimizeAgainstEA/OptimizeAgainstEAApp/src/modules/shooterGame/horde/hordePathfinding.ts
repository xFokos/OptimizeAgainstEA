import { ARENA } from '../shooter.types';
import type { HordeObstacle } from './hordeTypes';

// A coarse flow field (a.k.a. Dijkstra map): BFS once from the player's cell over a grid
// derived from the map's obstacles, then every free cell gets a direction pointing toward
// whichever neighbor is one step closer. Agents just look their own cell up — O(1) per
// agent per frame — instead of each running their own pathfinding search. In open space
// (no obstacles between a cell and the player) this degenerates to the straight-line
// direction, so it's a no-op on the default Open map or whenever there's clear line of sight.

const CELL_SIZE  = 25;                          // px — 800 / 25 = 32, a clean grid over the (square) ARENA
const GRID_COLS  = ARENA.WIDTH  / CELL_SIZE;
const GRID_ROWS  = ARENA.HEIGHT / CELL_SIZE;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

// Inflate obstacles by roughly the largest possible agent radius so the routed path always
// leaves clearance — smaller agents just get a bit of extra margin, which is harmless.
const INFLATE = 24;

const NEIGHBORS: readonly [number, number][] = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function cellIndex(col: number, row: number): number {
    return row * GRID_COLS + col;
}

function worldToCell(x: number, y: number): { col: number; row: number } {
    return {
        col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / CELL_SIZE))),
        row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / CELL_SIZE))),
    };
}

// Allocation-free version of worldToCell + cellIndex combined — used by sampleFlowField,
// which runs once per agent per frame (worldToCell's object literal would otherwise add
// one small allocation per agent per frame).
function cellIndexAt(x: number, y: number): number {
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / CELL_SIZE)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / CELL_SIZE)));
    return row * GRID_COLS + col;
}

function buildOccupancy(obstacles: HordeObstacle[]): Uint8Array {
    const blocked = new Uint8Array(CELL_COUNT);
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const cx = col * CELL_SIZE + CELL_SIZE / 2;
            const cy = row * CELL_SIZE + CELL_SIZE / 2;
            for (const o of obstacles) {
                if (cx > o.x - INFLATE && cx < o.x + o.w + INFLATE &&
                    cy > o.y - INFLATE && cy < o.y + o.h + INFLATE) {
                    blocked[cellIndex(col, row)] = 1;
                    break;
                }
            }
        }
    }
    return blocked;
}

// Obstacles are static for a whole run (state.map is fixed once a game starts), so the
// occupancy grid only needs to be built once per map — keyed by the obstacles array
// reference, which stays identical for the run's lifetime.
const occupancyCache = new WeakMap<HordeObstacle[], Uint8Array>();
function getOccupancy(obstacles: HordeObstacle[]): Uint8Array {
    let grid = occupancyCache.get(obstacles);
    if (!grid) {
        grid = buildOccupancy(obstacles);
        occupancyCache.set(obstacles, grid);
    }
    return grid;
}

// Reused across frames — the BFS itself runs every frame (the grid is tiny, this is cheap),
// but none of it needs to allocate.
const distScratch  = new Int32Array(CELL_COUNT);
const queueScratch = new Int32Array(CELL_COUNT);
const dirXScratch  = new Float32Array(CELL_COUNT);
const dirYScratch  = new Float32Array(CELL_COUNT);
const hasScratch   = new Uint8Array(CELL_COUNT);

export interface FlowField {
    dirX: Float32Array;
    dirY: Float32Array;
    has:  Uint8Array;
}

export function computeFlowField(obstacles: HordeObstacle[], targetX: number, targetY: number): FlowField {
    const occ = getOccupancy(obstacles);
    distScratch.fill(-1);
    hasScratch.fill(0);

    const { col: tc, row: tr } = worldToCell(targetX, targetY);
    const startIdx = cellIndex(tc, tr);
    if (!occ[startIdx]) {
        let qHead = 0, qTail = 0;
        distScratch[startIdx] = 0;
        queueScratch[qTail++] = startIdx;

        while (qHead < qTail) {
            const idx = queueScratch[qHead++];
            const row = Math.floor(idx / GRID_COLS);
            const col = idx - row * GRID_COLS;
            const d    = distScratch[idx];

            for (const [dc, dr] of NEIGHBORS) {
                const nc = col + dc, nr = row + dr;
                if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
                const nIdx = cellIndex(nc, nr);
                if (occ[nIdx] || distScratch[nIdx] !== -1) continue;
                // Don't let the path cut across a blocked corner diagonally.
                if (dc !== 0 && dr !== 0 && (occ[cellIndex(col + dc, row)] || occ[cellIndex(col, row + dr)])) continue;
                distScratch[nIdx] = d + 1;
                queueScratch[qTail++] = nIdx;
            }
        }

        // Derive each free cell's flow direction: point toward whichever reached neighbor is closer.
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const idx = cellIndex(col, row);
                if (occ[idx] || distScratch[idx] === -1) continue;
                if (distScratch[idx] === 0) { hasScratch[idx] = 1; continue; } // the player's own cell

                let bestDist = distScratch[idx];
                let bestDc = 0, bestDr = 0;
                for (const [dc, dr] of NEIGHBORS) {
                    const nc = col + dc, nr = row + dr;
                    if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
                    const nd = distScratch[cellIndex(nc, nr)];
                    if (nd !== -1 && nd < bestDist) { bestDist = nd; bestDc = dc; bestDr = dr; }
                }
                if (bestDist < distScratch[idx]) {
                    const len = Math.sqrt(bestDc * bestDc + bestDr * bestDr);
                    dirXScratch[idx] = bestDc / len;
                    dirYScratch[idx] = bestDr / len;
                    hasScratch[idx]  = 1;
                }
            }
        }
    }

    return { dirX: dirXScratch, dirY: dirYScratch, has: hasScratch };
}

// Reused across calls (see cellIndexAt's doc comment) — safe because every caller reads
// .x/.y synchronously right after calling and never holds onto the reference.
const sampleScratch = { x: 0, y: 0 };

export function sampleFlowField(field: FlowField, x: number, y: number): { x: number; y: number } | null {
    const idx = cellIndexAt(x, y);
    if (!field.has[idx]) return null;
    sampleScratch.x = field.dirX[idx];
    sampleScratch.y = field.dirY[idx];
    return sampleScratch;
}
