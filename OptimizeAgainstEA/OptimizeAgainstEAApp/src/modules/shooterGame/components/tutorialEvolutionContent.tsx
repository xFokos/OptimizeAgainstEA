import { useMemo, useState } from 'react';
import { DNA_INDEX, DNA_NAMES, DNA_GENE_INFO, TUTORIAL_DNA, type DNA } from '../shooter.types';
import { ShooterDnaSection, type DnaGeneDescriptor } from '../settings/ShooterSettings';
import { useSettings } from '../../../context/SettingsContext.tsx';
import {
    ExplainerFlow,
    type ExplainerStep,
    type PopulationMember,
    PopulationVisual,
    CrossoverVisual,
    MutationVisual,
} from '../../../components/explainer';
import { DnaPreviewCanvas } from './DnaPreviewCanvas';
import { GhostArenaVisual } from './GhostArenaVisual';

// ─────────────────────────────────────────────────────────────────────────
//  Practice-round tutorial, part 2: "what do these DNA numbers actually do,
//  and how does the EA arrive at new ones". Built on the shared ExplainerFlow
//  system (see components/explainer/) — same building blocks as the
//  Dashboard's "EA Explained" tab, but with the shooter's own gene names,
//  real interactive sliders (reusing ShooterDnaSection from the settings
//  panel), and a live behavior preview (DnaPreviewCanvas) that reacts to
//  them immediately.
//
//  Shown after the practice round ends (see ShooterCanvas's
//  `tutorialEvolutionVisible` / "Learn the DNA" button).
// ─────────────────────────────────────────────────────────────────────────

const COL_A = '#60a5fa';
const COL_B = '#f97316';

const ALL_GENES: DnaGeneDescriptor[] = DNA_NAMES.map(name => ({
    index:   DNA_INDEX[name],
    label:   DNA_GENE_INFO[name].label,
    tooltip: DNA_GENE_INFO[name].tooltip,
}));

const FIRE_RATE_GENE: DnaGeneDescriptor[] = ALL_GENES.filter(g => g.index === DNA_INDEX.FIRE_RATE);

const NEUTRAL_DNA: DNA = new Array(DNA_NAMES.length).fill(0.5);

function useSliderDna(initial: DNA) {
    const [dna, setDna] = useState<DNA>(initial);
    const onChange = (i: number, v: number) => setDna(prev => {
        const next = [...prev];
        next[i] = v;
        return next;
    });
    return [dna, onChange] as const;
}

// Illustrative "how the EA gets its next DNA" story — same 3 mechanisms as
// the Dashboard's EA Explained tab, but using the shooter's own gene names
// so it reads as a continuation of what the player just explored above, plus
// two shooter-specific steps (Population, Ghost Replay) explaining the actual
// mechanism this game uses to score a whole roster without live-replaying
// the player against every one of them — see ShooterCanvas's startRound /
// evolution.ts's presimulateAgainstGhost for the real implementation this
// illustrates.

// Deterministic (not Math.random(), which would re-roll on every re-render),
// but spread out enough to look like a real fitness distribution. Golden-angle
// step avoids an obviously repeating pattern for any population size. Used by
// the Selection step, which highlights the top two as the chosen parents.
function makeIllustrativePopulation(size: number): PopulationMember[] {
    const values = Array.from({ length: size }, (_, i) => 0.28 + 0.6 * Math.abs(Math.sin(i * 2.399913)));
    const [best, second] = [...values].sort((a, b) => b - a);
    return values.map(fitness => ({
        fitness,
        color: fitness === best ? COL_A : fitness === second ? COL_B : undefined,
    }));
}

const PARENT_A: DNA = [0.60, 0.75, 0.50, 0.65, 0.55, 0.70, 0.50, 0.60];
const PARENT_B: DNA = [0.35, 0.30, 0.70, 0.50, 0.35, 0.60, 0.30, 0.50];
const GENE_ORIGINS = [true, false, true, false, true, false, true, false];
// PARENT_A/B crossed over via GENE_ORIGINS, then mutated at indices 2 and 5 —
// kept consistent so Crossover and Mutation steps tell one checkable story.
const FINAL_DNA: DNA = [0.60, 0.30, 0.65, 0.50, 0.55, 0.45, 0.50, 0.50];

const CROSSOVER_GENES = DNA_NAMES.map((name, i) => ({
    label:   DNA_GENE_INFO[name].label,
    parentA: PARENT_A[i],
    parentB: PARENT_B[i],
    fromA:   GENE_ORIGINS[i],
}));

const MUTATION_CHANGES = DNA_NAMES
    .map((name, i) => ({
        label:  DNA_GENE_INFO[name].label,
        before: GENE_ORIGINS[i] ? PARENT_A[i] : PARENT_B[i],
        after:  FINAL_DNA[i],
    }))
    .filter(g => Math.abs(g.before - g.after) > 0.001);

function buildEvolutionSteps(populationSize: number, presimGenerations: number): ExplainerStep[] {
    return [
        {
            id:    'population',
            title: 'The Population',
            body:  `Each of the ${populationSize} candidates on the right is its own individual with its own full DNA. All of them together are one population — the agent you fought was simply its current best. Replace that whole population with a new one, and that's the next generation.`,
            // Same split layout (text left, arena canvas right) as the DNA
            // steps and the next "Ghost Replay" step — introducing the swarm
            // here already, before explaining the mechanism, so it isn't a
            // new element popping in out of nowhere on the next step.
            // canShoot=false: they just exist here — actually firing at the
            // ghost is what the *next* step explains.
            sideVisual: <GhostArenaVisual canShoot={false} />,
        },
        {
            id:    'ghost-replay',
            title: 'The Ghost Replay',
            body:  `Your run gets recorded once. Every candidate — the translucent EAs on the right — replays that exact recording at the same time, instantly, ${presimGenerations}× before your next round.`,
            sideVisual: <GhostArenaVisual />,
        },
        {
            id:    'selection',
            title: 'Selection',
            body:  "The two candidates that scored best against your ghost — not just the one you fought live — become the parents for the next generation.",
            visual: <PopulationVisual population={makeIllustrativePopulation(populationSize)} />,
        },
        {
            id:    'crossover',
            title: 'Crossover',
            body:  'It mixes each gene from one parent or the other into a child — that\'s the blue and orange you see below.',
            visual: <CrossoverVisual genes={CROSSOVER_GENES} colorA={COL_A} colorB={COL_B} />,
        },
        {
            id:    'mutation',
            title: 'Mutation',
            body:  `Finally it nudges a couple of genes by a small random amount. Repeat that ${presimGenerations === 1 ? 'once' : `${presimGenerations}×`} every real round, and the whole roster gets sharper at handling your exact playstyle — no hidden neural net, just this, over and over.`,
            visual: <MutationVisual changes={MUTATION_CHANGES} />,
        },
    ];
}

interface TutorialEvolutionExplainerProps {
    onFinish?:    () => void;
    finishLabel?: string;
}

export function TutorialEvolutionExplainer({ onFinish, finishLabel }: TutorialEvolutionExplainerProps) {
    const { eaSettings } = useSettings();
    const [fireRateDna, setFireRateGene] = useSliderDna(NEUTRAL_DNA);
    const [fullDna, setFullGene]         = useSliderDna(NEUTRAL_DNA);

    const steps: ExplainerStep[] = useMemo(() => [
        {
            id:    'dna-example',
            title: 'DNA — One Number, One Behavior',
            body:  `Fire Rate controls how often the agent shoots. The dummy you just fought had this at ${TUTORIAL_DNA[DNA_INDEX.FIRE_RATE].toFixed(1)} — that's why it barely fired at all. Drag the slider below and watch the EA on the right fire faster or slower, live.`,
            visual: <ShooterDnaSection dna={fireRateDna} onChange={setFireRateGene} genes={FIRE_RATE_GENE} />,
            sideVisual: <DnaPreviewCanvas dna={fireRateDna} />,
        },
        {
            id:    'dna-full',
            title: 'DNA — The Whole Genome',
            body:  "All 8 genes work together like this, all the time — there's no hidden neural net, just these numbers. Try dragging a few and watch the EA's whole personality shift on the right.",
            visual: <ShooterDnaSection dna={fullDna} onChange={setFullGene} genes={ALL_GENES} />,
            sideVisual: <DnaPreviewCanvas dna={fullDna} />,
        },
        // Math.max(1, ...): if the player already set presim generations to 0
        // (a valid setting — see evolution.worker.ts), describing "0
        // generations in a row" would undercut the very mechanism this step
        // is teaching. The tutorial explains the general mechanism, not
        // literally today's session setting.
        ...buildEvolutionSteps(eaSettings.populationSize, Math.max(1, eaSettings.presimGenerations)),
    ], [fireRateDna, setFireRateGene, fullDna, setFullGene, eaSettings.populationSize, eaSettings.presimGenerations]);

    return <ExplainerFlow steps={steps} onFinish={onFinish} finishLabel={finishLabel} />;
}
