import type { ReplayFrame } from '../../../engine/ea/eaReplayLog';
import { useEAReplay } from '../../../hooks/useEAReplay';
import { ReplayMap } from './replay/ReplayMap';
import { IndividualList, type IndividualRole } from './replay/IndividualList';

interface EAReplayOverlayProps {
  frames:  ReplayFrame[];
  onClose: () => void;
}

export function EAReplayOverlay({ frames, onClose }: EAReplayOverlayProps) {
  const replay = useEAReplay(frames);
  const { currentFrame, frameIndex, totalFrames, isPlaying,
    isFirst, isLast, next, prev, play, pause, goTo } = replay;

  if (!currentFrame) return null;

  return (
    <div className="replay-backdrop" onClick={onClose}>
      <div className="replay-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="replay-header">
          <div className="replay-header__left">
            <span className="replay-phase-tag">
              {frameIndex + 1} / {totalFrames}
            </span>
            <h2 className="replay-headline">{currentFrame.headline}</h2>
          </div>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        <p className="replay-description">{currentFrame.description}</p>

        {/* ── Body: map left, panel right ── */}
        <div className="replay-body">
          <div className="replay-map-col">
            <PhaseMap frame={currentFrame} />
          </div>
          <div className="replay-panel-col">
            <PhasePanel frame={currentFrame} />
          </div>
        </div>

        {/* ── Playback controls ── */}
        <div className="replay-controls">
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(0)} disabled={isFirst}>⏮</button>
          <button className="btn btn--ghost btn--sm" onClick={prev}        disabled={isFirst}>◀</button>
          <button className="btn btn--primary btn--sm"
                  onClick={() => isPlaying ? pause() : play(1200)}
                  style={{ minWidth: 64 }}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={next}        disabled={isLast}>▶</button>
          <button className="btn btn--ghost btn--sm" onClick={() => goTo(totalFrames - 1)} disabled={isLast}>⏭</button>

          {/* Progress bar */}
          <div className="replay-progress">
            <div
              className="replay-progress__fill"
              style={{ width: `${((frameIndex) / Math.max(totalFrames - 1, 1)) * 100}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Per-phase map rendering ───────────────────────────────────────────────

function PhaseMap({ frame }: { frame: ReplayFrame }) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'initial':
    case 'sorted':
      return <ReplayMap individuals={individuals} />;

    case 'selection': {
      if (frame.strategy === 'tournament') {
        const candidateSet = new Set(frame.candidateIds ?? []);
        return (
          <ReplayMap
            individuals={individuals}
            highlightIds={new Set([frame.winnerId ?? ''])}
            highlightColor="#f0c44a"
            markerIds={new Set((frame.candidateIds ?? []).filter((id) => id !== frame.winnerId))}
            markerColor="#f0a04a"
            dimIds={new Set(individuals.filter((i) => !candidateSet.has(i.id)).map((i) => i.id))}
          />
        );
      }
      if (frame.strategy === 'roulette') {
        const opacities = new Map<string, number>();
        individuals.forEach((ind, i) => {
          opacities.set(ind.id, 0.15 + (frame.weights?.[i] ?? 0.5) * 0.85);
        });
        return <ReplayMap individuals={individuals} customOpacities={opacities} />;
      }
      // elitist
      const topCount  = frame.eliteTopCount ?? 1;
      const eliteIds  = new Set(individuals.slice(0, topCount).map((i) => i.id));
      return (
        <ReplayMap
          individuals={individuals}
          highlightIds={eliteIds}
          highlightColor="#4a90f0"
          dimIds={new Set(individuals.filter((i) => !eliteIds.has(i.id)).map((i) => i.id))}
        />
      );
    }

    case 'elite':
      return (
        <ReplayMap
          individuals={individuals}
          highlightIds={new Set(frame.eliteIds)}
          highlightColor="#f0c44a"
          dimIds={new Set(
            individuals.filter((i) => !frame.eliteIds.includes(i.id)).map((i) => i.id)
          )}
        />
      );

    case 'breeding': {
      const dimSet  = new Set(
        individuals
          .filter((i) => i.id !== frame.parentAId && i.id !== frame.parentBId)
          .map((i) => i.id)
      );
      const parentA = individuals.find((i) => i.id === frame.parentAId);
      const parentB = individuals.find((i) => i.id === frame.parentBId);

      const parentLine =
        frame.crossoverStrategy === 'arithmetic' && frame.didCrossover && parentA && parentB
          ? { from: parentA.position, to: parentB.position }
          : undefined;

      const geneLines =
        (frame.crossoverStrategy === 'uniform' || frame.crossoverStrategy === 'singlePoint') &&
        parentA && parentB && frame.geneSource
          ? {
              xSource: frame.geneSource.xFromA ? parentA.position : parentB.position,
              ySource: frame.geneSource.yFromA ? parentA.position : parentB.position,
              child:   frame.crossoverResult,
            }
          : undefined;

      return (
        <ReplayMap
          individuals={individuals}
          highlightIds={new Set([frame.parentAId])}
          highlightColor="#4af0a0"
          markerIds={new Set([frame.parentBId])}
          markerColor="#4a90f0"
          dimIds={dimSet}
          parentLine={parentLine}
          geneLines={geneLines}
          extraDots={[{
            id: 'child',
            position: frame.crossoverResult,
            color: '#e8eaf0',
            label: 'child',
          }]}
        />
      );
    }

    case 'mutating':
      return (
        <ReplayMap
          individuals={individuals}
          arrow={{ from: frame.before, to: frame.after }}
          extraDots={[{
            id: 'mutated',
            position: frame.after,
            color: '#f0a04a',
            label: 'mutated',
          }]}
        />
      );

    case 'newGen':
      return <ReplayMap individuals={individuals} />;

    case 'winCheck':
      return (
        <ReplayMap
          individuals={individuals}
          solutionIds={new Set(frame.solutionIds)}
          dimIds={new Set(
            individuals.filter((i) => !frame.solutionIds.includes(i.id)).map((i) => i.id)
          )}
        />
      );

    default:
      return <ReplayMap individuals={[]} />;
  }
}

// ── Per-phase right panel ─────────────────────────────────────────────────

function PhasePanel({ frame }: { frame: ReplayFrame }) {
  const individuals = 'individuals' in frame ? frame.individuals : [];

  switch (frame.phase) {
    case 'initial':
      return (
        <IndividualList
          individuals={individuals}
          title="Population (arrival order)"
        />
      );

    case 'sorted':
      return (
        <IndividualList
          individuals={individuals}
          title="Population (ranked by fitness ↑)"
        />
      );

    case 'selection': {
      if (frame.strategy === 'tournament') {
        const candidateSet = new Set(frame.candidateIds ?? []);
        const roles = new Map<string, IndividualRole>(
          individuals.map((i) => [
            i.id,
            i.id === frame.winnerId
              ? 'winner'
              : candidateSet.has(i.id)
                ? 'candidate'
                : 'dim',
          ])
        );
        return (
          <IndividualList
            individuals={individuals}
            roles={roles}
            title="Tournament candidates (3 drawn at random)"
          />
        );
      }

      if (frame.strategy === 'roulette') {
        const annotations = new Map<string, string>(
          individuals.map((ind, i) => {
            const pct = Math.round((frame.weights?.[i] ?? 0) * 100);
            return [ind.id, `${pct}%`];
          })
        );
        return (
          <IndividualList
            individuals={individuals}
            annotations={annotations}
            title="Selection weight (relative to best)"
          />
        );
      }

      // elitist
      const topCount = frame.eliteTopCount ?? 1;
      const roles = new Map<string, IndividualRole>(
        individuals.map((i, idx) => [i.id, idx < topCount ? 'eligible' : 'dim'])
      );
      return (
        <IndividualList
          individuals={individuals}
          roles={roles}
          title={`Eligible pool — top ${topCount} individuals`}
        />
      );
    }

    case 'elite': {
      const roles = new Map<string, IndividualRole>(
        individuals.map((i) => [i.id, frame.eliteIds.includes(i.id) ? 'elite' : 'dim'])
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IndividualList individuals={individuals} roles={roles} title="Current generation" />
          <IndividualList individuals={frame.nextGen} title="Next generation (so far)" />
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
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IndividualList individuals={individuals} roles={roles} title="Current generation" />
          <IndividualList
            individuals={[...frame.nextGen, frame.child]}
            title="Next generation (so far)"
            roles={new Map([[frame.child.id, 'child']])}
          />
        </div>
      );
    }

    case 'mutating': {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="replay-mutation-card">
            <div className="replay-mutation-card__row">
              <span className="replay-mutation-card__label">Before</span>
              <span className="replay-mutation-card__val">
                ({frame.before.x.toFixed(4)}, {frame.before.y.toFixed(4)})
              </span>
            </div>
            <div className="replay-mutation-card__row">
              <span className="replay-mutation-card__label">Delta</span>
              <span className="replay-mutation-card__val replay-mutation-card__val--delta">
                ({frame.delta.x >= 0 ? '+' : ''}{frame.delta.x.toFixed(4)},&nbsp;
                {frame.delta.y >= 0 ? '+' : ''}{frame.delta.y.toFixed(4)})
              </span>
            </div>
            <div className="replay-mutation-card__row">
              <span className="replay-mutation-card__label">After</span>
              <span className="replay-mutation-card__val replay-mutation-card__val--after">
                ({frame.after.x.toFixed(4)}, {frame.after.y.toFixed(4)})
              </span>
            </div>
          </div>
          <IndividualList individuals={frame.nextGen} title="Next generation (so far)" />
        </div>
      );
    }

    case 'newGen':
      return <IndividualList individuals={individuals} title="New generation" />;

    case 'winCheck': {
      const roles = new Map<string, IndividualRole>(
        individuals.map((i) => [
          i.id,
          frame.solutionIds.includes(i.id) ? 'solution' : 'dim',
        ])
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Progress bar */}
          <div className="replay-win-check">
            <div className="replay-win-check__label">
              {frame.count} / {frame.threshold} in win radius
            </div>
            <div className="replay-win-check__bar">
              <div
                className="replay-win-check__fill"
                style={{
                  width: `${Math.min((frame.count / frame.threshold) * 100, 100)}%`,
                  background: frame.solved ? 'var(--accent)' : 'var(--accent-global)',
                }}
              />
            </div>
          </div>
          <IndividualList individuals={individuals} roles={roles} title="Population" />
        </div>
      );
    }

    default:
      return null;
  }
}