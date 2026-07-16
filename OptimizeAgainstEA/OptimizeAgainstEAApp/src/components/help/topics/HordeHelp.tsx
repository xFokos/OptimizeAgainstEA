import { HelpConceptCard, HelpMapDiagram, HelpModRow, HelpPopulationDots } from '../helpVisuals';

const PILLARS_OBSTACLES = [
    { x: 44.4,  y: 23.75, w: 11.25, h: 11.25, blocksBullets: true },
    { x: 44.4,  y: 65,    w: 11.25, h: 11.25, blocksBullets: true },
    { x: 23.75, y: 44.4,  w: 11.25, h: 11.25, blocksBullets: true },
    { x: 65,    y: 44.4,  w: 11.25, h: 11.25, blocksBullets: true },
];

export function Gameplay() {
    return (
        <>
            <HelpConceptCard heading="Objective">
                Endless waves rush in from the map edges — one touch kills you. There's
                no round timer; the game ends when you die.
            </HelpConceptCard>
            <HelpConceptCard
                heading="Maps &amp; obstacles"
                visual={<HelpMapDiagram obstacles={PILLARS_OBSTACLES} spawnSides={['left', 'right']} />}
            >
                Solid-bordered cover blocks bullets too; dashed cover only blocks
                movement. Pick a built-in map or build your own in the Map Editor.
            </HelpConceptCard>
            <HelpConceptCard
                heading="Difficulty"
                visual={<HelpModRow mods={[{ icon: '👢', name: 'Speed Boost' }, { icon: '🔫', name: 'Rapid Fire' }, { icon: '💥', name: 'Bullet Speed' }]} />}
            >
                The DNA &amp; Wave tab controls wave size and how fast the horde evolves —
                more agents and faster mutation both raise the pressure.
            </HelpConceptCard>
        </>
    );
}

export function Technical() {
    return (
        <>
            <HelpConceptCard heading="A living population, not scripted waves" visual={<HelpPopulationDots count={20} elite={0} />}>
                There's no hand-authored wave list. A fixed-size population stays on the
                field; kill one and its slot respawns from the evolving gene pool.
            </HelpConceptCard>
            <HelpConceptCard heading="Elites &amp; continuity" visual={<HelpPopulationDots count={20} elite={3} />}>
                Top performers (gold) reincarnate with unchanged DNA, and their fitness
                is smoothed across lives — one unlucky death doesn't erase a good strategy.
            </HelpConceptCard>
            <HelpConceptCard heading="Pathfinding around obstacles">
                Agents follow a flow-field — a grid where every cell points toward you —
                so they path around walls instead of getting stuck on them.
            </HelpConceptCard>
        </>
    );
}
