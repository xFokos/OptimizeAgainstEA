import type { ProblemInstance } from '../types/map';

/**
 * Analytic benchmark-function problems for PeakFinder.
 *
 * These are the classic 2D optimization test functions (Sphere, Rastrigin, …),
 * all *minimization* problems whose known global minimum becomes the game's
 * summit. They plug into the same `ProblemInstance` contract as hand-built maps:
 * `evaluate` returns [0,1] with 0 at the optimum, the EA minimises toward it,
 * and `valueToHeight` inverts it for the player.
 *
 * A concrete playable surface is a `FunctionSpec`: a benchmark id plus a random
 * affine transform (translate / rotate / scale / reflect). The spec fully and
 * deterministically defines the surface, so the same spec rebuilds an identical
 * problem on the main thread and inside the EA worker, and can be shared as a
 * code — exactly like a map code. "Randomise each play" = a fresh random spec.
 */

export type FunctionCategory = 'simple' | 'normal' | 'complex' | 'quirky';

interface BenchmarkFn {
  id: string;
  label: string;
  category: FunctionCategory;
  /** Raw function on its natural domain (minimization). */
  raw: (x: number, y: number) => number;
  /** Location of the global minimum in the function's own coordinates. */
  globalMin: { x: number; y: number };
  /** Half-width of the domain window shown around the optimum (zoom level). */
  viewHalfWidth: number;
  /** Per-function sharpening exponent (<1). Lower = steeper, more localized peak;
   *  flat-bowl functions (Sphere) need more, already-pointy ones (Ackley) less. */
  sharpen: number;
  /** Optional valid domain [min,max]² in the function's own coordinates. Points
   *  outside read as "far" — keeps an edge-optimum function (Eggholder) from
   *  drifting its summit off toward the domain boundary. */
  domain?: { min: number; max: number };
}

const TAU = Math.PI * 2;

// Ripple parameters for the wavy-Rosenbrock variant: α = bump amplitude,
// β = bump frequency. Small enough that the global optimum stays in the valley
// near (1, 1) while the floor becomes deceptively bumpy.
const WAVE_ALPHA = 2;
const WAVE_BETA = 3;

// ── Constants & helpers for the BBOB-derived functions below ──────────────
// These reproduce the *base shape* of each COCO/BBOB benchmark (f5–f24). The
// BBOB suite additionally rotates, conditions and offsets each one; we skip
// those because the engine already applies its own random affine transform.

/** Schwefel: the additive constant that puts its global optimum value at ~0. */
const SCHWEFEL_OPT = 420.9687;
/** Schwefel is unbounded below (it keeps diving past |x| > 500), so a gentle
 *  bowl centred on the optimum keeps (SCHWEFEL_OPT, SCHWEFEL_OPT) the unique
 *  global minimum at every zoom level — no hard domain cutoff needed. Kept small
 *  so the deceptive ripple structure stays dominant near the optimum. */
const SCHWEFEL_BOWL = 0.005;

/** Lunacek bi-Rastrigin (BBOB f24), specialised to D = 2: two-funnel constants. */
const LUNACEK_MU0 = 2.5;
const LUNACEK_D = 1;
const LUNACEK_S = 1 - 1 / (2 * Math.sqrt(2 + 20) - 8.2);
const LUNACEK_MU1 = -Math.sqrt((LUNACEK_MU0 * LUNACEK_MU0 - LUNACEK_D) / LUNACEK_S);

/** Weierstrass (BBOB f16): one axis of the fractal cosine sum. */
const WEIERSTRASS_K = 12;
function weierstrassAxis(z: number): number {
  let sum = 0;
  for (let k = 0; k < WEIERSTRASS_K; k++) {
    sum += 0.5 ** k * Math.cos(TAU * 3 ** k * (z + 0.5));
  }
  return sum;
}
/** Per-axis value at the optimum, subtracted so the global minimum sits at 0. */
const WEIERSTRASS_F0 = weierstrassAxis(0);
/** Gentle bowl that tilts the (periodic) fractal so the central optimum is the
 *  unique global one — otherwise every integer lattice point ties for the win.
 *  Raise it if the tuner shows multiple green win blobs. */
const WEIERSTRASS_BOWL = 2;

/** Katsuura (BBOB f23): one axis of the rugged fractal product. */
const KATSUURA_J = 32;
const KATSUURA_EXP = 10 / Math.pow(2, 1.2); // 10 / D^1.2 with D = 2
function katsuuraAxis(z: number, i: number): number {
  let sum = 0;
  for (let j = 1; j <= KATSUURA_J; j++) {
    const p = 2 ** j * z;
    sum += Math.abs(p - Math.round(p)) / 2 ** j;
  }
  return (1 + i * sum) ** KATSUURA_EXP;
}
/** Same role as WEIERSTRASS_BOWL — Katsuura is zero on a dense set of dyadic
 *  points, so a bowl is needed to single out the central optimum. */
const KATSUURA_BOWL = 3;

/** Gallagher 101 Peaks (BBOB f21): a deterministic field of Gaussian bumps,
 *  generated once from a fixed seed so the surface is identical on the main
 *  thread and inside the EA worker. The lone weight-10 peak at the origin is the
 *  global optimum; the rest (weight < 10) are decoys with weak global structure. */
interface Peak { x: number; y: number; w: number; c: number; }
const GALLAGHER_PEAKS: Peak[] = (() => {
  let s = 0x9e3779b9 >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const peaks: Peak[] = [{ x: 0, y: 0, w: 10, c: 1.5 }];
  for (let i = 0; i < 100; i++) {
    peaks.push({ x: (rng() * 2 - 1) * 5, y: (rng() * 2 - 1) * 5, w: 1.1 + rng() * 8, c: 0.8 + rng() * 9 });
  }
  return peaks;
})();

/** Step-Ellipsoid (BBOB f7): BBOB's two-scale rounding that builds the terraces. */
function stepRound(v: number): number {
  return Math.abs(v) > 0.5 ? Math.floor(0.5 + v) : Math.floor(0.5 + 10 * v) / 10;
}

/** Clamp to BBOB's standard [-5, 5] box (used by Linear Slope's plateau). */
const clamp5 = (v: number): number => (v < -5 ? -5 : v > 5 ? 5 : v);

export const BENCHMARK_FUNCTIONS: BenchmarkFn[] = [
  // ── Simple: smooth bowls, ridges and slopes ────────────────────────────
  {
    id: 'sphere',
    label: 'Sphere',
    category: 'simple',
    raw: (x, y) => x * x + y * y,
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 0.6,
  },
  {
    id: 'booth',
    label: 'Booth',
    category: 'simple',
    raw: (x, y) => (x + 2 * y - 7) ** 2 + (2 * x + y - 5) ** 2,
    globalMin: { x: 1, y: 3 },
    viewHalfWidth: 6,
    sharpen: 0.55,
  },
  {
    // Linear Slope (BBOB f5): a tilted plane with a flat plateau beyond the
    // [-5,5] box, so the optimum sits at a corner. Trivial — a sanity case.
    id: 'linearSlope',
    label: 'Linear Slope',
    category: 'simple',
    raw: (x, y) => 10 - clamp5(x) - clamp5(y),
    globalMin: { x: 5, y: 5 },
    viewHalfWidth: 6,
    sharpen: 1,
  },
  {
    // Sharp Ridge (BBOB f13): a smooth parabolic valley along one axis with a
    // sharp, non-smooth crease across it — the ridge must be followed to the min.
    id: 'sharpRidge',
    label: 'Sharp Ridge',
    category: 'simple',
    raw: (x, y) => x * x + 100 * Math.abs(y),
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 0.9,
  },
  {
    // Step-Ellipsoid (BBOB f7): an ill-conditioned bowl flattened into terraces,
    // so large plateaus give no gradient information.
    id: 'stepEllipsoid',
    label: 'Step-Ellipsoid',
    category: 'simple',
    raw: (x, y) => {
      const sx = stepRound(x);
      const sy = stepRound(y);
      return 0.1 * Math.max(Math.abs(sx) / 1e4, sx * sx + 100 * sy * sy);
    },
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 0.55,
  },

  // ── Normal: single curved valleys / asymmetric bowls ───────────────────
  {
    id: 'rosenbrock',
    label: 'Rosenbrock',
    category: 'normal',
    raw: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    globalMin: { x: 1, y: 1 },
    viewHalfWidth: 2.2,
    sharpen: 0.55,
  },
  {
    // Attractive Sector (BBOB f6): a bowl ~100x steeper on one side of the
    // optimum than the other — strongly asymmetric but still unimodal.
    id: 'attractiveSector',
    label: 'Attractive Sector',
    category: 'normal',
    raw: (x, y) => {
      const sx = x > 0 ? 100 : 1;
      const sy = y > 0 ? 100 : 1;
      return Math.pow((sx * x) ** 2 + (sy * y) ** 2, 0.9);
    },
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 0.3,
  },
  {
    // Bukin N.6: a razor-thin ridge along y = 0.01·x² with a single global min
    // at (-10, 1). Infamously hard — near-zero everywhere on the ridge.
    id: 'bukin6',
    label: 'Bukin N.6',
    category: 'normal',
    raw: (x, y) => 100 * Math.sqrt(Math.abs(y - 0.01 * x * x)) + 0.01 * Math.abs(x + 10),
    globalMin: { x: -10, y: 1 },
    viewHalfWidth: 5,
    sharpen: 1.4,
  },

  // ── Complex: deceptive, many local minima ──────────────────────────────
  {
    // Beale: sharp valleys radiating toward the corners; min at (3, 0.5).
    id: 'beale',
    label: 'Beale',
    category: 'complex',
    raw: (x, y) =>
      (1.5 - x + x * y) ** 2 +
      (2.25 - x + x * y * y) ** 2 +
      (2.625 - x + x * y * y * y) ** 2,
    globalMin: { x: 3, y: 0.5 },
    viewHalfWidth: 4.5,
    sharpen: 0.3,
  },
  {
    id: 'ackley',
    label: 'Ackley',
    category: 'complex',
    raw: (x, y) =>
      -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y))) -
      Math.exp(0.5 * (Math.cos(TAU * x) + Math.cos(TAU * y))) +
      20 +
      Math.E,
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 1.2,
  },
  {
    // Rosenbrock with sinusoidal ripples: the classic banana valley, but its
    // floor is corrugated, so the EA has to climb out of shallow false dips.
    id: 'rosenbrockSine',
    label: 'Rosenbrock (Wavy)',
    category: 'complex',
    raw: (x, y) =>
      (1 - x) ** 2 +
      100 * (y - x * x) ** 2 +
      WAVE_ALPHA * Math.sin(WAVE_BETA * x) * Math.sin(WAVE_BETA * y),
    globalMin: { x: 1, y: 1 },
    viewHalfWidth: 2.2,
    sharpen: 0.55,
  },
  {
    id: 'eggholder',
    label: 'Eggholder',
    category: 'complex',
    raw: (x, y) =>
      -(y + 47) * Math.sin(Math.sqrt(Math.abs(x / 2 + (y + 47)))) -
      x * Math.sin(Math.sqrt(Math.abs(x - (y + 47)))),
    globalMin: { x: 512, y: 404.2319 },
    viewHalfWidth: 256,
    sharpen: 0.8,
  },
  {
    // Schwefel (BBOB f20): deceptive — the best local optima sit far from the
    // global one, luring search toward the wrong region.
    id: 'schwefel',
    label: 'Schwefel',
    category: 'complex',
    raw: (x, y) =>
      2 * 418.9829 -
      (x * Math.sin(Math.sqrt(Math.abs(x))) + y * Math.sin(Math.sqrt(Math.abs(y)))) +
      SCHWEFEL_BOWL * ((x - SCHWEFEL_OPT) ** 2 + (y - SCHWEFEL_OPT) ** 2),
    globalMin: { x: SCHWEFEL_OPT, y: SCHWEFEL_OPT },
    viewHalfWidth: 300,
    sharpen: 1.0,
  },
  {
    // Gallagher 101 Peaks (BBOB f21): a field of 101 Gaussian bumps with weak
    // global structure; the tallest (at the origin) is the global optimum.
    id: 'gallagher',
    label: 'Gallagher 101 Peaks',
    category: 'complex',
    raw: (x, y) => {
      let max = 0;
      for (const p of GALLAGHER_PEAKS) {
        const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
        const v = p.w * Math.exp(-0.5 * p.c * d2);
        if (v > max) max = v;
      }
      return 10 - max;
    },
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5,
    sharpen: 1.25,
  },

  // ── Quirky: chaotic, multimodal, fractal or edge optima ────────────────
  {
    id: 'rastrigin',
    label: 'Rastrigin',
    category: 'quirky',
    raw: (x, y) =>
      20 + (x * x - 10 * Math.cos(TAU * x)) + (y * y - 10 * Math.cos(TAU * y)),
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 5.12,
    sharpen: 0.95,
  },
  {
    // Schaffer F7 (BBOB f17): concentric ripples whose frequency rises outward.
    id: 'schafferF7',
    label: 'Schaffer F7',
    category: 'quirky',
    raw: (x, y) => {
      const r = Math.sqrt(x * x + y * y);
      const s = Math.sqrt(r) * (1 + Math.sin(50 * Math.pow(r, 0.2)) ** 2);
      return s * s;
    },
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 4,
    sharpen: 1.0,
  },
  {
    id: 'griewank',
    label: 'Griewank',
    category: 'quirky',
    raw: (x, y) => 1 + (x * x + y * y) / 4000 - Math.cos(x) * Math.cos(y / Math.SQRT2),
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 40,
    sharpen: 1.25,
  },
  {
    // Griewank-Rosenbrock F8F2 (BBOB f19): Griewank's ripples laid over a
    // Rosenbrock valley — a long curved trough that's also locally bumpy.
    id: 'griewankRosenbrock',
    label: 'Griewank-Rosenbrock',
    category: 'quirky',
    raw: (x, y) => {
      const z1 = x + 0.5;
      const z2 = y + 0.5;
      const s = 100 * (z1 * z1 - z2) ** 2 + (z1 - 1) ** 2;
      return 10 * (s / 4000 - Math.cos(s)) + 10;
    },
    globalMin: { x: 0.5, y: 0.5 },
    viewHalfWidth: 2.5,
    sharpen: 0.7,
  },
  {
    // Lunacek bi-Rastrigin (BBOB f24): two funnels (a deep global, a shallow
    // decoy) overlaid with Rastrigin bumps — purpose-built to fool EAs.
    id: 'lunacek',
    label: 'Lunacek bi-Rastrigin',
    category: 'quirky',
    raw: (x, y) => {
      const dx0 = x - LUNACEK_MU0, dy0 = y - LUNACEK_MU0;
      const dx1 = x - LUNACEK_MU1, dy1 = y - LUNACEK_MU1;
      const funnel0 = dx0 * dx0 + dy0 * dy0;
      const funnel1 = LUNACEK_D * 2 + LUNACEK_S * (dx1 * dx1 + dy1 * dy1);
      const ripple = 10 * (2 - Math.cos(TAU * dx0) - Math.cos(TAU * dy0));
      return Math.min(funnel0, funnel1) + ripple;
    },
    globalMin: { x: LUNACEK_MU0, y: LUNACEK_MU0 },
    viewHalfWidth: 9,
    sharpen: 1.5,
  },
  {
    // Weierstrass (BBOB f16): a continuous-but-nowhere-smooth fractal, rugged at
    // every scale. The bowl term tilts its periodic minima so the centre wins.
    id: 'weierstrass',
    label: 'Weierstrass',
    category: 'quirky',
    raw: (x, y) =>
      10 * Math.pow((weierstrassAxis(x) + weierstrassAxis(y)) / 2 - WEIERSTRASS_F0, 3) +
      WEIERSTRASS_BOWL * (x * x + y * y),
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 2.5,
    sharpen: 0.8,
  },
  {
    // Katsuura (BBOB f23): an extremely rugged fractal product — even bumpier
    // than Weierstrass. The bowl term singles out the central optimum.
    id: 'katsuura',
    label: 'Katsuura',
    category: 'quirky',
    raw: (x, y) =>
      2.5 * katsuuraAxis(x, 1) * katsuuraAxis(y, 2) - 2.5 + KATSUURA_BOWL * (x * x + y * y),
    globalMin: { x: 0, y: 0 },
    viewHalfWidth: 3,
    sharpen: 1.5,
  },
];

const FN_BY_ID = new Map(BENCHMARK_FUNCTIONS.map((f) => [f.id, f]));

/** Functions grouped by difficulty band, in the panel's display order. */
export const FUNCTION_CATEGORIES: FunctionCategory[] = ['simple', 'normal', 'complex', 'quirky'];

export function functionsInCategory(cat: FunctionCategory): BenchmarkFn[] {
  return BENCHMARK_FUNCTIONS.filter((f) => f.category === cat);
}

/** A fully-resolved, shareable surface: a benchmark id + a random transform. */
export interface FunctionSpec {
  fn: string;            // benchmark id
  cx: number; cy: number; // where the optimum should appear in the [0,1] viewport
  theta: number;          // rotation (radians)
  sx: number; sy: number; // anisotropic scale (zoom)
  rx: 1 | -1; ry: 1 | -1; // reflections
}

/** Nominal radius used only to *draw* the win zone in replay overlays (winning
 *  itself is value-based — see isWin below). */
export const FUNCTION_WIN_RADIUS = 0.05;
/** Win threshold: you win once your normalized+sharpened reading is ≤ this — i.e.
 *  you've reached (essentially) the optimal value. Tight by design; raise it if a
 *  function feels unfair. "What you read is what you win", consistent across
 *  functions and not dependent on hitting an exact coordinate. */
const WIN_VALUE_EPS = 0.04;
const GRID = 64;            // sampling resolution for normalisation + win target
const NORM_PERCENTILE = 0.85; // ceiling percentile — keeps mid-range structure visible
const MARGIN = 0.18;        // keep the optimum this far from the viewport edges

/** Sentinel benchmark id meaning "pick a fresh random function every play".
 *  A spec carrying this id is not playable directly — it's resolved into a
 *  concrete random surface at load time (see resolveSpec). */
export const RANDOM_FN_ID = 'random';

/** A sentinel spec that re-randomises into a brand-new surface each time it's
 *  loaded. Encode this for a "random every time" share code; the transform
 *  fields are placeholders and get replaced on resolution. */
export function randomSurfaceSpec(): FunctionSpec {
  return { fn: RANDOM_FN_ID, cx: 0.5, cy: 0.5, theta: 0, sx: 1, sy: 1, rx: 1, ry: 1 };
}

/** Resolves a possibly-sentinel spec into a concrete, playable one. A
 *  RANDOM_FN_ID spec becomes a fresh random function + transform; any normal
 *  spec is returned unchanged. Call this once on the main thread at load time so
 *  the concrete result can be handed to the EA worker — that keeps a single play
 *  session identical across threads while still re-rolling on the next load. */
export function resolveSpec(spec: FunctionSpec, rng: () => number = Math.random): FunctionSpec {
  return spec.fn === RANDOM_FN_ID ? randomFunctionSpec(rng) : spec;
}

/** Random transform for a given (or random) benchmark function. */
export function randomFunctionSpec(
  rng: () => number = Math.random,
  opts: { id?: string; category?: FunctionCategory } = {},
): FunctionSpec {
  let pool = BENCHMARK_FUNCTIONS;
  if (opts.id) pool = BENCHMARK_FUNCTIONS.filter((f) => f.id === opts.id);
  else if (opts.category) pool = functionsInCategory(opts.category);
  const fn = pool[Math.floor(rng() * pool.length)] ?? BENCHMARK_FUNCTIONS[0];

  return {
    fn: fn.id,
    cx: MARGIN + rng() * (1 - 2 * MARGIN),
    cy: MARGIN + rng() * (1 - 2 * MARGIN),
    theta: rng() * TAU,
    sx: 0.8 + rng() * 0.5,
    sy: 0.8 + rng() * 0.5,
    rx: rng() < 0.5 ? -1 : 1,
    ry: rng() < 0.5 ? -1 : 1,
  };
}

/**
 * Builds the raw (un-normalised) evaluator that maps a viewport point in
 * [0,1]² through the spec's affine transform into the function's domain. The
 * optimum target (cx, cy) maps exactly onto the function's global minimum.
 */
function rawEvaluator(spec: FunctionSpec, fn: BenchmarkFn): (x: number, y: number) => number {
  const ca = Math.cos(spec.theta);
  const sa = Math.sin(spec.theta);
  const span = 2 * fn.viewHalfWidth;
  const dom = fn.domain;
  return (px, py) => {
    const dx = (px - spec.cx) * spec.rx * spec.sx;
    const dy = (py - spec.cy) * spec.ry * spec.sy;
    const rxr = dx * ca - dy * sa;
    const ryr = dx * sa + dy * ca;
    const ux = fn.globalMin.x + rxr * span;
    const uy = fn.globalMin.y + ryr * span;
    // Outside the function's valid domain reads as "far" (Infinity → max value),
    // so an edge-optimum function keeps its summit at the intended spot.
    if (dom && (ux < dom.min || ux > dom.max || uy < dom.min || uy > dom.max)) {
      return Infinity;
    }
    return fn.raw(ux, uy);
  };
}

/**
 * Turns a FunctionSpec into a playable ProblemInstance. Deterministic: grid-
 * samples the transformed surface once to (a) normalise output to [0,1] and
 * (b) pin the win target to the actual lowest visible point (self-correcting
 * for functions whose optimum sits off-centre or near a domain edge).
 */
export function createFunctionProblem(
  spec: FunctionSpec,
  sharpenOverride?: number,
): ProblemInstance {
  const fn = FN_BY_ID.get(spec.fn) ?? BENCHMARK_FUNCTIONS[0];
  const sharpen = sharpenOverride ?? fn.sharpen;
  const rawEval = rawEvaluator(spec, fn);

  const samples: number[] = [];
  let rawMin = Infinity;
  let best = { x: spec.cx, y: spec.cy };
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = (i + 0.5) / GRID;
      const y = (j + 0.5) / GRID;
      const v = rawEval(x, y);
      if (!Number.isFinite(v)) continue;  // out of domain → ignore for normalisation
      samples.push(v);
      if (v < rawMin) { rawMin = v; best = { x, y }; }
    }
  }
  // The transform maps (cx, cy) exactly onto the function's true global minimum,
  // so prefer that crisp location as the summit — unless the grid found a lower
  // point (only when a function has no domain and the window spills past its
  // natural range), where the grid argmin is the honest answer.
  const optVal = rawEval(spec.cx, spec.cy);
  if (Number.isFinite(optVal) && optVal <= rawMin) {
    rawMin = optVal;
    best = { x: spec.cx, y: spec.cy };
  }
  if (!Number.isFinite(rawMin)) rawMin = 0; // safety: no finite samples

  // Robust ceiling: a high percentile, so the colour ramp shows structure
  // instead of being crushed by a few extreme corner values.
  const sorted = [...samples].sort((a, b) => a - b);
  const ceil = sorted.length ? sorted[Math.floor(NORM_PERCENTILE * (sorted.length - 1))] : rawMin + 1;
  const denom = Math.max(ceil - rawMin, 1e-9);

  const evaluate = (x: number, y: number): number => {
    const raw = rawEval(x, y);
    if (!Number.isFinite(raw)) return 1; // out of domain reads as the far valley
    const v = (raw - rawMin) / denom;
    const norm = v < 0 ? 0 : v > 1 ? 1 : v;
    return Math.pow(norm, sharpen);
  };

  // Win on *value*, not exact location: you win once your reading reaches the
  // optimal value (within WIN_VALUE_EPS). This removes the "standing on the best
  // value but not winning" unfairness on functions with broad/flat optima, while
  // still keeping a single global optimum to climb toward.
  const isWin = (x: number, y: number): boolean => evaluate(x, y) <= WIN_VALUE_EPS;

  // Measure how far the win zone reaches from the summit, so replay overlays can
  // draw a ring that actually matches where winning happens.
  let winR = 1 / GRID;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = (i + 0.5) / GRID;
      const y = (j + 0.5) / GRID;
      if (evaluate(x, y) <= WIN_VALUE_EPS) {
        winR = Math.max(winR, Math.hypot(x - best.x, y - best.y));
      }
    }
  }

  return {
    evaluate,
    bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    isWin,
    metadata: {
      name: fn.label,
      globalMinimum: { x: best.x, y: best.y, value: 0 },
      winRadius: winR,
    },
  };
}

// ── Codec — a shareable code, distinct from map codes ─────────────────────

/** Encodes a FunctionSpec into a compact URL-safe base64 code (marker k:'fn'). */
export function encodeFunctionCode(spec: FunctionSpec): string {
  const payload = {
    k: 'fn',
    fn: spec.fn,
    c: [round(spec.cx), round(spec.cy)],
    th: round(spec.theta),
    s: [round(spec.sx), round(spec.sy)],
    r: [spec.rx, spec.ry],
  };
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a function code back into a FunctionSpec. Throws if not a function code. */
export function decodeFunctionCode(code: string): FunctionSpec {
  let payload: { k?: string; fn?: string; c?: number[]; th?: number; s?: number[]; r?: number[] };
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(atob(padded));
  } catch {
    throw new Error('Invalid function code');
  }
  if (payload.k !== 'fn' || !payload.fn || !payload.c || !payload.s || !payload.r) {
    throw new Error('Not a function code');
  }
  return {
    fn: payload.fn,
    cx: payload.c[0], cy: payload.c[1],
    theta: payload.th ?? 0,
    sx: payload.s[0], sy: payload.s[1],
    rx: payload.r[0] === -1 ? -1 : 1,
    ry: payload.r[1] === -1 ? -1 : 1,
  };
}

const round = (n: number): number => parseFloat(n.toFixed(4));
