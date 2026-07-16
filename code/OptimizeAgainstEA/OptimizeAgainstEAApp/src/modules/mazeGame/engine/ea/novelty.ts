import type { Individual } from '../../types/ea';

/**
 * Novelty search scorer. Instead of rewarding closeness to the goal, it rewards
 * each individual for ending up somewhere FEW others (now or in the past) have
 * ended up. This is the canonical maze-deception demo (Lehman & Stanley):
 * objective-chasing gets trapped, but pure exploration floods the maze and
 * stumbles onto the exit — "not aiming at the goal works better?!".
 *
 * Behavior descriptor = the final cell the agent settles on. Novelty = mean
 * distance to the k nearest behaviors among the current population PLUS an
 * archive of every distinct final cell explored so far. Because it depends on
 * the whole population + archive, novelty cannot be a pure per-individual
 * `evaluate(walk)` — the stepper applies this scorer to the population each gen.
 */

export interface NoveltyScorer {
  /** Assigns each individual's `fitness` (lower = more novel) and grows the archive. */
  score: (pop: Individual[]) => void;
  /** Distinct explored final-cell behaviors so far (for visualization). */
  archiveSize: () => number;
}

const DEFAULT_K = 15;

export function createNoveltyScorer(cols: number, rows: number, k: number = DEFAULT_K): NoveltyScorer {
  const archive: { x: number; y: number }[] = [];
  const seen = new Set<number>(); // dedup archive by cell index
  const maxDist = Math.hypot(cols, rows);

  const bd = (ind: Individual) => {
    const c = ind.walk.finalCell;
    return { x: c % cols, y: Math.floor(c / cols) };
  };

  const score = (pop: Individual[]) => {
    const behaviors = pop.map(bd);
    const ref = archive.concat(behaviors);

    for (let i = 0; i < pop.length; i++) {
      const b = behaviors[i];
      const dists: number[] = [];
      for (const r of ref) dists.push(Math.hypot(b.x - r.x, b.y - r.y));
      dists.sort((p, q) => p - q);
      // dists[0] is this individual's own behavior (distance 0) — skip it.
      const kk = Math.min(k, dists.length - 1);
      let sum = 0;
      for (let j = 1; j <= kk; j++) sum += dists[j];
      const novelty = kk > 0 ? sum / kk : 0;
      // Lower fitness = more novel = "better" for the minimizing EA.
      pop[i].fitness = 1 - Math.min(1, novelty / maxDist);
    }

    // Grow the archive with every newly-explored final cell.
    for (let i = 0; i < pop.length; i++) {
      const c = pop[i].walk.finalCell;
      if (!seen.has(c)) {
        seen.add(c);
        archive.push(behaviors[i]);
      }
    }
  };

  return { score, archiveSize: () => archive.length };
}
