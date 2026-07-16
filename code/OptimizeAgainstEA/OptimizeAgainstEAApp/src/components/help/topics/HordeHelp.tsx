import { HelpConceptCard, HelpMapDiagram, HelpModRow, HelpPopulationDots } from '../helpVisuals';

const PILLARS_OBSTACLES = [
    { x: 44.4,  y: 23.75, w: 11.25, h: 11.25, blocksBullets: true },
    { x: 44.4,  y: 65,    w: 11.25, h: 11.25, blocksBullets: true },
    { x: 23.75, y: 44.4,  w: 11.25, h: 11.25, blocksBullets: true },
    { x: 65,    y: 44.4,  w: 11.25, h: 11.25, blocksBullets: true },
];

export function Content() {
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
                movement. The horde finds its way around walls rather than piling up on
                them. Pick a built-in map or build your own in the Map Editor.
            </HelpConceptCard>
            <HelpConceptCard heading="The horde evolves as you fight" visual={<HelpPopulationDots count={20} elite={3} />}>
                No wave list was ever written by hand. A fixed group stays on the field;
                kill one and its slot comes back from an evolving gene pool. The ones that
                gave you the most trouble (gold) return unchanged — so the pressure builds
                out of your own fight, not a difficulty curve.
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
