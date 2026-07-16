import type { Coordinate, MapConfig, ProblemInstance } from '../types/map';
import { decodeMap } from './mapCodec';
import { createMapProblem } from './functionSurface';
import {
  decodeFunctionCode,
  createFunctionProblem,
  resolveSpec,
  FUNCTION_WIN_RADIUS,
  type FunctionSpec,
} from './functionProblem';

/**
 * A serializable description of a problem — enough to rebuild an identical
 * ProblemInstance anywhere (e.g. inside the EA web worker, which can't receive
 * the closures on a ProblemInstance). Plain data, so it survives postMessage.
 */
export type ProblemSource =
  | { kind: 'map'; config: MapConfig }
  | { kind: 'fn'; spec: FunctionSpec };

/**
 * A loaded, playable problem plus display/UI extras. Hides whether the code was
 * a hand-built map or an analytic benchmark function — both resolve to the same
 * ProblemInstance contract.
 */
export interface DecodedProblem {
  problem: ProblemInstance;
  /** Ready-to-display subtitle, e.g. "Map #ABC123" or "ƒ Rastrigin". */
  label: string;
  /** Serializable form for the EA worker. */
  source: ProblemSource;
  /** Where the summit is, and how close counts as a win (for replay overlays). */
  winTarget: Coordinate | null;
  winRadius: number;
}

/** Rebuilds a ProblemInstance from its serializable source (used in the worker). */
export function buildProblemFromSource(source: ProblemSource): ProblemInstance {
  return source.kind === 'fn'
    ? createFunctionProblem(source.spec)
    : createMapProblem(source.config);
}

function describe(problem: ProblemInstance, label: string, source: ProblemSource): DecodedProblem {
  const gm = problem.metadata?.globalMinimum;
  return {
    problem,
    label,
    source,
    winTarget: gm ? { x: gm.x, y: gm.y } : null,
    winRadius: source.kind === 'fn'
      ? (problem.metadata?.winRadius ?? FUNCTION_WIN_RADIUS)
      : source.config.winRadius,
  };
}

/**
 * Decodes any PeakFinder code into a playable problem. Function codes carry a
 * `k:'fn'` marker so they're tried first; anything else is treated as a map
 * code. Throws if the code is neither.
 */
export function decodeProblem(code: string): DecodedProblem {
  const trimmed = code.trim();

  try {
    // Resolve here (once, on the main thread): a "random every time" sentinel
    // becomes a concrete random surface, which is then stored in `source` so the
    // EA worker rebuilds the *same* surface for this session.
    const spec = resolveSpec(decodeFunctionCode(trimmed));
    const problem = createFunctionProblem(spec);
    return describe(problem, `ƒ ${problem.metadata?.name ?? 'Function'}`, { kind: 'fn', spec });
  } catch {
    /* not a function code — fall through to map decoding */
  }

  const config = decodeMap(trimmed); // throws 'Invalid map code' if unrecognised
  return describe(createMapProblem(config), `Map #${config.id}`, { kind: 'map', config });
}

/** Non-throwing variant — returns null for empty/invalid codes. */
export function decodeProblemOrNull(code: string | undefined): DecodedProblem | null {
  if (!code) return null;
  try { return decodeProblem(code); } catch { return null; }
}
