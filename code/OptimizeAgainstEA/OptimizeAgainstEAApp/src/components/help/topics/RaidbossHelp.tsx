import { HelpConceptCard, HelpProgressDots } from '../helpVisuals';

export function Gameplay() {
    return (
        <>
            <HelpConceptCard heading="Objective" visual={<HelpProgressDots total={12} done={7} />}>
                One shared boss population is trained by every player on the server.
                Fighting it evaluates the next individual nobody has tested yet.
            </HelpConceptCard>
            <HelpConceptCard heading="Shared progress">
                Controls are the same as Solo Play. Once everyone's fought every
                individual in a generation, the whole population evolves at once —
                today's boss may be tougher than yesterday's.
            </HelpConceptCard>
        </>
    );
}

export function Technical() {
    return (
        <>
            <HelpConceptCard heading="Distributed evaluation" visual={<HelpProgressDots total={12} done={4} />}>
                A genetic algorithm normally needs one machine to simulate every fight.
                Here, each player's round <em>is</em> one fitness sample — evaluation is
                crowdsourced instead of simulated.
            </HelpConceptCard>
            <HelpConceptCard heading="Raidboss fitness">
                Fitness rewards net hits, same as Solo Play, plus a survival bonus — a
                boss that holds its ground scores well even in a close fight.
            </HelpConceptCard>
        </>
    );
}
