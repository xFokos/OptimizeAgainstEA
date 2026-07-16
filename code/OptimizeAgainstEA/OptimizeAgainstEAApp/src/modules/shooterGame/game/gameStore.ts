import type { GameState } from '../shooter.types';
import { createListenable } from '../../../utils/listenable';

export const gameStore = {
    state: null as unknown as GameState,
    ...createListenable(),
};