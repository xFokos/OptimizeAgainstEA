import { useMemo } from 'react';
import type { IndividualSnapshot } from '../../../engine/ea/eaReplayLog';
import type { Cell, MazeProblem } from '../../../types/maze';
import { sampleGradientRgb } from '../../../../BattleShips/engine/colorScale';
import { MazeCanvas, type MazeTrail, type MazeMarker } from '../../shared/MazeCanvas';

/**
 * Time a path takes to "draw on" / a dot to glide along its trail. Polylines
 * can't tween via the CSS transition trick the BattleShips dots use, so this is
 * here as the single knob for any future stroke-dashoffset draw-on animation.
 */
export const PATH_DRAW_DURATION_MS = 900;

const ROLE = {
  parentA: '#4af0a0',
  parentB: '#4a90f0',
  splice: '#f04a4a',
  solution: '#4af0a0',
  selected: '#ffffff',
} as const;

interface MazePathMapProps {
  individuals: IndividualSnapshot[];
  problem: MazeProblem;
  highlightIds?: Set<string>;
  highlightColor?: string;
  dimIds?: Set<string>;
  /** Second-highlight set drawn in a contrasting colour (e.g. Parent B). */
  markerIds?: Set<string>;
  markerColor?: string;
  solutionIds?: Set<string>;
  /** Individual picked in the list — drawn on top, full-strength, everything else recedes. */
  selectedId?: string | null;
  /** Per-individual opacity override (roulette weighting). */
  customOpacities?: Map<string, number>;
  /** Cells dotted red — crossover splice points. */
  spliceCells?: Cell[];
  /** Pre-built trails drawn above everything (breeding/mutation: parents + child segments). */
  extraTrails?: MazeTrail[];
}

/**
 * Re-skin of BattleShips' ReplayMap for the maze: each individual is drawn as a
 * translucent path trail rather than a dot. Highlighted parents, the spliced
 * child and mutated cells are layered on top so a single generation's mechanics
 * are legible.
 */
export function MazePathMap({
  individuals,
  problem,
  highlightIds,
  highlightColor = ROLE.parentA,
  dimIds,
  markerIds,
  markerColor = ROLE.parentB,
  solutionIds,
  selectedId,
  customOpacities,
  spliceCells,
  extraTrails,
}: MazePathMapProps) {
  // Fully sealed cells (creator wall blocks) render as filled squares.
  const solidCells = useMemo(() => {
    const out = new Set<number>();
    for (let i = 0; i < problem.grid.walls.length; i++) {
      if (problem.grid.walls[i] === 0) out.add(i);
    }
    return out;
  }, [problem]);

  // Build trails, ordering so emphasised paths render last (on top).
  const base: MazeTrail[] = [];
  const top: MazeTrail[] = [];
  const picked: MazeTrail[] = [];

  for (const ind of individuals) {
    if (ind.id === selectedId) {
      picked.push({ points: ind.trail, color: ROLE.selected, opacity: 1, width: 0.22 });
      continue;
    }
    const isHi = highlightIds?.has(ind.id);
    const isMark = markerIds?.has(ind.id);
    const isSol = solutionIds?.has(ind.id);
    const isDim = dimIds?.has(ind.id);

    if (isHi || isMark || isSol) {
      top.push({
        points: ind.trail,
        color: isSol ? ROLE.solution : isHi ? highlightColor : markerColor,
        opacity: selectedId ? 0.3 : 0.95,
        width: 0.18,
      });
    } else {
      base.push({
        points: ind.trail,
        color: sampleGradientRgb(ind.fitness),
        opacity: selectedId ? 0.05 : customOpacities?.get(ind.id) ?? (isDim ? 0.05 : 0.12),
        width: 0.08,
      });
    }
  }

  const markers: MazeMarker[] = [];
  for (const c of spliceCells ?? []) markers.push({ cell: c, color: ROLE.splice, radius: 0.09 });

  return (
    <MazeCanvas
      cols={problem.cols}
      rows={problem.rows}
      walls={problem.grid.walls}
      start={problem.start}
      goal={problem.goal}
      solidCells={solidCells}
      trails={[...base, ...top, ...(extraTrails ?? []), ...picked]}
      markers={markers}
    />
  );
}
