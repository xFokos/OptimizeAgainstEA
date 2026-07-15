import type { MapConfig, Minimum, ProblemInstance } from '../types/map';
import { MAP_SIZES, DEFAULT_MAP_SIZE } from './mapCodec';
import { isWithinRadius } from './geometry';

/**
 * Range for the randomised floor applied to each local minimum that has no
 * explicit `floor` set. Each such minimum gets a random floor in [MIN, MAX]
 * seeded from its position, so the same map code always produces the same
 * floors.
 *
 * Floors are fractions of the map's `basinScale`, not absolute distances: a
 * local minimum should be just as deceptive on a Huge map (narrow basins) as on
 * a Small one (wide basins), and an absolute floor would make it read as a
 * shallow dimple on the former and a deep trap on the latter.
 *
 * LOCAL_MIN_FLOOR_MIN — closest a local min can feel to the global (more deceptive)
 * LOCAL_MIN_FLOOR_MAX — furthest a local min can feel from the global (easier to dismiss)
 */
export const LOCAL_MIN_FLOOR_MIN = 0.18;
export const LOCAL_MIN_FLOOR_MAX = 0.55;

/** The basin scale a map falls back to when it doesn't carry one (legacy codes). */
export const FALLBACK_BASIN_SCALE = MAP_SIZES[DEFAULT_MAP_SIZE].basinScale;

/** How steeply the surface climbs once you're outside a basin (see `evaluate`). */
export const FAR_FALLOFF = 1.3;

/**
 * Widest blend used by the smooth minimum that merges the minima's cones, in
 * normalized map units.
 *
 * A plain `min()` over the cones is not differentiable where two of them meet:
 * the surface creases along every Voronoi boundary, so the value — and the
 * colour, and the gradient the player and the EA are both reading — changes
 * direction abruptly at a line that corresponds to nothing on the map. Blending
 * the cones instead rounds those seams into saddles, so values shift
 * continuously everywhere.
 *
 * This is only the ceiling. The blend actually used is capped against how
 * tightly the map is packed (see SMOOTH_SPACING_FRACTION), because a blend wider
 * than the gap between two minima doesn't smooth them — it dissolves them into
 * one blob, and a Huge map's whole point is that its basins are distinct.
 *
 * Larger = softer, rounder terrain. 0 would restore the old hard creases.
 */
export const SMOOTH_K = 0.12;

/**
 * Share of a map's tightest minimum-to-minimum gap that the blend may span.
 * Below ~0.6 the seams start to read as creases again; above it, neighbouring
 * basins begin to merge.
 */
const SMOOTH_SPACING_FRACTION = 0.6;

/**
 * Polynomial smooth minimum (Quilez): equals min(a, b) once the two are more
 * than k apart, and rounds the join within k. Cheap — no exp/log — which matters
 * because this runs once per minimum per pixel of the heatmap.
 */
function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Cheap deterministic hash into [0, 1) — seeds per-minimum randomness from position */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The position-seeded pseudo-random floor a local minimum gets when the
 * creator hasn't set one explicitly, as a fraction of the basin scale. Exposed
 * so the create UI can show the effective depth of untouched nodes.
 */
export function defaultLocalFloor(position: { x: number; y: number }): number {
  const t = pseudoRandom(position.x * 1000 + position.y);
  return LOCAL_MIN_FLOOR_MIN + t * (LOCAL_MIN_FLOOR_MAX - LOCAL_MIN_FLOOR_MIN);
}

/**
 * The floor actually used for a minimum, in map units: 0 for the global,
 * otherwise its fractional depth scaled by the map's basin scale.
 */
export function effectiveFloor(minimum: Minimum, basinScale: number): number {
  if (minimum.isGlobal) return 0;
  return (minimum.floor ?? defaultLocalFloor(minimum.position)) * basinScale;
}

/**
 * Builds a playable surface out of a map's minima.
 *
 * Raw surface: every point takes the value of the nearest minimum's cone,
 * `min over minima of (distance + floor)`, the minima blended with a smooth
 * minimum (see SMOOTH_K) so the terrain has no creases and the global minimum
 * is the single deepest point.
 *
 * That raw distance is then mapped to [0, 1) against the map's own `basinScale`
 * — an *absolute* reference, not the surface's min/max. This is what fixes a
 * basin's size to the map it lives on: colour at a point depends only on how far
 * that point is from a mountain, measured in basin widths, so one mountain looks
 * identical whether it has three neighbours or twenty-five. (Rescaling to the
 * surface's own range, the obvious thing to do, quietly couples the two: pack in
 * more minima and nowhere is left far from anything, the range collapses, and
 * every basin shrinks to keep the colours spread.)
 *
 * The mapping saturates rather than clips, so there's no flat plateau of the
 * worst colour and the far field keeps a usable gradient. It is monotone in
 * distance, so it moves no optimum and changes nothing for the EA beyond the
 * scale of the fitness numbers, and it is deterministic in `config`, so the main
 * thread and the EA worker build identical surfaces.
 */
export function createMapProblem(config: MapConfig): ProblemInstance {
  const globalMin = config.minima.find((m) => m.isGlobal);
  const basinScale = config.basinScale ?? FALLBACK_BASIN_SCALE;

  // Resolve the floor for each minimum once (explicit, default, or 0 for global)
  const floorMap = new Map<string, number>();
  for (const minimum of config.minima) {
    floorMap.set(minimum.id, effectiveFloor(minimum, basinScale));
  }

  if (config.minima.length === 0) {
    return {
      evaluate: () => 1,
      bounds: config.bounds,
      isWin: () => false,
      metadata: { name: `Map ${config.id}` },
    };
  }

  // Flattened once — the heatmap calls this a million times, and walking a Map
  // per minimum per pixel is the one hot loop on the board.
  const cones = config.minima.map((m) => ({
    x: m.position.x,
    y: m.position.y,
    floor: floorMap.get(m.id) ?? LOCAL_MIN_FLOOR_MIN,
  }));

  const surfaceAt = (k: number) => (x: number, y: number): number => {
    let value = Infinity;
    for (const cone of cones) {
      const dx = x - cone.x;
      const dy = y - cone.y;
      const v  = Math.sqrt(dx * dx + dy * dy) + cone.floor;
      value = value === Infinity ? v : smoothMin(value, v, k);
    }
    return value;
  };

  // Start from a blend that suits how tightly this particular map is packed: no
  // wider than a fraction of its closest pair of minima, so a dense map keeps its
  // basins separate while a sparse one gets the full smoothing.
  let closestPair = Infinity;
  for (let i = 0; i < cones.length; i++) {
    for (let j = i + 1; j < cones.length; j++) {
      const d = Math.hypot(cones[i].x - cones[j].x, cones[i].y - cones[j].y);
      if (d < closestPair) closestPair = d;
    }
  }
  let smoothK = Number.isFinite(closestPair)
    ? Math.min(SMOOTH_K, closestPair * SMOOTH_SPACING_FRACTION)
    : SMOOTH_K;

  // Then back it off further if it would break the map. Smoothing pulls a basin
  // *below* its own floor wherever neighbouring cones are within k, and the dip
  // compounds where several crowd together — enough of it and a cluster of
  // shallow local minima sinks under the global one. That would be the cruellest
  // possible bug: the player stands on the lowest reading on the board and
  // doesn't win. So halve the blend until the global minimum is once again
  // strictly the deepest point of the surface.
  let rawEvaluate = surfaceAt(smoothK);
  if (globalMin) {
    const depths = () => config.minima.map((m) => rawEvaluate(m.position.x, m.position.y));
    const globalIndex = config.minima.indexOf(globalMin);
    while (smoothK > 1e-3) {
      const d = depths();
      const globalDepth = d[globalIndex];
      if (d.every((v, i) => i === globalIndex || v > globalDepth)) break;
      smoothK /= 2;
      rawEvaluate = surfaceAt(smoothK);
    }
  }

  // Floor of the surface: the deepest minimum centre (which smoothing may have
  // pushed a little below its own floor), so the summit still reads 0.
  const rawMin = Math.min(...config.minima.map((m) => rawEvaluate(m.position.x, m.position.y)));

  // Distance (in basin widths) → value, by exponential saturation:
  //   0 basins away → 0.00  (the summit)
  //   1 basin  away → 0.50  (the basin rim — the middle of the colour ramp)
  //   2            → 0.82
  //   3            → 0.95   (empty ground)
  // Approaches 1 without ever reaching it, so the far field is never a flat slab
  // of the worst colour and always slopes *somewhere*. FAR_FALLOFF bends how
  // hard it climbs once you are outside a basin: at 1.0 the open ground between
  // mountains never gets past orange and the whole board reads green; much above
  // 1.3 and it saturates to red almost as soon as you leave a rim.
  //
  // Nothing in here consults the map's own value range, which is precisely why
  // adding minima no longer resizes them.
  const evaluate = (x: number, y: number): number => {
    const basinsAway = (rawEvaluate(x, y) - rawMin) / basinScale;
    return 1 - Math.pow(2, -Math.pow(basinsAway, FAR_FALLOFF));
  };

  const isWin = (x: number, y: number): boolean => {
    if (!globalMin) return false;
    return isWithinRadius({ x, y }, globalMin.position, config.winRadius);
  };

  return {
    evaluate,
    bounds: config.bounds,
    isWin,
    metadata: {
      name: `Map ${config.id}`,
      globalMinimum: globalMin
        ? { x: globalMin.position.x, y: globalMin.position.y, value: 0 }
        : undefined,
      winRadius: config.winRadius,
    },
  };
}
