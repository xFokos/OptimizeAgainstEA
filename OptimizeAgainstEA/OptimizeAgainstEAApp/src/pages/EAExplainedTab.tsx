import { ExplainerFlow, CrossoverVisual, MutationVisual, GenerationsVisual, GenomeVisual, SearchSpaceVisual, CreatureRosterVisual } from '../components/explainer';
import type { ExplainerStep } from '../components/explainer';

// ─────────────────────────────────────────────────────────────────────────
//  Generic, game-agnostic walkthrough of how an Evolutionary Algorithm
//  works — from scratch, assuming zero prior knowledge: The Problem →
//  Fitness → DNA → Population → Selection → Crossover → Mutation → The
//  Loop. Deliberately NO shooter visuals here (CreatureRosterVisual instead
//  of the game tutorials' arena canvases) — one running example carries the
//  whole arc: breeding a creature for an obstacle course.
// ─────────────────────────────────────────────────────────────────────────

const GENOME_GENES = [
    { label: 'Speed',    value: 0.78 },
    { label: 'Strength', value: 0.34 },
    { label: 'Sight',    value: 0.61 },
    { label: 'Stealth',  value: 0.22 },
    { label: 'Stamina',  value: 0.55 },
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
        id:    'problem',
        title: 'The Problem — you can\'t try everything',
        body:  "Imagine breeding a creature for an obstacle course: how fast should it be, how strong, how sneaky? Just five traits already give millions of possible combinations — far too many to ever test, and no formula points at the best mix. The only thing you CAN do: build one creature, let it run the course, and see how it does. On the right, every bar is one design being tried — the landscape of all possibilities stays hidden.",
        sideVisual: <SearchSpaceVisual axisLabel="every possible creature →" />,
    },
    {
        id:    'fitness',
        title: 'Fitness — grading every try',
        body:  "So the first thing we need is a score. Send a creature through the course and it comes back with one number — its fitness: how far did it get, how fast? That's the only feedback there is; from here on, everything revolves around comparing those numbers. Every game on this site simply defines its own fitness.",
        sideVisual: <SearchSpaceVisual showScores axisLabel="every possible creature →" />,
    },
    {
        id:    'dna',
        title: 'DNA — a creature as numbers',
        body:  "To breed creatures, each one is written down as a fixed list of numbers — its genes. Our creature is just these five numbers between 0 and 1; nothing more. That's the whole trick: anything you can encode as a list of numbers, you can evolve.",
        visual: <GenomeVisual genes={GENOME_GENES} />,
    },
    {
        id:    'population',
        title: 'The Population — many creatures at once',
        body:  "One creature alone tells you almost nothing — a single lucky or unlucky run would steer everything. So the algorithm keeps a whole population: dozens of individuals, each with its own DNA, all graded by the same fitness. Replace the whole roster with a new one, and that's the next generation — watch it on the right.",
        sideVisual: <CreatureRosterVisual variant="lineup" count={10} />,
    },
    {
        id:    'selection',
        title: 'Selection — the fittest get to breed',
        body:  "Now the breeding loop begins. The individuals with the best fitness are picked to become parents for the next generation — the rest are dropped. Watch the two parents get picked on the right.",
        sideVisual: <CreatureRosterVisual variant="selection" count={10} />,
    },
    {
        id:    'crossover',
        title: 'Crossover — two parents, one child',
        body:  "A child is built by taking each gene from one parent or the other — mixing successful traits from both without inventing anything new.",
        visual: <CrossoverVisual genes={CROSSOVER_GENES} />,
    },
    {
        id:    'mutation',
        title: 'Mutation — small random tweaks',
        body:  "After crossover, a few genes get nudged by a small random amount. Without this, the population could only ever recombine traits it already had — mutation is what lets it stumble onto something genuinely new.",
        visual: <MutationVisual changes={MUTATION_CHANGES} />,
    },
    {
        id:    'loop',
        title: 'The Loop — repeat, and it gets better',
        body:  "Select, cross over, mutate — then do it all again with the new population, generation after generation. No single step is smart on its own, but repeated enough times, the population reliably drifts toward better creatures. And that's exactly what you play against in every game on this site — only the creatures and the fitness change.",
        visual: <GenerationsVisual early={GENERATIONS_EARLY} later={GENERATIONS_LATER} />,
        sideVisual: <CreatureRosterVisual variant="generations" count={10} />,
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
