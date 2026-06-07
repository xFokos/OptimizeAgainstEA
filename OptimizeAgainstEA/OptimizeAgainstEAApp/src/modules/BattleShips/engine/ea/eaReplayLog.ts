import type { Coordinate } from '../../types/map';
import type { Individual, EAConfig, SelectionStrategy, CrossoverStrategy } from '../../types/ea';

// ── Per-individual snapshot used in every frame ───────────────────────────

export interface IndividualSnapshot {
  id:         string;
  position:   Coordinate;
  fitness:    number;
  isSolution: boolean;
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
  child:             IndividualSnapshot;
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
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  // Give every individual a stable string id for this replay
  const label = (i: number) => `ind-${i}`;
  const snap  = (pop: Individual[]) => pop.map((ind, i) => snapshot(ind, label(i)));

  const initialSnaps = snap(before);

  // 1. Initial — unsorted order
  frames.push({
    phase:       'initial',
    headline:    'Population',
    description: `Generation begins with ${config.populationSize} individuals spread across the map. Each dot is one candidate solution.`,
    individuals: initialSnaps,
  });

  // 2. Sorted by fitness
  const sorted     = [...before].sort((a, b) => a.fitness - b.fitness);
  const sortedSnap = snap(sorted);
  frames.push({
    phase:       'sorted',
    headline:    'Ranked by fitness',
    description: 'Individuals are sorted best-first. Lower fitness = closer to a minimum. The best will be preferred for breeding.',
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
    const i1 = 0;
    const i2 = Math.min(Math.floor(n / 3), n - 1);
    const i3 = Math.min(Math.floor(2 * n / 3), n - 1);
    const candidateIds = [...new Set([label(i1), label(i2), label(i3)])];
    frames.push({
      phase:        'selection',
      headline:     'Tournament selection (k = 3)',
      description:  `Three individuals are drawn at random — here rank #${i1 + 1} (fitness ${sorted[i1].fitness.toFixed(3)}), #${i2 + 1} (${sorted[i2].fitness.toFixed(3)}), and #${i3 + 1} (${sorted[i3].fitness.toFixed(3)}). The fittest of the three wins and becomes a parent. A second tournament picks the other parent.`,
      individuals:  sortedSnap,
      strategy:     'tournament',
      candidateIds,
      winnerId:     label(i1),
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

  // 4. One breeding example (first non-elite child)
  const firstChild = nextGen[eliteCount];
  if (firstChild) {
    const parentA    = sorted[0];
    const parentB    = sorted[1];
    const childSnap  = snapshot(firstChild, 'child-example');

    let geneSource: { xFromA: boolean; yFromA: boolean } | undefined;
    if (config.crossoverStrategy === 'uniform' || config.crossoverStrategy === 'singlePoint') {
      geneSource = {
        xFromA: Math.abs(firstChild.position.x - parentA.position.x) <= Math.abs(firstChild.position.x - parentB.position.x),
        yFromA: Math.abs(firstChild.position.y - parentA.position.y) <= Math.abs(firstChild.position.y - parentB.position.y),
      };
    }

    frames.push({
      phase:             'breeding',
      headline:          `${config.crossoverStrategy === 'arithmetic' ? 'Arithmetic' : config.crossoverStrategy === 'uniform' ? 'Uniform' : 'Single-point'} crossover`,
      description:       crossoverDescription(config, parentA, parentB, firstChild),
      individuals:       sortedSnap,
      nextGen:           eliteSnap,
      parentAId:         label(0),
      parentBId:         label(1),
      child:             childSnap,
      crossoverStrategy: config.crossoverStrategy,
      alpha:             config.crossoverStrategy === 'arithmetic' ? 0.5 : undefined,
      geneSource,
      didCrossover:      true,
    });

    // 5. Mutation example
    frames.push({
      phase:       'mutating',
      headline:    `${config.mutationStrategy === 'gaussian' ? 'Gaussian' : config.mutationStrategy === 'cauchy' ? 'Cauchy' : 'Uniform'} mutation`,
      description: mutationDescription(config),
      individuals: sortedSnap,
      nextGen:     eliteSnap,
      childId:     'child-example',
      before:      parentA.position,
      after:       firstChild.position,
      delta: {
        x: firstChild.position.x - parentA.position.x,
        y: firstChild.position.y - parentA.position.y,
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

function crossoverDescription(
  config:   EAConfig,
  parentA:  Individual,
  parentB:  Individual,
  child:    Individual,
): string {
  const ax = parentA.position.x.toFixed(3);
  const ay = parentA.position.y.toFixed(3);
  const bx = parentB.position.x.toFixed(3);
  const by = parentB.position.y.toFixed(3);
  const cx = child.position.x.toFixed(3);
  const cy = child.position.y.toFixed(3);

  switch (config.crossoverStrategy) {
    case 'arithmetic':
      return `Two parents are blended with a random weight α. Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}) produce child (${cx}, ${cy}) = α×A + (1-α)×B.`;
    case 'uniform':
      return `Each gene is independently drawn from either parent. Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}) produce child (${cx}, ${cy}) — x from one parent, y from the other.`;
    case 'singlePoint':
      return `One parent contributes x and the other contributes y. Parent A (${ax}, ${ay}) and Parent B (${bx}, ${by}) produce child (${cx}, ${cy}).`;
  }
}

function mutationDescription(config: EAConfig): string {
  switch (config.mutationStrategy) {
    case 'gaussian':
      return `A small normally-distributed offset is added to the child's position. The perturbation shrinks each generation (decay ${config.mutationDecay}) so early generations explore broadly and later ones fine-tune.`;
    case 'uniform':
      return `A random offset drawn uniformly within ±${config.mutationStrength.toFixed(2)} is added to the child's position.`;
    case 'cauchy':
      return `A Cauchy-distributed offset is added — mostly small steps but occasionally large jumps, helping the EA escape local minima.`;
  }
}