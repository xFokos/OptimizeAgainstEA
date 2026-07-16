import type { HordeGameState } from './hordeTypes';
import { createListenable } from '../../../utils/listenable';

// Mirrors game/gameStore.ts's pattern for Solo Play: a module-level singleton
// survives route navigation (leaving /HordeGame and coming back), unlike a
// component-local useState/useRef which is destroyed on unmount. This is what
// lets the lobby's "← Lobby" button resume an in-progress run instead of
// always dropping the player back at a fresh "Start →" screen.
export const hordeGameStore = {
    state: null as HordeGameState | null,
    ...createListenable(),
};
