import { useMemo, useState } from 'react';
import type { DNA } from '../shooter.types';
import { HORDE_STARTER_DNA_LENGTH } from '../horde/hordeDna';
import { ShooterDnaSection } from '../settings/ShooterSettings';
import { ExplainerFlow, type ExplainerStep } from '../../../components/explainer';
import { HORDE_BAR_GENES, HORDE_EDITABLE_GENES } from '../lobby/lobbyConstants';
import { HordeDnaPreviewCanvas } from './HordeDnaPreviewCanvas';
import { HordeArenaVisual } from './HordeArenaVisual';

// ─────────────────────────────────────────────────────────────────────────
//  Horde tutorial, part 2: "what's in a Horde agent's DNA, and how does the
//  swarm evolve without any rounds". Built on the same shared ExplainerFlow
//  as the Solo tutorial, with the same interactive pattern (real sliders +
//  live arena canvas), but everything Horde: melee blobs with body genes
//  (Size/Opacity/Movement Loop), closeness-based fitness, and the
//  steady-state per-death mini-GA from horde/hordeEngine.ts.
//
//  Shown after the Horde practice round's coachmark tour finishes (see
//  HordeCanvas's 'done' step) and via the Horde lobby's Tutorial button
//  ("Technical") once the tutorial was completed once.
// ─────────────────────────────────────────────────────────────────────────

// Base genes at 0.5, loop steps neutral, size/opacity mid — a blank blob for
// the player to shape with the sliders.
const NEUTRAL_HORDE_DNA: DNA = new Array(HORDE_STARTER_DNA_LENGTH).fill(0.5);

const AGGRESSION_GENE = [HORDE_BAR_GENES[0]];

function useSliderDna(initial: DNA) {
    const [dna, setDna] = useState<DNA>(initial);
    const onChange = (i: number, v: number) => setDna(prev => {
        const next = [...prev];
        next[i] = v;
        return next;
    });
    return [dna, onChange] as const;
}

interface TutorialHordeExplainerProps {
    onFinish?:    () => void;
    finishLabel?: string;
}

export function TutorialHordeExplainer({ onFinish, finishLabel }: TutorialHordeExplainerProps) {
    const [aggressionDna, setAggressionGene] = useSliderDna(NEUTRAL_HORDE_DNA);
    const [fullDna, setFullGene]             = useSliderDna(NEUTRAL_HORDE_DNA);

    const steps: ExplainerStep[] = useMemo(() => [
        {
            id:    'dna-aggression',
            title: 'DNA — One Number, One Behavior',
            body:  "Aggression decides how much an agent hunts you instead of wandering — the dummies you just fought had it at 0. Drag the slider and watch the blob switch from drifting to hunting, live.",
            visual: <ShooterDnaSection dna={aggressionDna} onChange={setAggressionGene} genes={AGGRESSION_GENE} />,
            sideVisual: <HordeDnaPreviewCanvas dna={aggressionDna} />,
        },
        {
            id:    'dna-full',
            title: 'The Horde Genome',
            body:  "Horde agents never shoot — touching you is the kill. So the DNA evolves the body itself: Size and Opacity make an agent harder to hit (try shrinking Size), and the Loop Steps add an evolved zigzag to the chase.",
            visual: <ShooterDnaSection dna={fullDna} onChange={setFullGene} genes={HORDE_EDITABLE_GENES} />,
            sideVisual: <HordeDnaPreviewCanvas dna={fullDna} />,
        },
        {
            id:    'fitness',
            title: 'Fitness — How Close It Got',
            body:  "Every life gets one score: how close it got to you — squared, so nearly reaching you counts far more. Getting stuck against a wall only counts half. Watch the measurements on the right.",
            sideVisual: <HordeArenaVisual variant="fitness" />,
        },
        {
            id:    'death-evolution',
            title: 'Evolution While You Play',
            body:  "No rounds in Horde: whenever an agent goes down, two strong survivors become parents (blue and orange), their genes get mixed and slightly mutated, and the replacement walks in from the edge — the gene pool shifts one respawn at a time.",
            sideVisual: <HordeArenaVisual variant="evolution" />,
        },
        {
            id:    'elites-immigrants',
            title: 'Elites & Newcomers',
            body:  "Two safety nets: the best genome (gold ring) returns unchanged when it goes down, and about one in twelve replacements is a completely random newcomer (white ring) that keeps the swarm exploring. Watch the two take turns on the right.",
            sideVisual: <HordeArenaVisual variant="elites" />,
        },
    ], [aggressionDna, setAggressionGene, fullDna, setFullGene]);

    return <ExplainerFlow steps={steps} onFinish={onFinish} finishLabel={finishLabel} />;
}
