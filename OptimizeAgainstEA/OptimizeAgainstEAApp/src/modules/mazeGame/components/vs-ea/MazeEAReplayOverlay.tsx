import type { ReplayFrame, IndividualSnapshot } from '../../engine/ea/eaReplayLog';
import type { Cell, MazeProblem, Path } from '../../types/maze';
import { useMazeEAReplay } from '../../hooks/useMazeEAReplay';
import { walkPath } from '../../engine/ea/individual';
import { MazePathMap } from './replay/MazePathMap';
import { MazeIndividualList, type IndividualRole, type GenomeHighlight } from './replay/MazeIndividualList';
import { btn } from '../shared/mazeStyles';
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
          <div><PhaseMap frame={currentFrame} problem={problem} /></div>
          <div><PhasePanel frame={currentFrame} /></div>
        </div>

        <div className="maze-replay-controls">
          <button style={btn} onClick={() => goTo(0)} disabled={isFirst}>⏮</button>
          <button style={btn} onClick={prev} disabled={isFirst}>◀</button>
          <button style={btn} onClick={next} disabled={isLast}>▶</button>
          <button style={btn} onClick={() => goTo(totalFrames - 1)} disabled={isLast}>⏭</button>
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

// ── per-phase map ───────────────────────────────────────────────────────────

function PhaseMap({ frame, problem }: { frame: ReplayFrame; problem: MazeProblem }) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'sorted':
    case 'newGen':
      return <MazePathMap individuals={individuals} problem={problem} />;

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
        />
      );

    case 'breeding': {
      const spliceCell =
        frame.crossoverStrategy === 'singlePoint' && frame.didCrossover && frame.cut !== undefined
          ? frame.child.trail[frame.cut]
          : undefined;
      return (
        <MazePathMap
          individuals={individuals}
          problem={problem}
          highlightIds={new Set([frame.parentAId])}
          highlightColor="#4af0a0"
          markerIds={new Set([frame.parentBId])}
          markerColor="#4a90f0"
          dimIds={dimAllExcept([frame.parentAId, frame.parentBId], individuals)}
          childTrail={frame.child.trail}
          spliceCell={spliceCell}
        />
      );
    }

    case 'mutating': {
      const childTrail = trailOf(frame.afterPath, problem);
      const mutatedCells = frame.mutatedIndices
        .map((i) => childTrail[i])
        .filter((c): c is Cell => c !== undefined);
      return (
        <MazePathMap
          individuals={individuals}
          problem={problem}
          dimIds={new Set(individuals.map((i) => i.id))}
          childTrail={childTrail}
          mutatedCells={mutatedCells}
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
        />
      );

    default:
      return <MazePathMap individuals={[]} problem={problem} />;
  }
}

// ── per-phase panel ─────────────────────────────────────────────────────────

function PhasePanel({ frame }: { frame: ReplayFrame }) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'sorted':
      return <MazeIndividualList individuals={individuals} title="Population (ranked by fitness ↑)" />;

    case 'newGen':
      return <MazeIndividualList individuals={individuals} title="New generation" />;

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
          <MazeIndividualList individuals={individuals} roles={roles} title="Current generation" />
          <MazeIndividualList individuals={frame.nextGen} title="Next generation (so far)" />
        </div>
      );
    }

    case 'breeding': {
      const roles = new Map<string, IndividualRole>();
      individuals.forEach((i) => {
        if (i.id === frame.parentAId) roles.set(i.id, 'parentA');
        else if (i.id === frame.parentBId) roles.set(i.id, 'parentB');
        else roles.set(i.id, 'dim');
      });
      const childHighlight = new Map<string, GenomeHighlight>([
        [frame.child.id, frame.crossoverStrategy === 'singlePoint' ? { spliceFrom: frame.cut } : {}],
      ]);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MazeIndividualList individuals={individuals} roles={roles} title="Current generation" />
          <MazeIndividualList
            individuals={[...frame.nextGen, frame.child]}
            roles={new Map([[frame.child.id, 'child']])}
            highlights={childHighlight}
            title="Next generation (so far)"
          />
        </div>
      );
    }

    case 'mutating': {
      // Synthesize a one-row snapshot for the mutated child so we can show its arrows.
      const childRow: IndividualSnapshot = {
        id: frame.childId, path: frame.afterPath, trail: [], finalCell: 0, fitness: 0, isSolution: false,
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
          </div>
          <MazeIndividualList
            individuals={[childRow]}
            roles={new Map([[frame.childId, 'child']])}
            highlights={new Map([[frame.childId, { mutated: frame.mutatedIndices }]])}
            title="Child genome after mutation"
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
          <MazeIndividualList individuals={individuals} roles={roles} title="Population" />
        </div>
      );
    }

    default:
      return null;
  }
}
