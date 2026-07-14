import { useMemo, useState } from 'react';
import { DNA_INDEX, DNA_NAMES, DNA_GENE_INFO, TUTORIAL_DNA, type DNA } from '../shooter.types';
import { ShooterDnaSection, type DnaGeneDescriptor } from '../settings/ShooterSettings';
import { useSettings } from '../../../context/SettingsContext.tsx';
import {
    ExplainerFlow,
    ExplainerHintButton,
    type ExplainerStep,
    CrossoverVisual,
    MutationVisual,
    FitnessVisual,
    type FitnessRow,
} from '../../../components/explainer';
import { DnaPreviewCanvas } from './DnaPreviewCanvas';
import { GhostArenaVisual } from './GhostArenaVisual';
import { FitnessArenaVisual } from './FitnessArenaVisual';

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

type GeneChange = (i: number, v: number) => void;

// Die zwei interaktiven DNA-Steps — auch einzeln wiederverwendet (siehe
// SoloDnaExplainerHint unten), deshalb aus dem Tutorial-useMemo herausgelöst.
// `tutorialContext` steuert nur den Verweis auf den gerade besiegten Dummy,
// der im Lobby-Popup keinen Sinn ergäbe.
function buildDnaSteps(
    fireRateDna: DNA, onFireRate: GeneChange,
    fullDna: DNA, onFull: GeneChange,
    tutorialContext: boolean,
): ExplainerStep[] {
    return [
        {
            id:    'dna-example',
            title: 'DNA — One Number, One Behavior',
            body:  tutorialContext
                ? `Fire Rate controls how often the agent shoots. The dummy you just fought had this at ${TUTORIAL_DNA[DNA_INDEX.FIRE_RATE].toFixed(1)} — that's why it barely fired at all. Drag the slider below and watch the EA on the right fire faster or slower, live.`
                : 'Fire Rate controls how often the agent shoots. Drag the slider below and watch the EA on the right fire faster or slower, live.',
            visual: <ShooterDnaSection dna={fireRateDna} onChange={onFireRate} genes={FIRE_RATE_GENE} />,
            sideVisual: <DnaPreviewCanvas dna={fireRateDna} />,
        },
        {
            id:    'dna-full',
            title: 'DNA — The Whole Genome',
            body:  "All 8 genes work together like this, all the time — there's no hidden neural net, just these numbers. Try dragging a few and watch the EA's whole personality shift on the right.",
            visual: <ShooterDnaSection dna={fullDna} onChange={onFull} genes={ALL_GENES} />,
            sideVisual: <DnaPreviewCanvas dna={fullDna} />,
        },
    ];
}

function buildFitnessStep(): ExplainerStep {
    return {
        id:    'fitness',
        title: 'Fitness — Grading an EA',
        body:  "After every round, the EA gets one score for how well it did — its fitness. Every hit it lands on you counts +100, every hit it takes counts −100, and winning the round adds a bonus on top. The higher the fitness, the better it did against you — it's exactly what the bar at the top of your round was counting.",
        visual: <FitnessVisual rows={FITNESS_EXAMPLE} />,
        sideVisual: <FitnessArenaVisual />,
    };
}

// Illustrative "how the EA gets its next DNA" story — same 3 mechanisms as
// the Dashboard's EA Explained tab, but using the shooter's own gene names
// so it reads as a continuation of what the player just explored above, plus
// two shooter-specific steps (Population, Ghost Replay) explaining the actual
// mechanism this game uses to score a whole roster without live-replaying
// the player against every one of them — see ShooterCanvas's startRound /
// evolution.ts's presimulateAgainstGhost for the real implementation this
// illustrates.

// Illustrative round for the Fitness step — mirrors the real formula in
// game/ga/fitness.ts's calculateFitness exactly (hits × ±100 + win/lose
// bonus), so the numbers shown are checkable against actual play.
const FITNESS_EXAMPLE: FitnessRow[] = [
    { label: 'Hits landed on you', detail: '3 × +100', value:  300 },
    { label: 'Hits taken from you', detail: '1 × −100', value: -100 },
    { label: 'Won the round',       detail: 'bonus',    value:  120 },
];

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
            body:  `One agent per generation would be fragile — a single lucky or unlucky round could steer evolution into a dead end. That's why there are ${populationSize} candidates at once — watch them fill in on the right. Each is its own individual with its own DNA; together they form one population, and swapping the whole roster out makes the next generation.`,
            // Same split layout (text left, arena canvas right) as the DNA
            // steps and the next "Ghost Replay" step. The roster grid fills
            // in one candidate at a time — a lone agent stands there first,
            // visualizing the "one alone would be fragile" argument — and
            // then stands still; the replay action is what the *next* step
            // introduces.
            sideVisual: <GhostArenaVisual variant="lineup" count={populationSize} />,
        },
        {
            id:    'ghost-replay',
            title: 'The Ghost Replay',
            body:  `But fighting all ${populationSize} candidates yourself would take ${populationSize} rounds — far too long. Instead, your one round gets recorded — watch on the right — and every candidate replays that exact recording at once, each earning its own fitness, ${presimGenerations}× before your next round.`,
            sideVisual: <GhostArenaVisual />,
        },
        {
            id:    'selection',
            title: 'Selection',
            body:  "The two candidates with the best fitness against your ghost — not just the one you fought live — become the parents for the next generation. Watch them get picked on the right.",
            // Same roster grid the Population step introduced, now standing
            // still while the two parents get highlighted — in the exact
            // blue/orange the Crossover step's table uses next.
            sideVisual: <GhostArenaVisual variant="selection" count={populationSize} />,
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
            body:  'Finally it nudges a couple of genes by a small random amount — little random tweaks that keep the population discovering new tricks.',
            visual: <MutationVisual changes={MUTATION_CHANGES} />,
        },
        {
            id:    'next-generation',
            title: 'The Next Generation',
            body:  `Selection, crossover and mutation fill a brand-new population of ${populationSize} — and its best candidate is your next opponent. That cycle repeats after every round: no hidden neural net, just an opponent that keeps adapting to how you play.`,
            sideVisual: <GhostArenaVisual variant="nextgen" count={populationSize} />,
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
        ...buildDnaSteps(fireRateDna, setFireRateGene, fullDna, setFullGene, true),
        // Fitness comes here — after the player has played with *one* EA, but
        // before the population steps: "one EA gets a grade" is concrete;
        // "20 of them get graded at once" builds on it two steps later.
        buildFitnessStep(),
        // Math.max(1, ...): if the player already set presim generations to 0
        // (a valid setting — see evolution.worker.ts), describing "0
        // generations in a row" would undercut the very mechanism this step
        // is teaching. The tutorial explains the general mechanism, not
        // literally today's session setting.
        ...buildEvolutionSteps(eaSettings.populationSize, Math.max(1, eaSettings.presimGenerations)),
    ], [fireRateDna, setFireRateGene, fullDna, setFullGene, eaSettings.populationSize, eaSettings.presimGenerations]);

    return <ExplainerFlow steps={steps} onFinish={onFinish} finishLabel={finishLabel} />;
}

// ---- "?"-Buttons für Lobby/Settings ----
// Wiederverwenden genau die Tutorial-Steps (inkl. Slider + Live-Canvas) als
// Fullscreen-Popup — neben der jeweiligen Einstellung platzieren.

/** Neben DNA-Anzeigen/-Slidern: die zwei interaktiven DNA-Steps. */
export function SoloDnaExplainerHint() {
    const [fireRateDna, setFireRateGene] = useSliderDna(NEUTRAL_DNA);
    const [fullDna, setFullGene]         = useSliderDna(NEUTRAL_DNA);
    const steps = useMemo(
        () => buildDnaSteps(fireRateDna, setFireRateGene, fullDna, setFullGene, false),
        [fireRateDna, setFireRateGene, fullDna, setFullGene],
    );
    return <ExplainerHintButton steps={steps} label="How does the DNA work?" />;
}

/** Welche EA-Einstellung erklärt werden soll — Schlüssel = Settings-Feld. */
export type SoloEaSettingTopic =
    | 'mutationRate' | 'mutationStrength' | 'presimGenerations' | 'populationSize'
    | 'crossoverType' | 'injectionDeviation' | 'hallOfFame';

// Ein Step pro Einstellung: wo es eine Tutorial-Animation gibt, wird sie
// wiederverwendet; für den Rest reicht ein kurzer Text, der sich auf die im
// Tutorial eingeführten Begriffe (Gene, Population, Fitness) stützt.
function buildEaSettingStep(topic: SoloEaSettingTopic, populationSize: number): ExplainerStep {
    switch (topic) {
        case 'mutationRate': return {
            id:    'setting-mutation-rate',
            title: 'Mutation Rate',
            body:  "When a new child is bred, every gene has this chance to mutate — a small random nudge like below. Low keeps children close to their parents; high explores more, but can also wreck good genes.",
            visual: <MutationVisual changes={MUTATION_CHANGES} />,
        };
        case 'mutationStrength': return {
            id:    'setting-mutation-strength',
            title: 'Mutation Strength',
            body:  "How far a single mutation can nudge a gene. Small values fine-tune what already works; large values make wild jumps — more discovery, less stability.",
            visual: <MutationVisual changes={MUTATION_CHANGES} />,
        };
        case 'presimGenerations': return {
            id:    'setting-presim',
            title: 'Presim Generations',
            body:  "Between your rounds, every candidate replays your recorded ghost — this many full generations in a row. Higher means the population arrives already trained against your style.",
            sideVisual: <GhostArenaVisual />,
        };
        case 'populationSize': return {
            id:    'setting-population-size',
            title: 'Population Size',
            body:  `How many candidates evolve at once — each its own individual with its own DNA, together one population. More means more variety per generation; fewer converges faster but is fragile.`,
            sideVisual: <GhostArenaVisual variant="lineup" count={populationSize} />,
        };
        case 'crossoverType': return {
            id:    'setting-crossover',
            title: 'Crossover Type',
            body:  "How two parents' genes mix into a child: Uniform picks each gene from a random parent (the blue/orange mix below); Single-Point cuts the DNA at one spot and takes the front from one parent, the rest from the other.",
            visual: <CrossoverVisual genes={CROSSOVER_GENES} colorA={COL_A} colorB={COL_B} />,
        };
        case 'injectionDeviation': return {
            id:    'setting-injection',
            title: 'Injection Deviation',
            body:  "When fresh individuals get injected into the population, their genes are spread this far around your starter DNA. Small keeps them near-clones of your setup; large brings in wild newcomers — extra diversity so evolution doesn't get stuck.",
        };
        case 'hallOfFame': return {
            id:    'setting-hall-of-fame',
            title: 'Hall of Fame',
            body:  "Remembers the best individual ever found — judged by the same fitness score as everything else — so a proven champion can't be lost when later generations drift away from it.",
        };
    }
}

/** "?" neben einer einzelnen EA-Einstellung im Algorithm-Tab. */
export function SoloEaSettingHint({ topic }: { topic: SoloEaSettingTopic }) {
    const { eaSettings } = useSettings();
    const steps = useMemo(
        () => [buildEaSettingStep(topic, eaSettings.populationSize)],
        [topic, eaSettings.populationSize],
    );
    return <ExplainerHintButton steps={steps} label="What does this setting do?" />;
}
