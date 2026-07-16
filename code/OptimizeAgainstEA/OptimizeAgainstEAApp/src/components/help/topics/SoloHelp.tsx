import { HelpConceptCard, HelpDnaBars, HelpPresetRow } from '../helpVisuals';

const DIFFICULTY_PRESETS = [
    { id: 'easy',   label: 'Easy',   color: '#4ade80' },
    { id: 'medium', label: 'Medium', color: '#facc15' },
    { id: 'hard',   label: 'Hard',   color: '#f87171' },
];

export function Content() {
    return (
        <>
            <HelpConceptCard heading="Objective">
                Move with WASD/arrows, aim with the mouse, shoot with left click or Space.
                Land more hits than you take in 20 seconds to win the round.
            </HelpConceptCard>
            <HelpConceptCard heading="Difficulty presets" visual={<HelpPresetRow presets={DIFFICULTY_PRESETS} activeId="medium" />}>
                Easy, Medium and Hard decide how strong your opponent starts out — and how
                much practice it has already had before you ever face it.
            </HelpConceptCard>
            <HelpConceptCard
                heading="Your opponent is a set of numbers"
                visual={
                    <HelpDnaBars genes={[
                        { label: 'Pursuit',    value: 0.62 },
                        { label: 'Dodge',      value: 0.40 },
                        { label: 'Speed',      value: 0.75 },
                        { label: 'Fire Rate',  value: 0.50 },
                    ]} />
                }
            >
                How eagerly it chases, how well it dodges, how fast it shoots — all of it
                is a handful of values called its DNA. These numbers <em>are</em> the
                behavior; there's no hidden neural network.
            </HelpConceptCard>
            <HelpConceptCard
                heading="And they evolve against you"
                visual={
                    <HelpDnaBars genes={[
                        { label: 'Pursuit',    value: 0.45, delta: 0.25 },
                        { label: 'Dodge',      value: 0.30, delta: 0.15 },
                    ]} />
                }
            >
                After every round a new opponent is bred from whatever worked best against
                you — so it keeps sharpening itself against your exact playstyle.
            </HelpConceptCard>
        </>
    );
}
