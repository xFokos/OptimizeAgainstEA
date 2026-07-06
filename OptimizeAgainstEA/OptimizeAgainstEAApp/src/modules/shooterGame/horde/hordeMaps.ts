import { ARENA } from '../shooter.types';
import type { HordeMap, HordeObstacle, HordeSpawnSide } from './hordeTypes';

const ARENA_CENTER = { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 };

// ---- Map presets ----
// Each map can restrict which sides agents spawn from (see HordeMap.spawnSides) —
// e.g. Pillars funnels the horde in from the sides instead of surrounding the player,
// which matters tactically once obstacles are in the mix.

export const HORDE_MAPS: HordeMap[] = [
    {
        id:          'open',
        label:       'Open Field',
        description: 'No obstacles — agents surround you from every side.',
        obstacles:   [],
        spawnSides:  ['top', 'right', 'bottom', 'left'],
        playerSpawn: ARENA_CENTER,
    },
    {
        id:          'pillars',
        label:       'Pillars',
        description: 'Four bullet-blocking pillars around the center — agents funnel in from left/right.',
        // Four cover blocks around the center, leaving diagonal lanes open —
        // all block bullets, so the player (and agents) can duck behind them.
        obstacles: [
            { x: 355, y: 190, w: 90, h: 90, blocksBullets: true }, // top
            { x: 355, y: 520, w: 90, h: 90, blocksBullets: true }, // bottom
            { x: 190, y: 355, w: 90, h: 90, blocksBullets: true }, // left
            { x: 520, y: 355, w: 90, h: 90, blocksBullets: true }, // right
        ],
        spawnSides: ['left', 'right'],
        playerSpawn: ARENA_CENTER,
    },
    {
        id:          'canyon',
        label:       'Canyon',
        description: 'A chasm splits the field north of center — impassable on foot except at two bridges, but bullets sail straight over it. Agents spawn beyond it, to the north.',
        // blocksBullets: false — walking is blocked, but the player (and agents) can
        // still shoot straight across. Player spawns at arena center (y=400), safely
        // below this band, so the two gaps are the only way for agents to reach them.
        obstacles: [
            { x: 0,   y: 220, w: 150, h: 100, blocksBullets: false }, // west wall
            { x: 260, y: 220, w: 280, h: 100, blocksBullets: false }, // center wall (between the two bridges)
            { x: 650, y: 220, w: 150, h: 100, blocksBullets: false }, // east wall
        ],
        spawnSides: ['top'],
        playerSpawn: ARENA_CENTER,
    },
];

export function getHordeMap(id: string): HordeMap {
    return HORDE_MAPS.find(m => m.id === id) ?? HORDE_MAPS[0];
}

// ---- Custom (user-built) map ----
// Built live from HordeSettings.customObstacles/customSpawnSides — see HordeMapEditorPage.

export const CUSTOM_MAP_ID = 'custom';

export function buildCustomHordeMap(
    obstacles:   HordeObstacle[],
    spawnSides:  HordeSpawnSide[],
    playerSpawn: { x: number; y: number },
): HordeMap {
    return {
        id:          CUSTOM_MAP_ID,
        label:       'Custom',
        description: 'Your own layout — edit it in the Map tab.',
        obstacles,
        // Falls back to every side if the editor was left with none selected —
        // an empty spawnSides array would make edgePos divide by zero.
        spawnSides: spawnSides.length > 0 ? spawnSides : ['top', 'right', 'bottom', 'left'],
        playerSpawn,
    };
}

export function resolveHordeMap(
    mapId:             string,
    customObstacles:   HordeObstacle[],
    customSpawnSides:  HordeSpawnSide[],
    customPlayerSpawn: { x: number; y: number },
): HordeMap {
    if (mapId === CUSTOM_MAP_ID) return buildCustomHordeMap(customObstacles, customSpawnSides, customPlayerSpawn);
    return getHordeMap(mapId);
}
