import type { Coordinate } from '../../types/map';
import type { Individual, EAConfig, SelectionStrategy, CrossoverStrategy } from '../../types/ea';

// ── Per-individual snapshot used in every frame ───────────────────────────

export interface IndividualSnapshot {
  id:         string;
  position:   Coordinate;
  fitness:    number;
  isSolution: boolean;
}

// ── What actually happened when one child was bred ────────────────────────
// Captured live inside breedNext so the replay shows the real parents and
// the real random choices, instead of guessing them after the fact.

export interface BreedingRecord {
  parentA:        Individual;
  parentB:        Individual;
  didCrossover:   boolean;
  alpha?:         number;                               // arithmetic blend factor
  geneSource?:    { xFromA: boolean; yFromA: boolean }; // uniform / singlePoint
  beforeMutation: Coordinate;                           // child after crossover, before mutation
  didMutate:      boolean;
  child:          Individual;                           // final clamped + evaluated child
}

// ── Frame union — one per animation step ─────────────────────────────────

export type ReplayFrame =
  | {
  phase:       'initial';
  headline:    string;
  description: string;
  individuals: IndividualSnapshot[];
}
  | {
  phase:          'selection';
  headline:       string;
  description:    string;
  individuals:    IndividualSnapshot[];   // sorted by fitness
  strategy:       SelectionStrategy;
  // tournament
  candidateIds?:  string[];
  winnerId?:      string;
  // roulette — parallel to individuals, normalized 0–1 (best = 1.0)
  weights?:       number[];
  // elitist
  eliteTopCount?: number;
}
  | {
  phase:       'sorted';
  headline:    string;
  description: string;
  individuals: IndividualSnapshot[]; // now in fitness order
}
  | {
  phase:       'elite';
  headline:    string;
  description: string;
  individuals: IndividualSnapshot[];
  eliteIds:    string[];
  nextGen:     IndividualSnapshot[]; // just the elites so far
}
  | {
  phase:             'breeding';
  headline:          string;
  description:       string;
  individuals:       IndividualSnapshot[];
  nextGen:           IndividualSnapshot[];
  parentAId:         string;
  parentBId:         string;
  child:             IndividualSnapshot;  // final child (post-mutation) — used in the side list
  crossoverResult:   Coordinate;          // child position straight out of crossover, pre-mutation
  crossoverStrategy: CrossoverStrategy;
  alpha?:            number;
  geneSource?:       { xFromA: boolean; yFromA: boolean };
  didCrossover:      boolean;
}
  | {
  phase:       'mutating';
  headline:    string;
  description: string;
  individuals: IndividualSnapshot[];
  nextGen:     IndividualSnapshot[];
  childId:     string;
  didMutate:   boolean;
  before:      Coordinate;
  after:       Coordinate;
  delta:       Coordinate;
}
  | {
  phase:       'newGen';
  headline:    string;
  description: string;
  individuals: IndividualSnapshot[]; // the completed next generation
}
  | {
  phase:        'winCheck';
  headline:     string;
  description:  string;
  individuals:  IndividualSnapshot[];
  solutionIds:  string[];
  count:        number;
  threshold:    number;
  solved:       boolean;
};

// ── Helper to snapshot an Individual with a stable id ────────────────────

export function snapshot(ind: Individual, id: string): IndividualSnapshot {
  return { id, position: { ...ind.position }, fitness: ind.fitness, isSolution: ind.isSolution };
}

// ── Build a full replay for one generation ────────────────────────────────
// Called from inside createEAStepper when replay logging is enabled.

export function buildReplayFrames(
  before:     Individual[],   // population at start of generation (sorted)
  nextGen:    Individual[],   // completed next generation
  eliteCount: number,
  config:     EAConfig,
  solutionThreshold: number,
  breeding?:  BreedingRecord, // the real first non-elite breeding event
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  // Give every individual a stable string id for this replay
  const label = (i: number) => `ind-${i}`;
  const snap  = (pop: Individual[]) => pop.map((ind, i) => snapshot(ind, label(i)));

  // 1. Population, ranked by fitness. (`before` is already sorted by the stepper,
  // so a separate unsorted "initial" frame would be an identical no-op step.)
  const sorted     = [...before].sort((a, b) => a.fitness - b.fitness);
  const sortedSnap = snap(sorted);
  frames.push({
    phase:       'sorted',
    headline:    'Population — ranked by fitness',
    description: `The generation begins with ${config.populationSize} individuals spread across the map — each dot is one candidate solution. They are sorted best-first: lower fitness = closer to a minimum. The best will be preferred for breeding.`,
    individuals: sortedSnap,
  });

  // 3. Elitism
  const elites    = sorted.slice(0, eliteCount);
  const eliteSnap = snap(elites);
  const eliteIds  = eliteSnap.map((s) => s.id);
  frames.push({
    phase:       'elite',
    headline:    `Elitism — top ${eliteCount} survive`,
    description: `The best ${eliteCount} individual${eliteCount > 1 ? 's are' : ' is'} copied directly into the next generation unchanged. This guarantees the population never gets worse.`,
    individuals: sortedSnap,
    eliteIds,
    nextGen:     eliteSnap,
  });

  // 3.5. Selection example
  const n = sortedSnap.length;
  if (config.selectionStrategy === 'tournament') {
    // Draw three *distinct* random candidates (k = 3), mirroring the real
    // tournamentSelection operator. `sorted` is best-first, so the fittest of
    // the draw is simply the one with the lowest rank index.
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
      phase:        'selection',
      headline:     'Tournament selection (k = 3)',
      description:  `Three individuals are drawn at random — here rank ${list}. The fittest of the three wins and becomes a parent. A second tournament picks the other parent.`,
      individuals:  sortedSnap,
      strategy:     'tournament',
      candidateIds,
      winnerId:     label(winnerIdx),
    });
  } else if (config.selectionStrategy === 'roulette') {
    const maxFit    = sorted[n - 1].fitness;
    const rawW      = sorted.map((ind) => maxFit - ind.fitness + 1e-6);
    const maxW      = rawW[0];
    const weights   = rawW.map((w) => w / maxW);
    const ratio     = Math.round(weights[0] / Math.max(weights[n - 1], 1e-9));
    frames.push({
      phase:       'selection',
      headline:    'Roulette-wheel selection',
      description: `Each individual is weighted by how far its fitness is below the worst. The best individual (fitness ${sorted[0].fitness.toFixed(3)}) is ~${ratio}× as likely to be selected as the worst (${sorted[n - 1].fitness.toFixed(3)}).`,
      individuals: sortedSnap,
      strategy:    'roulette',
      weights,
    });
  } else {
    const eliteTopCount = Math.max(1, Math.floor(n * 0.2));
    frames.push({
      phase:         'selection',
      headline:      'Elitist selection',
      description:   `Only the top 20% of the population (${eliteTopCount} of ${n} individuals) are eligible as parents. Selection is uniform within this pool — the remaining 80% have zero chance of being chosen.`,
      individuals:   sortedSnap,
      strategy:      'elitist',
      eliteTopCount,
    });
  }

  // 4. One breeding example — the real first non-elite child, as it was bred
  if (breeding) {
    const { parentA, parentB, child } = breeding;

    // Locate the real parents within the sorted population so the map can
    // highlight them. `sorted` shares object references with `before`.
    const idxA = sorted.indexOf(parentA);
    const idxB = sorted.indexOf(parentB);
    const parentAId = idxA >= 0 ? label(idxA) : 'parent-a';
    const parentBId = idxB >= 0 ? label(idxB) : 'parent-b';

    const childSnap = snapshot(child, 'child-example');

    frames.push({
      phase:             'breeding',
      headline:          `${config.crossoverStrategy === 'arithmetic' ? 'Arithmetic' : config.crossoverStrategy === 'uniform' ? 'Uniform' : 'Single-point'} crossover`,
      description:       crossoverDescription(config, breeding),
      individuals:       sortedSnap,
      nextGen:           eliteSnap,
      parentAId,
      parentBId,
      child:             childSnap,
      crossoverResult:   breeding.beforeMutation,
      crossoverStrategy: config.crossoverStrategy,
      alpha:             breeding.alpha,
      geneSource:        breeding.geneSource,
      didCrossover:      breeding.didCrossover,
    });

    // 5. Mutation example — the actual offset applied to this child
    frames.push({
      phase:       'mutating',
      headline:    `${config.mutationStrategy === 'gaussian' ? 'Gaussian' : config.mutationStrategy === 'cauchy' ? 'Cauchy' : 'Uniform'} mutation`,
      description: mutationDescription(config, breeding.didMutate),
      individuals: sortedSnap,
      nextGen:     eliteSnap,
      childId:     'child-example',
      didMutate:   breeding.didMutate,
      before:      breeding.beforeMutation,
      after:       child.position,
      delta: {
        x: child.position.x - breeding.beforeMutation.x,
        y: child.position.y - breeding.beforeMutation.y,
      },
    });
  }

  // 6. New generation complete
  const newGenSnap = snap(nextGen);
  frames.push({
    phase:       'newGen',
    headline:    'New generation',
    description: `Breeding is complete. The new population of ${config.populationSize} replaces the old one. Mean fitness: ${(nextGen.reduce((s, i) => s + i.fitness, 0) / nextGen.length).toFixed(3)}.`,
    individuals: newGenSnap,
  });

  // 7. Win check
  const solutionIds = nextGen
    .map((ind, i) => (ind.isSolution ? `ind-${i}` : null))
    .filter((id): id is string => id !== null);
  const solutions = nextGen.filter((i) => i.isSolution);
  const solved      = solutions.length >= solutionThreshold;
  frames.push({
    phase:        'winCheck',
    headline:     solved ? 'Solved!' : 'Win check',
    description:  solved
      ? `${solutions.length} individuals are inside the win radius — at least ${solutionThreshold} required. The EA has found the global minimum!`
      : `${solutions.length} of ${solutionThreshold} required individuals are inside the win radius. The search continues.`,
    individuals:  newGenSnap,
    solutionIds,
    count:        solutions.length,
    threshold:    solutionThreshold,
    solved,
  });

  return frames;
}

// ── Phase description helpers ─────────────────────────────────────────────

function crossoverDescription(config: EAConfig, breeding: BreedingRecord): string {
  const { parentA, parentB, beforeMutation, didCrossover, alpha, geneSource } = breeding;
  const ax = parentA.position.x.toFixed(3);
  const ay = parentA.position.y.toFixed(3);
  const bx = parentB.position.x.toFixed(3);
  const by = parentB.position.y.toFixed(3);
  // The child shown is post-mutation; the crossover output is `beforeMutation`.
  const cx = beforeMutation.x.toFixed(3);
  const cy = beforeMutation.y.toFixed(3);

  if (!didCrossover) {
    return `Crossover was skipped this time (the ${(config.crossoverRate * 100).toFixed(0)}% gate didn't fire). The child starts as a direct clone of Parent A (${ax}, ${ay}) — any change comes from mutation alone.`;
  }

  switch (config.crossoverStrategy) {
    case 'arithmetic':
      return `Two parents are blended with weight α=${(alpha ?? 0).toFixed(3)}. Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}) produce (${cx}, ${cy}) = α×A + (1-α)×B.`;
    case 'uniform': {
      const xFrom = geneSource?.xFromA ? 'A' : 'B';
      const yFrom = geneSource?.yFromA ? 'A' : 'B';
      return `Each gene is independently drawn from either parent. From Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}): x taken from Parent ${xFrom}, y from Parent ${yFrom} → (${cx}, ${cy}).`;
    }
    case 'singlePoint': {
      const xFrom = geneSource?.xFromA ? 'A' : 'B';
      const yFrom = geneSource?.yFromA ? 'A' : 'B';
      return `One parent contributes x and the other y. From Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}): x from Parent ${xFrom}, y from Parent ${yFrom} → (${cx}, ${cy}).`;
    }
  }
}

function mutationDescription(config: EAConfig, didMutate: boolean): string {
  if (!didMutate) {
    return `Mutation was skipped this time (the ${(config.mutationRate * 100).toFixed(0)}% gate didn't fire), so the child keeps its post-crossover position unchanged.`;
  }
  switch (config.mutationStrategy) {
    case 'gaussian':
      return `A small normally-distributed offset is added to the child's position. The perturbation shrinks each generation (decay ${config.mutationDecay}) so early generations explore broadly and later ones fine-tune.`;
    case 'uniform':
      return `A random offset drawn uniformly within ±${config.mutationStrength.toFixed(2)} is added to the child's position.`;
    case 'cauchy':
      return `A Cauchy-distributed offset is added — mostly small steps but occasionally large jumps, helping the EA escape local minima.`;
  }
}