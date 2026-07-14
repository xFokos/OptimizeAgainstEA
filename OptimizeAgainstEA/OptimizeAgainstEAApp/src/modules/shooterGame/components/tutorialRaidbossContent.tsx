import { GAME_CONFIG } from '../shooter.types';
import {
    ExplainerFlow,
    type ExplainerStep,
    FitnessVisual,
    type FitnessRow,
} from '../../../components/explainer';
import { RaidbossArenaVisual } from './RaidbossArenaVisual';
import { FitnessArenaVisual } from './FitnessArenaVisual';

// ─────────────────────────────────────────────────────────────────────────
//  Raidboss tutorial, part 2: "who exactly am I fighting, and what does my
//  round do to it". Deliberately does NOT re-teach DNA/selection/crossover/
//  mutation — the Solo tutorial owns those; this one only covers what the
//  Raidboss changes: one shared online population, evaluated by many players
//  in parallel, evolving whenever a generation is fully scored.
//
//  Shown after the raidboss practice round ends (ShooterCanvas with
//  tutorialMode='raidboss') and via the Raidboss lobby's Tutorial button
//  ("Technical") once the tutorial was completed once.
// ─────────────────────────────────────────────────────────────────────────

const POP = GAME_CONFIG.POPULATION_SIZE;

// Das Canvas zeigt bewusst ein kleineres, luftigeres Raster als die echten
// 40 — bei voller Populationsgröße wird das 240px-Feld unlesbar dicht. Die
// Step-Texte nennen weiterhin die echte Zahl.
const DISPLAY_POP = 16;

// Mirrors game/ga/fitness.ts's calculateRaidbossFitness exactly (hits ×±100,
// survival up to +60 for lasting the full round, outcome bonus) so the
// numbers shown are checkable against actual play.
const RAIDBOSS_FITNESS_EXAMPLE: FitnessRow[] = [
    { label: 'Hits landed on the player', detail: '4 × +100', value:  400 },
    { label: 'Hits taken',                detail: '2 × −100', value: -200 },
    { label: 'Survived the full round',   detail: 'max +60',  value:   60 },
    { label: 'Won the round',             detail: 'bonus',    value:  120 },
];

const RAIDBOSS_STEPS: ExplainerStep[] = [
    {
        id:    'community',
        title: 'One Boss, Trained by Everyone',
        body:  `The Raidboss isn't your personal opponent — it's one shared online population of ${POP} boss candidates, and every player of this site (the dots on the right) trains the same one.`,
        sideVisual: <RaidbossArenaVisual variant="community" count={DISPLAY_POP} />,
    },
    {
        id:    'evaluate',
        title: 'Your Round Scores One Candidate',
        body:  "Hitting Fight hands you the next unscored candidate — your round is its exam. And it happens in parallel: while one player fights, other players' scores keep landing on the roster.",
        sideVisual: <RaidbossArenaVisual variant="evaluate" count={DISPLAY_POP} />,
    },
    {
        id:    'fitness',
        title: 'Fitness — Grading the Boss',
        body:  "Scored from the boss's point of view: +100 per hit on you, −100 per hit taken, up to +60 for holding out the round, plus a win bonus. Beating the boss means low fitness — your wins steer what gets bred next.",
        visual: <FitnessVisual rows={RAIDBOSS_FITNESS_EXAMPLE} />,
        sideVisual: <FitnessArenaVisual agentColor="#a855f7" agentLabel="Boss" />,
    },
    {
        id:    'generation',
        title: 'The Generation Ticks Over',
        body:  `Once all ${POP} candidates are scored, the glowing ring marks the generation's best — then evolution runs automatically online (same selection, crossover and mutation as in Solo) and a fresh generation takes over. The more the community plays, the stronger the boss.`,
        sideVisual: <RaidbossArenaVisual variant="generation" count={DISPLAY_POP} />,
    },
];

interface TutorialRaidbossExplainerProps {
    onFinish?:    () => void;
    finishLabel?: string;
}

export function TutorialRaidbossExplainer({ onFinish, finishLabel }: TutorialRaidbossExplainerProps) {
    return <ExplainerFlow steps={RAIDBOSS_STEPS} onFinish={onFinish} finishLabel={finishLabel} />;
}
