import { ExplainerFlow, PopulationVisual, CrossoverVisual, MutationVisual, GenerationsVisual } from '../components/explainer';
import type { ExplainerStep } from '../components/explainer';

// ─────────────────────────────────────────────────────────────────────────
//  Generic, game-agnostic walkthrough of how an Evolutionary Algorithm
//  works — Selection -> Crossover -> Mutation -> Generations. Every game on
//  this site (Shooter, Horde, BattleShips, ...) is an application of these
//  same four ideas; this tab is where a first-timer meets them once,
//  without any one game's specific vocabulary.
// ─────────────────────────────────────────────────────────────────────────

const SELECTION_POPULATION = [
    { fitness: 0.35 }, { fitness: 0.62 }, { fitness: 0.48 },
    { fitness: 0.81, color: '#f97316' }, { fitness: 0.29 }, { fitness: 0.55 },
    { fitness: 0.90, color: '#60a5fa' }, { fitness: 0.44 }, { fitness: 0.67 }, { fitness: 0.38 },
];

const CROSSOVER_GENES = [
    { label: 'Speed',    parentA: 0.7, parentB: 0.2, fromA: true },
    { label: 'Strength', parentA: 0.3, parentB: 0.8, fromA: false },
    { label: 'Sight',    parentA: 0.6, parentB: 0.3, fromA: true },
    { label: 'Stealth',  parentA: 0.2, parentB: 0.6, fromA: false },
    { label: 'Stamina',  parentA: 0.5, parentB: 0.4, fromA: true },
];

const MUTATION_CHANGES = [
    { label: 'Stealth',  before: 0.6, after: 0.75 },
    { label: 'Stamina',  before: 0.5, after: 0.35 },
];

const GENERATIONS_EARLY = [
    { fitness: 0.22 }, { fitness: 0.41 }, { fitness: 0.18 }, { fitness: 0.33 },
    { fitness: 0.27 }, { fitness: 0.45 }, { fitness: 0.31 }, { fitness: 0.24 },
];

const GENERATIONS_LATER = [
    { fitness: 0.71 }, { fitness: 0.84 }, { fitness: 0.68 }, { fitness: 0.92, color: '#60a5fa' },
    { fitness: 0.77 }, { fitness: 0.65 }, { fitness: 0.88, color: '#f97316' }, { fitness: 0.73 },
];

const STEPS: ExplainerStep[] = [
    {
        id:    'selection',
        title: 'Selection — the fittest get to breed',
        body:  "An evolutionary algorithm never bets on a single answer. It keeps a whole population of candidate solutions, scores each one with a fitness function — a number saying how well it solves the problem — and picks mostly from the top of that ranking to become parents for the next generation.",
        visual: <PopulationVisual population={SELECTION_POPULATION} />,
    },
    {
        id:    'crossover',
        title: 'Crossover — two parents, one child',
        body:  "Each parent's solution is broken into pieces (\"genes\"). A child is built by taking each gene from one parent or the other, mixing successful traits from both without inventing anything new.",
        visual: <CrossoverVisual genes={CROSSOVER_GENES} />,
    },
    {
        id:    'mutation',
        title: 'Mutation — small random tweaks',
        body:  "After crossover, a few genes get nudged by a small random amount. Without this, the population could only ever recombine traits it already had — mutation is what lets it stumble onto something genuinely new.",
        visual: <MutationVisual changes={MUTATION_CHANGES} />,
    },
    {
        id:    'generations',
        title: 'Generations — repeat, and it gets better',
        body:  "Select, cross over, mutate — then do it again with the new population, generation after generation. No single step is smart on its own, but repeated enough times, the population as a whole reliably drifts toward better solutions.",
        visual: <GenerationsVisual early={GENERATIONS_EARLY} later={GENERATIONS_LATER} />,
    },
];

export function EAExplainedTab() {
    // ExplainerFlow fills whatever box it's given (its Compi mascot is
    // anchored to that box's bottom-left) — without this wrapper, "bottom"
    // would mean the bottom of the flow's own content height, not the tab's
    // visible area, and stacking it directly under .page-title (a plain
    // block sibling) would just make the page taller instead of filling it.
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h1 className="page-title">EA Explained</h1>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <ExplainerFlow steps={STEPS} />
            </div>
        </div>
    );
}
