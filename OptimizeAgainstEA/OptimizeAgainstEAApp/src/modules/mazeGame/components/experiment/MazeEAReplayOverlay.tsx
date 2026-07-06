import { useState } from 'react';
import type { ReplayFrame, IndividualSnapshot } from '../../engine/ea/eaReplayLog';
import type { Cell, MazeProblem, Path } from '../../types/maze';
import { MOVE_DELTAS, MOVE_WALL_BIT, cellIndex } from '../../types/maze';
import { useMazeEAReplay } from '../../hooks/useMazeEAReplay';
import { walkPath } from '../../engine/ea/individual';
import { MazePathMap } from './replay/MazePathMap';
import {
  MazeIndividualList, PARENT_A_COLOR, PARENT_B_COLOR, MUTATED_COLOR,
  type IndividualRole, type GenomeHighlight,
} from './replay/MazeIndividualList';
import type { MazeTrail } from '../shared/MazeCanvas';
import '../../styles/MazeGameStyles.css';

interface MazeEAReplayOverlayProps {
  frames: ReplayFrame[];
  problem: MazeProblem;
  onClose: () => void;
}

/**
 * Full-screen dissection of one generation: a map of every individual's path on
 * the left, the genome list on the right, stepped phase-by-phase. A re-skin of
 * BattleShips' EAReplayOverlay — the phase set is identical, so the dispatchers
 * port 1:1; only the map (paths, not dots) and list (arrows, not coords) differ.
 */
export function MazeEAReplayOverlay({ frames, problem, onClose }: MazeEAReplayOverlayProps) {
  const replay = useMazeEAReplay(frames);
  const { currentFrame, frameIndex, totalFrames, isFirst, isLast, next, prev, goTo } = replay;

  // Path picked in the list to spotlight on the map. The selection remembers
  // which frame it was made on so it evaporates when the phase changes.
  const [selection, setSelection] = useState<{ frame: number; id: string | null }>({ frame: -1, id: null });
  const selectedId = selection.frame === frameIndex ? selection.id : null;
  const selectId = (id: string | null) => setSelection({ frame: frameIndex, id });

  // Mutation frame: which side of the mutation is shown. Frame-keyed like the
  // selection so stepping frames resets to 'after'.
  const [mutation, setMutation] = useState<{ frame: number; view: MutationView }>({ frame: -1, view: 'after' });
  const mutationView = mutation.frame === frameIndex ? mutation.view : 'after';
  const setMutationView = (view: MutationView) => setMutation({ frame: frameIndex, view });

  if (!currentFrame) return null;

  return (
    <div className="maze-replay-backdrop" onClick={onClose}>
      <div className="maze-replay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maze-replay-header">
          <span className="maze-replay-phase-tag">{frameIndex + 1} / {totalFrames}</span>
          <h2 className="maze-replay-headline">{currentFrame.headline}</h2>
          <button className="maze-replay-close" onClick={onClose}>✕</button>
        </div>

        <p className="maze-replay-description">{currentFrame.description}</p>

        <div className="maze-replay-body">
          <div className="maze-replay-body__map"><PhaseMap frame={currentFrame} problem={problem} selectedId={selectedId} mutationView={mutationView} /></div>
          <div className="maze-replay-body__panel"><PhasePanel frame={currentFrame} selectedId={selectedId} onSelect={selectId} mutationView={mutationView} onMutationView={setMutationView} /></div>
        </div>

        <div className="maze-replay-controls">
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(0)} disabled={isFirst}>⏮</button>
          <button className="btn btn--ghost btn--sm" onClick={prev} disabled={isFirst}>◀</button>
          <button className="btn btn--ghost btn--sm" onClick={next} disabled={isLast}>▶</button>
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(totalFrames - 1)} disabled={isLast}>⏭</button>
          <div className="maze-replay-progress">
            <div className="maze-replay-progress__fill" style={{ width: `${(frameIndex / Math.max(totalFrames - 1, 1)) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function trailOf(path: Path, problem: MazeProblem): Cell[] {
  return walkPath(problem, path).trail;
}

function dimAllExcept(ids: string[], all: { id: string }[]): Set<string> {
  const keep = new Set(ids);
  return new Set(all.filter((i) => !keep.has(i.id)).map((i) => i.id));
}

// ── Crossover colouring ─────────────────────────────────────────────────────

type BreedingFrame = Extract<ReplayFrame, { phase: 'breeding' }>;
type MutationView = 'before' | 'after';

function edgeKey(p: Cell, q: Cell): string {
  return p.y < q.y || (p.y === q.y && p.x <= q.x)
    ? `${p.x},${p.y}|${q.x},${q.y}`
    : `${q.x},${q.y}|${p.x},${p.y}`;
}

/** Undirected cell-to-cell transitions a trail actually travelled. */
function edgeSet(trail: Cell[]): Set<string> {
  const out = new Set<string>();
  for (let i = 1; i < trail.length; i++) {
    if (trail[i].x !== trail[i - 1].x || trail[i].y !== trail[i - 1].y) {
      out.add(edgeKey(trail[i - 1], trail[i]));
    }
  }
  return out;
}

/** Which parent each of the child's genes came from. */
function childGeneSources(frame: BreedingFrame, steps: number): ('A' | 'B')[] {
  return Array.from({ length: steps }, (_, i): 'A' | 'B' => {
    if (!frame.didCrossover) return 'A';
    if (frame.crossoverStrategy === 'singlePoint') return i < (frame.cut ?? 0) ? 'A' : 'B';
    return frame.geneMask?.[i] ? 'A' : 'B';
  });
}

/** Darker shade of a #rrggbb colour (stubs read as "failed" versions of the path). */
function darken(hex: string, factor = 0.6): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Half-length stubs for genes that ran into a wall: the walker stayed put, so
 * the trail shows nothing — the stub points from the cell centre toward the
 * wall the move crashed into, in a darker shade of the gene's parent colour.
 * Zero-length steps that are NOT wall hits (frozen at the goal, or after a
 * 'break'-rule crash) get no stub.
 */
function blockedMoveStubs(
  path: Path, trail: Cell[], problem: MazeProblem,
  colorFor: (gene: number) => string, opacity: number, width: number,
): MazeTrail[] {
  const stubs: MazeTrail[] = [];
  for (let i = 0; i + 1 < trail.length; i++) {
    const p = trail[i];
    const q = trail[i + 1];
    if (p.x !== q.x || p.y !== q.y) continue; // the move was taken
    if (p.x === problem.goal.x && p.y === problem.goal.y) break; // goal absorbs
    const d = path[i];
    const [dx, dy] = MOVE_DELTAS[d];
    const open = (problem.grid.walls[cellIndex(p.x, p.y, problem.cols)] & MOVE_WALL_BIT[d]) !== 0;
    const inBounds = p.x + dx >= 0 && p.x + dx < problem.cols && p.y + dy >= 0 && p.y + dy < problem.rows;
    if (!open || !inBounds) {
      stubs.push({
        points: [p, { x: p.x + dx / 2, y: p.y + dy / 2 }],
        color: darken(colorFor(i)), opacity, width,
      });
      if (problem.wallRule === 'break') break; // crashed — the rest was never attempted
    }
  }
  return stubs;
}

/**
 * The child's walked path, one trail per move, coloured by the parent the gene
 * came from. A segment both parents also travelled is drawn half in A's
 * colour, half in B's.
 */
function childSegmentTrails(
  frame: BreedingFrame, aTrail: Cell[], bTrail: Cell[], opacity: number, width: number,
): MazeTrail[] {
  const trail = frame.child.trail;
  const sources = childGeneSources(frame, Math.max(trail.length - 1, 0));
  const inA = edgeSet(aTrail);
  const inB = edgeSet(bTrail);
  const segs: MazeTrail[] = [];
  for (let i = 0; i + 1 < trail.length; i++) {
    const p = trail[i];
    const q = trail[i + 1];
    if (p.x === q.x && p.y === q.y) continue; // blocked move — nothing to draw
    const key = edgeKey(p, q);
    // Without crossover the child is a clone of A — no shared-credit split.
    if (frame.didCrossover && inA.has(key) && inB.has(key)) {
      // Both parents travelled this segment: two parallel half-width strokes,
      // each running the full step, offset sideways so they sit edge to edge.
      // Offset is derived from the canonical edge orientation so A stays on
      // the same side regardless of travel direction.
      const [cp, cq] = p.y < q.y || (p.y === q.y && p.x <= q.x) ? [p, q] : [q, p];
      const len = Math.hypot(cq.x - cp.x, cq.y - cp.y);
      const ox = (-(cq.y - cp.y) / len) * (width / 4);
      const oy = ((cq.x - cp.x) / len) * (width / 4);
      segs.push({
        points: [{ x: p.x + ox, y: p.y + oy }, { x: q.x + ox, y: q.y + oy }],
        color: PARENT_A_COLOR, opacity, width: width / 2,
      });
      segs.push({
        points: [{ x: p.x - ox, y: p.y - oy }, { x: q.x - ox, y: q.y - oy }],
        color: PARENT_B_COLOR, opacity, width: width / 2,
      });
    } else {
      segs.push({ points: [p, q], color: sources[i] === 'A' ? PARENT_A_COLOR : PARENT_B_COLOR, opacity, width });
    }
  }
  return segs;
}

// ── per-phase map ───────────────────────────────────────────────────────────

function PhaseMap({ frame, problem, selectedId, mutationView }: {
  frame: ReplayFrame;
  problem: MazeProblem;
  selectedId: string | null;
  mutationView: MutationView;
}) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'sorted':
    case 'newGen':
      return <MazePathMap individuals={individuals} problem={problem} selectedId={selectedId} />;

    case 'selection': {
      if (frame.strategy === 'tournament') {
        const candidates = (frame.candidateIds ?? []).filter((id) => id !== frame.winnerId);
        return (
          <MazePathMap
            individuals={individuals}
            problem={problem}
            highlightIds={new Set([frame.winnerId ?? ''])}
            highlightColor="#f0c44a"
            markerIds={new Set(candidates)}
            markerColor="#f0a04a"
            dimIds={dimAllExcept([...(frame.candidateIds ?? [])], individuals)}
          />
        );
      }
      if (frame.strategy === 'roulette') {
        const opacities = new Map<string, number>();
        individuals.forEach((ind, i) => opacities.set(ind.id, 0.04 + (frame.weights?.[i] ?? 0.5) * 0.4));
        return <MazePathMap individuals={individuals} problem={problem} customOpacities={opacities} />;
      }
      const topCount = frame.eliteTopCount ?? 1;
      const eliteIds = individuals.slice(0, topCount).map((i) => i.id);
      return (
        <MazePathMap
          individuals={individuals}
          problem={problem}
          highlightIds={new Set(eliteIds)}
          highlightColor="#4a90f0"
          dimIds={dimAllExcept(eliteIds, individuals)}
        />
      );
    }

    case 'elite':
      return (
        <MazePathMap
          individuals={individuals}
          problem={problem}
          highlightIds={new Set(frame.eliteIds)}
          highlightColor="#f0c44a"
          dimIds={dimAllExcept(frame.eliteIds, individuals)}
          selectedId={selectedId}
        />
      );

    case 'breeding': {
      const aSnap = individuals.find((i) => i.id === frame.parentAId);
      const bSnap = individuals.find((i) => i.id === frame.parentBId);
      const aTrail = aSnap?.trail ?? [];
      const bTrail = bSnap?.trail ?? [];
      const trail = frame.child.trail;
      const sources = childGeneSources(frame, Math.max(trail.length - 1, 0));

      const picked = (id: string) => selectedId === id;
      const anyPicked = selectedId !== null;

      // Each path plus its blocked-move stubs, so the picked one moves to the
      // top as a unit.
      const parentGroup = (snap: IndividualSnapshot | undefined, color: string, id: string): MazeTrail[] => {
        if (!snap) return [];
        const opacity = !anyPicked ? 0.6 : picked(id) ? 1 : 0.12;
        const width = picked(id) ? 0.2 : 0.14;
        return [
          { points: snap.trail, color, opacity, width },
          ...blockedMoveStubs(snap.path, snap.trail, problem, () => color, opacity, width),
        ];
      };
      const a = parentGroup(aSnap, PARENT_A_COLOR, frame.parentAId);
      const b = parentGroup(bSnap, PARENT_B_COLOR, frame.parentBId);

      const childOpacity = !anyPicked ? 0.95 : picked(frame.child.id) ? 1 : 0.12;
      const childWidth = picked(frame.child.id) ? 0.2 : 0.15;
      const child = [
        ...childSegmentTrails(frame, aTrail, bTrail, childOpacity, childWidth),
        ...blockedMoveStubs(
          frame.child.path, trail, problem,
          (i) => sources[i] === 'A' ? PARENT_A_COLOR : PARENT_B_COLOR,
          childOpacity, childWidth,
        ),
      ];

      // Draw the picked path last so it sits on top.
      const extraTrails = picked(frame.parentAId) ? [...b, ...child, ...a]
        : picked(frame.parentBId) ? [...a, ...child, ...b]
        : [...a, ...b, ...child];

      // Dot every cell where the child's gene source flips parents. Flips after
      // the child stops moving (goal absorbed / crashed / stuck) would all pile
      // onto the frozen cell, so cut off after the last actual move and drop
      // duplicate cells.
      const spliceCells: Cell[] = [];
      if (frame.didCrossover) {
        let lastMove = -1;
        for (let i = 0; i + 1 < trail.length; i++) {
          if (trail[i].x !== trail[i + 1].x || trail[i].y !== trail[i + 1].y) lastMove = i;
        }
        const seen = new Set<string>();
        for (let i = 1; i < sources.length && i <= lastMove + 1; i++) {
          if (sources[i] !== sources[i - 1]) {
            const cellKey = `${trail[i].x},${trail[i].y}`;
            if (!seen.has(cellKey)) {
              seen.add(cellKey);
              spliceCells.push(trail[i]);
            }
          }
        }
      }

      return (
        <MazePathMap
          individuals={[]}
          problem={problem}
          extraTrails={extraTrails}
          spliceCells={spliceCells}
        />
      );
    }

    case 'mutating': {
      const path = mutationView === 'before' ? frame.beforePath : frame.afterPath;
      const trail = trailOf(path, problem);
      const mutated = new Set(frame.mutatedIndices);
      const colorFor = (i: number) => (mutated.has(i) ? MUTATED_COLOR : '#ffffff');

      const segs: MazeTrail[] = [];
      for (let i = 0; i + 1 < trail.length; i++) {
        const p = trail[i];
        const q = trail[i + 1];
        if (p.x === q.x && p.y === q.y) continue;
        segs.push({ points: [p, q], color: colorFor(i), opacity: 0.95, width: 0.15 });
      }
      const stubs = blockedMoveStubs(path, trail, problem, colorFor, 0.95, 0.15);

      return (
        <MazePathMap
          individuals={[]}
          problem={problem}
          extraTrails={[...segs, ...stubs]}
        />
      );
    }

    case 'winCheck':
      return (
        <MazePathMap
          individuals={individuals}
          problem={problem}
          solutionIds={new Set(frame.solutionIds)}
          dimIds={dimAllExcept(frame.solutionIds, individuals)}
          selectedId={selectedId}
        />
      );

    default:
      return <MazePathMap individuals={[]} problem={problem} />;
  }
}

// ── per-phase panel ─────────────────────────────────────────────────────────

function PhasePanel({ frame, selectedId, onSelect, mutationView, onMutationView }: {
  frame: ReplayFrame;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mutationView: MutationView;
  onMutationView: (view: MutationView) => void;
}) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'sorted':
      return <MazeIndividualList individuals={individuals} title="Population (ranked by fitness ↑)" selectedId={selectedId} onSelect={onSelect} />;

    case 'newGen':
      return <MazeIndividualList individuals={individuals} title="New generation" selectedId={selectedId} onSelect={onSelect} />;

    case 'selection': {
      if (frame.strategy === 'tournament') {
        const candidateSet = new Set(frame.candidateIds ?? []);
        const roles = new Map<string, IndividualRole>(
          individuals.map((i) => [
            i.id,
            i.id === frame.winnerId ? 'winner' : candidateSet.has(i.id) ? 'candidate' : 'dim',
          ]),
        );
        return <MazeIndividualList individuals={individuals} roles={roles} title="Tournament candidates" />;
      }
      if (frame.strategy === 'roulette') {
        const annotations = new Map<string, string>(
          individuals.map((ind, i) => [ind.id, `${Math.round((frame.weights?.[i] ?? 0) * 100)}%`]),
        );
        return <MazeIndividualList individuals={individuals} annotations={annotations} title="Selection weight (vs best)" />;
      }
      const topCount = frame.eliteTopCount ?? 1;
      const roles = new Map<string, IndividualRole>(
        individuals.map((i, idx) => [i.id, idx < topCount ? 'eligible' : 'dim']),
      );
      return <MazeIndividualList individuals={individuals} roles={roles} title={`Eligible pool — top ${topCount}`} />;
    }

    case 'elite': {
      const roles = new Map<string, IndividualRole>(
        individuals.map((i) => [i.id, frame.eliteIds.includes(i.id) ? 'elite' : 'dim']),
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MazeIndividualList individuals={individuals} roles={roles} title="Current generation" selectedId={selectedId} onSelect={onSelect} />
          <MazeIndividualList individuals={frame.nextGen} title="Next generation (so far)" selectedId={selectedId} onSelect={onSelect} />
        </div>
      );
    }

    case 'breeding': {
      const a = individuals.find((i) => i.id === frame.parentAId);
      const b = individuals.find((i) => i.id === frame.parentBId);
      const sameParent = a !== undefined && b !== undefined && a.id === b.id;

      // Parents + child above the list — the only clickable rows here.
      const trio: IndividualSnapshot[] = [
        ...(a ? [a] : []),
        ...(b && !sameParent ? [b] : []),
        frame.child,
      ];
      // Gene indices where the child's source parent flips — shown as red dots
      // in every trio row, mirroring the dots on the map.
      const sources = childGeneSources(frame, frame.child.path.length);
      const splits: number[] = [];
      if (frame.didCrossover) {
        for (let i = 1; i < sources.length; i++) {
          if (sources[i] !== sources[i - 1]) splits.push(i);
        }
      }

      const trioRoles = new Map<string, IndividualRole>();
      const trioHighlights = new Map<string, GenomeHighlight>();
      if (a) { trioRoles.set(a.id, 'parentA'); trioHighlights.set(a.id, { tint: PARENT_A_COLOR, splits }); }
      if (b && !sameParent) { trioRoles.set(b.id, 'parentB'); trioHighlights.set(b.id, { tint: PARENT_B_COLOR, splits }); }
      trioRoles.set(frame.child.id, 'child');
      trioHighlights.set(frame.child.id, !frame.didCrossover
        ? { tint: PARENT_A_COLOR }
        : frame.crossoverStrategy === 'singlePoint'
          ? { spliceFrom: frame.cut, splits }
          : { mask: frame.geneMask, splits });

      const roles = new Map<string, IndividualRole>();
      individuals.forEach((i) => {
        if (i.id === frame.parentAId) roles.set(i.id, 'parentA');
        else if (i.id === frame.parentBId) roles.set(i.id, 'parentB');
        else roles.set(i.id, 'dim');
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MazeIndividualList
            individuals={trio}
            roles={trioRoles}
            highlights={trioHighlights}
            title="Crossover — click a row to trace its path"
            selectedId={selectedId}
            onSelect={onSelect}
            maxGenes={120}
          />
          <MazeIndividualList individuals={individuals} roles={roles} title="Current generation" />
          <MazeIndividualList individuals={frame.nextGen} title="Next generation (so far)" />
        </div>
      );
    }

    case 'mutating': {
      // Synthesize a one-row snapshot for the shown variant so we can render its arrows.
      const childRow: IndividualSnapshot = {
        id: frame.childId,
        path: mutationView === 'before' ? frame.beforePath : frame.afterPath,
        trail: [], finalCell: 0, fitness: 0, isSolution: false,
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel panel--inset maze-replay-card">
            <div className="maze-replay-card__row">
              <span className="maze-replay-card__label">Mutated</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                {frame.didMutate ? `${frame.mutatedIndices.length} gene(s) re-picked` : 'no change'}
              </span>
            </div>
            <div className="maze-replay-card__row">
              <button
                className={`btn btn--ghost btn--sm${mutationView === 'before' ? ' btn--active' : ''}`}
                onClick={() => onMutationView('before')}
              >Before</button>
              <button
                className={`btn btn--ghost btn--sm${mutationView === 'after' ? ' btn--active' : ''}`}
                onClick={() => onMutationView('after')}
              >After</button>
            </div>
          </div>
          <MazeIndividualList
            individuals={[childRow]}
            roles={new Map([[frame.childId, 'child']])}
            highlights={new Map([[frame.childId, { mutated: frame.mutatedIndices }]])}
            title={mutationView === 'before' ? 'Child genome before mutation' : 'Child genome after mutation'}
            maxGenes={120}
          />
          <MazeIndividualList individuals={frame.nextGen} title="Next generation (so far)" />
        </div>
      );
    }

    case 'winCheck': {
      const roles = new Map<string, IndividualRole>(
        individuals.map((i) => [i.id, frame.solutionIds.includes(i.id) ? 'solution' : 'dim']),
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel panel--inset maze-replay-card">
            <div className="maze-replay-card__row">
              <span className="maze-replay-card__label">Reached</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                {frame.count} / {frame.threshold} required
              </span>
            </div>
            <div className="maze-replay-winbar">
              <div
                className="maze-replay-winbar__fill"
                style={{
                  width: `${Math.min((frame.count / frame.threshold) * 100, 100)}%`,
                  background: frame.solved ? '#4af0a0' : '#f0c44a',
                }}
              />
            </div>
          </div>
          <MazeIndividualList individuals={individuals} roles={roles} title="Population" selectedId={selectedId} onSelect={onSelect} />
        </div>
      );
    }

    default:
      return null;
  }
}
