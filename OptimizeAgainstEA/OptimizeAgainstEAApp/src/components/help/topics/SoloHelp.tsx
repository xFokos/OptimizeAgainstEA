import { HelpConceptCard, HelpDnaBars, HelpPresetRow, HelpPopulationDots } from '../helpVisuals';

const DIFFICULTY_PRESETS = [
    { id: 'easy',   label: 'Easy',   color: '#4ade80' },
    { id: 'medium', label: 'Medium', color: '#facc15' },
    { id: 'hard',   label: 'Hard',   color: '#f87171' },
];

export function Gameplay() {
    return (
        <>
            <HelpConceptCard heading="Objective">
                Move with WASD/arrows, aim with the mouse, shoot with left click or Space.
                Land more hits than you take in 20 seconds to win the round.
            </HelpConceptCard>
            <HelpConceptCard heading="Difficulty presets" visual={<HelpPresetRow presets={DIFFICULTY_PRESETS} activeId="medium" />}>
                Easy, Medium and Hard change the opponent's starting DNA — and how many
                generations it secretly pre-trains before round one even begins.
            </HelpConceptCard>
            <HelpConceptCard
                heading="Evolution across rounds"
                visual={
                    <HelpDnaBars genes={[
                        { label: 'Aggression', value: 0.45, delta: 0.25 },
                        { label: 'Dodge',      value: 0.30, delta: 0.15 },
                    ]} />
                }
            >
                After every round the opponent evolves based on how it did against you —
                it gets sharper at countering your exact playstyle each time.
            </HelpConceptCard>
        </>
    );
}

export function Technical() {
    return (
        <>
            <HelpConceptCard
                heading="DNA — what makes an agent"
                visual={
                    <HelpDnaBars genes={[
                        { label: 'Aggression', value: 0.62 },
                        { label: 'Dodge',      value: 0.40 },
                        { label: 'Speed',      value: 0.75 },
                        { label: 'Fire Rate',  value: 0.50 },
                    ]} />
                }
            >
                8 numbers between 0 and 1 — aggression, dodge, accuracy, range, speed,
                aim-lead, fire rate, bullet speed. These numbers <em>are</em> the
                behavior — no hidden neural network.
            </HelpConceptCard>
            <HelpConceptCard heading="The genetic algorithm" visual={<HelpPopulationDots count={16} elite={3} />}>
                A population evolves via tournament selection, crossover between two
                parents, and per-gene mutation. Top performers (gold) survive unchanged
                — progress never gets lost.
            </HelpConceptCard>
            <HelpConceptCard heading="Pre-simulation">
                Harder presets fight themselves for several generations before round one
                — and can replay a recording of your own movement to prep specifically
                for your playstyle.
            </HelpConceptCard>
        </>
    );
}
