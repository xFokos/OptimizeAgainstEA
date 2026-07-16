import { HelpConceptCard, HelpProgressDots } from '../helpVisuals';

export function Content() {
    return (
        <>
            <HelpConceptCard heading="Objective" visual={<HelpProgressDots total={12} done={7} />}>
                Controls are the same as Solo Play — but the boss isn't yours. One shared
                population is trained by every player on the server, and your fight tests
                the next individual nobody has faced yet.
            </HelpConceptCard>
            <HelpConceptCard heading="You are the fitness test">
                Normally an algorithm like this needs a machine to simulate every fight.
                Here your round <em>is</em> the score — how the boss does against you is
                what decides whether its DNA gets passed on.
            </HelpConceptCard>
            <HelpConceptCard heading="Shared progress">
                Once every individual has been fought, the whole population evolves at
                once. Today's boss may be tougher than yesterday's — and everyone who
                played had a hand in it.
            </HelpConceptCard>
        </>
    );
}
