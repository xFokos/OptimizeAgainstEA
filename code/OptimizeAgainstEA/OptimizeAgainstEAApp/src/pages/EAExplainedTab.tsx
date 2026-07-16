import { useMemo, useState } from 'react';
import {
    ExplainerFlow, CrossoverVisual, MutationVisual, GenerationsVisual,
    PlaneRosterVisual, PlaneThrowVisual,
    PlaneDnaSliders, PlaneDnaPreview, PLANE_SIZE_GENE, PLANE_DNA_START,
} from '../components/explainer';
import type { ExplainerStep } from '../components/explainer';

// ─────────────────────────────────────────────────────────────────────────
//  Der generelle EA-Walkthrough auf dem Dashboard — bewusst HIGH LEVEL und
//  spielunabhängig. Ein einziges Beispiel trägt den ganzen Bogen: einen
//  Papierflieger falten, der möglichst weit fliegt. Das Beispiel ist genau
//  deshalb gewählt, weil man die Wurfweite nicht ausrechnen KANN — man muss
//  werfen und messen. Dieselbe Situation wie in den Spielen: man kann den
//  besten Agenten nicht berechnen, nur spielen lassen.
//
//  Details (welche Gene, welche Fitness, welche Einstellungen) gehören NICHT
//  hierher — die erklären die Tutorials im jeweiligen Spiel.
// ─────────────────────────────────────────────────────────────────────────

const CROSSOVER_GENES = [
    { label: 'Wing width',  parentA: 0.7, parentB: 0.2, fromA: true },
    { label: 'Fold angle',  parentA: 0.3, parentB: 0.8, fromA: false },
    { label: 'Nose weight', parentA: 0.6, parentB: 0.3, fromA: true },
    { label: 'Tail flap',   parentA: 0.2, parentB: 0.6, fromA: false },
    { label: 'Balance',     parentA: 0.5, parentB: 0.4, fromA: true },
];

const MUTATION_CHANGES = [
    { label: 'Tail flap', before: 0.6, after: 0.75 },
    { label: 'Balance',   before: 0.5, after: 0.35 },
];

const GENERATIONS_EARLY = [
    { fitness: 0.22 }, { fitness: 0.41 }, { fitness: 0.18 }, { fitness: 0.33 },
    { fitness: 0.27 }, { fitness: 0.45 }, { fitness: 0.31 }, { fitness: 0.24 },
];

const GENERATIONS_LATER = [
    { fitness: 0.71 }, { fitness: 0.84 }, { fitness: 0.68 }, { fitness: 0.92, color: '#60a5fa' },
    { fitness: 0.77 }, { fitness: 0.65 }, { fitness: 0.88, color: '#f97316' }, { fitness: 0.73 },
];

// Die Steps hängen an der DNA, die der Leser im DNA-Step selbst zieht — daher
// eine Funktion und kein Modul-Konstante.
function buildSteps(dna: number[], onGene: (i: number, v: number) => void): ExplainerStep[] {
    return [
    {
        id:    'problem',
        title: 'The Problem — you can\'t calculate it',
        body:  "Imagine you fold a paper plane with to goal to throw it as far as possible. How far one flies depends on how it's built: the wings, the angle of the folds and so on. Building it just a bit different leads to vastly different results. You can not know how far the plane will fly, you'll just have to try.",
        sideVisual: <PlaneThrowVisual />,
    },
    {
        id:    'fitness',
        title: 'Score — Fitness',
        body:  "You can't predict, but you can measure one. Throw three planes and you get three scores: 4.2m, 7.6m, 5.9m. You might not know why one flew furthest, and you don't need to. You just know it did. In evolutionary algorithms this score has a name: fitness and it's the score of how well an algorithm performed.",
        sideVisual: <PlaneThrowVisual mode="measure" />,
    },
    {
        id:    'dna',
        title: 'DNA — the plane as numbers',
        body:  "The DNA symbolises the properties the paper plane. Its size, the kind of paper, the way it's folded. Each one is a number. Drag the slider and watch the plane change. Of course in reality a paper plane depends on far more than the few properties.",
        visual:     <PlaneDnaSliders dna={dna} onChange={onGene} genes={PLANE_SIZE_GENE} />,
        sideVisual: <PlaneDnaPreview dna={dna} genes={PLANE_SIZE_GENE} />,
    },
    {
        id:    'population',
        title: 'The Population — a whole batch',
        body:  "To get somewhere useful with the algorithm, we use a population — a group of slightly different paper planes, all derived from the same base model. Every one of them gets thrown, and every one gets its own score — its fitness. That's one generation.",
        sideVisual: <PlaneThrowVisual mode="population" />,
    },
    {
        id:    'selection',
        title: 'Selection — keep what flew',
        body:  "The two that flew furthest become the parents of the next batch. The rest get thrown away. Nothing clever happens here — you simply keep what worked.",
        sideVisual: <PlaneThrowVisual mode="selection" />,
    },
    {
        id:    'crossover',
        title: 'Crossover — mix the parents',
        body:  "A new plane is built from both parents: the wings of one, the nose of the other. Their DNA gets combined gene by gene, so good ideas from two different planes end up in the same one.",
        visual: <CrossoverVisual genes={CROSSOVER_GENES} />,
    },
    {
        id:    'mutation',
        title: 'Mutation — bend something at random',
        body:  "Then a few numbers get nudged a little, at random. Most of the time that makes the plane worse. But now and then it finds a fold nobody would have thought of — and without it, you could only ever reshuffle what you already had.",
        visual:     <MutationVisual changes={MUTATION_CHANGES} />,
        sideVisual: <PlaneRosterVisual variant="mutation" count={12} />,
    },
    {
        id:    'loop',
        title: 'The Loop — and that\'s the whole trick',
        body:  "Throw, keep the best, mix, mutate, repeat. No single step is smart, but after enough rounds the planes fly twice as far — and nobody can explain why exactly that fold works. It just won. That's an evolutionary algorithm, and it's what you're playing against here: every game defines its own DNA and its own fitness, and its tutorial shows you which.",
        visual: <GenerationsVisual early={GENERATIONS_EARLY} later={GENERATIONS_LATER} />,
        sideVisual: <PlaneRosterVisual variant="generations" count={12} />,
    },
    ];
}

interface EAExplainedTabProps {
    /** Letzter Step: "Pick a game →"-Button neben Back — wechselt zur
     * Game Selection (vom Dashboard durchgereicht). */
    onFinish?: () => void;
}

export function EAExplainedTab({ onFinish }: EAExplainedTabProps) {
    const [dna, setDna] = useState<number[]>(PLANE_DNA_START);
    const steps = useMemo(
        () => buildSteps(dna, (i, v) => setDna(prev => prev.map((g, j) => (j === i ? v : g)))),
        [dna],
    );

    // ExplainerFlow fills whatever box it's given (its Compi mascot is
    // anchored to that box's bottom-left) — without this wrapper, "bottom"
    // would mean the bottom of the flow's own content height, not the tab's
    // visible area, and stacking it directly under .page-title (a plain
    // block sibling) would just make the page taller instead of filling it.
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h1 className="page-title">EA Explained</h1>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <ExplainerFlow steps={steps} onFinish={onFinish} finishLabel="Pick a game →" />
            </div>
        </div>
    );
}
