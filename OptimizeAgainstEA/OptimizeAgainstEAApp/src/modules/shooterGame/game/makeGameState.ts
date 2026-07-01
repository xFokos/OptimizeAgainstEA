import type { GameState } from '../shooter.types';
import { ARENA, GAME_CONFIG, emptyStats } from '../shooter.types';
import type { ShooterSettings } from '../../../context/SettingsContext';

export const makeInitialGameState = (settings: ShooterSettings): GameState => ({
    phase:            'idle',
    roundTimer:       settings.roundDuration,
    roundNumber:      0,
    bullets:          [],
    population:       null,
    lastPlayerFrame:  null,
    lastAgentFrame:   null,
    crossoverExample: null,
    player: {
        id:       'player',
        position: { x: 200, y: ARENA.HEIGHT / 2 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius:   GAME_CONFIG.PLAYER_RADIUS,
        health:   100,
    },
    agent: {
        id:             'agent',
        position:       { x: ARENA.WIDTH - 200, y: ARENA.HEIGHT / 2 },
        velocity:       { x: 0, y: 0 },
        rotation:       Math.PI,
        radius:         GAME_CONFIG.AGENT_RADIUS,
        health:         100,
        dna:   [...settings.starterDna],
        stats: emptyStats(),
    },
});
