import type { Cell, Path } from '../../types/maze';
import type { Individual, EAConfig, SelectionStrategy, CrossoverStrategy } from '../../types/ea';

// ── Per-individual snapshot used in every frame ───────────────────────────
// Path-based: drops (x,y) position, carries the genome + its walked trail so
// the map can draw it as spaghetti and the list can render it as arrows.

export interface IndividualSnapshot {
  id: string;
  path: Path;
  trail: Cell[];
  finalCell: number;
  fitness: number;
  isSolution: boolean;
}

// ── What actually happened when one child was bred ────────────────────────

export interface BreedingRecord {
  parentA: Individual;
  parentB: Individual;
  didCrossover: boolean;
  cut?: number;          // single-point splice index
  geneMask?: boolean[];  // uniform: true → gene from parent A
  beforeMutation: Path;  // child after crossover, before mutation
  didMutate: boolean;
  mutatedIndices: number[];
  child: Individual;     // final repaired + evaluated child
}

// ── Frame union — one per animation step ─────────────────────────────────

export type ReplayFrame =
  | {
      phase: 'sorted';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
    }
  | {
      phase: 'selection';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
      strategy: SelectionStrategy;
      candidateIds?: string[];
      winnerId?: string;
      weights?: number[];
      eliteTopCount?: number;
    }
  | {
      phase: 'elite';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
      eliteIds: string[];
      nextGen: IndividualSnapshot[];
    }
  | {
      phase: 'breeding';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
      nextGen: IndividualSnapshot[];
      parentAId: string;
      parentBId: string;
      child: IndividualSnapshot;
      crossoverStrategy: CrossoverStrategy;
      cut?: number;
      geneMask?: boolean[];
      didCrossover: boolean;
    }
  | {
      phase: 'mutating';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
      nextGen: IndividualSnapshot[];
      childId: string;
      didMutate: boolean;
      beforePath: Path;
      afterPath: Path;
      mutatedIndices: number[];
    }
  | {
      phase: 'newGen';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
    }
  | {
      phase: 'winCheck';
      headline: string;
      description: string;
      individuals: IndividualSnapshot[];
      solutionIds: string[];
      count: number;
      threshold: number;
      solved: boolean;
    };

export function snapshot(ind: Individual, id: string): IndividualSnapshot {
  return {
    id,
    path: ind.path.slice(),
    trail: ind.walk.trail,
    finalCell: ind.walk.finalCell,
    fitness: ind.fitness,
    isSolution: ind.isSolution,
  };
}

// ── Build a full replay for one generation ────────────────────────────────

export function buildReplayFrames(
  before: Individual[],
  nextGen: Individual[],
  eliteCount: number,
  config: EAConfig,
  solutionThreshold: number,
  breeding?: BreedingRecord,
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  const label = (i: number) => `ind-${i}`;
  const snap = (pop: Individual[]) => pop.map((ind, i) => snapshot(ind, label(i)));

  // 1. Population, ranked by fitness (`before` is already sorted).
  const sorted = [...before].sort((a, b) => a.fitness - b.fitness);
  const sortedSnap = snap(sorted);
  frames.push({
    phase: 'sorted',
    headline: 'Population — ranked by fitness',
    description: `The generation begins with ${config.populationSize} paths — each line is one candidate route from the start. They are sorted best-first: lower fitness = closer to the goal. The best will be preferred for breeding.`,
    individuals: sortedSnap,
  });

  // 2. Elitism
  const elites = sorted.slice(0, eliteCount);
  const eliteSnap = snap(elites);
  const eliteIds = eliteSnap.map((s) => s.id);
  frames.push({
    phase: 'elite',
    headline: `Elitism — top ${eliteCount} survive`,
    description: `The best ${eliteCount} path${eliteCount > 1 ? 's are' : ' is'} copied directly into the next generation unchanged. This guarantees the population never gets worse.`,
    individuals: sortedSnap,
    eliteIds,
    nextGen: eliteSnap,
  });

  // 3. Selection example
  const n = sortedSnap.length;
  if (config.selectionStrategy === 'tournament') {
    const drawn = new Set<number>();
    while (drawn.size < Math.min(3, n)) drawn.add(Math.floor(Math.random() * n));
    const picks = [...drawn].sort((a, b) => a - b);
    const winnerIdx = picks[0];
    const candidateIds = picks.map(label);
    const parts = picks.map((i, idx) =>
      idx === 0
        ? `#${i + 1} (fitness ${sorted[i].fitness.toFixed(3)})`
        : `#${i + 1} (${sorted[i].fitness.toFixed(3)})`,
    );
    const list = parts.length > 1
      ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
      : parts[0];
    frames.push({
      phase: 'selection',
      headline: 'Tournament selection (k = 3)',
      description: `Three paths are drawn at random — here rank ${list}. The fittest of the three wins and becomes a parent. A second tournament picks the other parent.`,
      individuals: sortedSnap,
      strategy: 'tournament',
      candidateIds,
      winnerId: label(winnerIdx),
    });
  } else if (config.selectionStrategy === 'roulette') {
    const maxFit = sorted[n - 1].fitness;
    const rawW = sorted.map((ind) => maxFit - ind.fitness + 1e-6);
    const maxW = rawW[0];
    const weights = rawW.map((w) => w / maxW);
    const ratio = Math.round(weights[0] / Math.max(weights[n - 1], 1e-9));
    frames.push({
      phase: 'selection',
      headline: 'Roulette-wheel selection',
      description: `Each path is weighted by how far its fitness is below the worst. The best path (fitness ${sorted[0].fitness.toFixed(3)}) is ~${ratio}× as likely to be selected as the worst (${sorted[n - 1].fitness.toFixed(3)}).`,
      individuals: sortedSnap,
      strategy: 'roulette',
      weights,
    });
  } else {
    const eliteTopCount = Math.max(1, Math.floor(n * 0.2));
    frames.push({
      phase: 'selection',
      headline: 'Elitist selection',
      description: `Only the top 20% of the population (${eliteTopCount} of ${n} paths) are eligible as parents. Selection is uniform within this pool — the remaining 80% have zero chance of being chosen.`,
      individuals: sortedSnap,
      strategy: 'elitist',
      eliteTopCount,
    });
  }

  // 4. Breeding example — the real first non-elite child
  if (breeding) {
    const { parentA, parentB, child } = breeding;
    const idxA = sorted.indexOf(parentA);
    const idxB = sorted.indexOf(parentB);
    const parentAId = idxA >= 0 ? label(idxA) : 'parent-a';
    const parentBId = idxB >= 0 ? label(idxB) : 'parent-b';
    const childSnap = snapshot(child, 'child-example');

    frames.push({
      phase: 'breeding',
      headline: config.crossoverStrategy === 'uniform' ? 'Uniform crossover' : 'Single-point crossover',
      description: crossoverDescription(config, breeding),
      individuals: sortedSnap,
      nextGen: eliteSnap,
      parentAId,
      parentBId,
      child: childSnap,
      crossoverStrategy: config.crossoverStrategy,
      cut: breeding.cut,
      geneMask: breeding.geneMask,
      didCrossover: breeding.didCrossover,
    });

    // 5. Mutation example
    frames.push({
      phase: 'mutating',
      headline: config.mutationStrategy === 'segment' ? 'Segment mutation' : 'Point mutation',
      description: mutationDescription(config, breeding),
      individuals: sortedSnap,
      nextGen: eliteSnap,
      childId: 'child-example',
      didMutate: breeding.didMutate,
      beforePath: breeding.beforeMutation,
      afterPath: child.path,
      mutatedIndices: breeding.mutatedIndices,
    });
  }

  // 6. New generation complete
  const newGenSnap = snap(nextGen);
  frames.push({
    phase: 'newGen',
    headline: 'New generation',
    description: `Breeding is complete. The new population of ${config.populationSize} replaces the old one. Mean fitness: ${(nextGen.reduce((s, i) => s + i.fitness, 0) / nextGen.length).toFixed(3)}.`,
    individuals: newGenSnap,
  });

  // 7. Win check
  const solutionIds = nextGen
    .map((ind, i) => (ind.isSolution ? `ind-${i}` : null))
    .filter((id): id is string => id !== null);
  const solutions = nextGen.filter((i) => i.isSolution);
  const solved = solutions.length >= solutionThreshold;
  frames.push({
    phase: 'winCheck',
    headline: solved ? 'Solved!' : 'Win check',
    description: solved
      ? `${solutions.length} paths reach the goal — at least ${solutionThreshold} required. The EA has solved the maze!`
      : `${solutions.length} of ${solutionThreshold} required paths reach the goal. The search continues.`,
    individuals: newGenSnap,
    solutionIds,
    count: solutions.length,
    threshold: solutionThreshold,
    solved,
  });

  return frames;
}

// ── Phase description helpers ─────────────────────────────────────────────

function crossoverDescription(config: EAConfig, breeding: BreedingRecord): string {
  const { didCrossover, cut, geneMask, beforeMutation } = breeding;
  if (!didCrossover) {
    return `Crossover was skipped this time (the ${(config.crossoverRate * 100).toFixed(0)}% gate didn't fire). The child starts as a direct clone of Parent A — any change comes from mutation alone.`;
  }
  if (config.crossoverStrategy === 'singlePoint') {
    return `Single-point crossover: the child follows Parent A's moves up to step ${cut ?? 0}, then switches to Parent B's route for the rest. The splice produces a ${beforeMutation.length}-move path that braids the two parents.`;
  }
  const fromA = geneMask ? geneMask.filter(Boolean).length : 0;
  return `Uniform crossover: each of the ${beforeMutation.length} moves is independently copied from either parent (here ${fromA} from Parent A, ${beforeMutation.length - fromA} from Parent B).`;
}

function mutationDescription(config: EAConfig, breeding: BreedingRecord): string {
  if (!breeding.didMutate || breeding.mutatedIndices.length === 0) {
    return `Mutation was skipped (or changed nothing) this time, so the child keeps its post-crossover path unchanged.`;
  }
  const count = breeding.mutatedIndices.length;
  if (config.mutationStrategy === 'segment') {
    return `Segment mutation re-randomizes a contiguous block of moves — here ${count} step${count > 1 ? 's' : ''} — making the path fork at that point. The block shrinks each generation (decay ${config.mutationDecay}).`;
  }
  return `Point mutation re-picks ${count} move${count > 1 ? 's' : ''} at random (per-gene probability shrinks each generation, decay ${config.mutationDecay}). Each flipped move kinks the path at that cell.`;
}
