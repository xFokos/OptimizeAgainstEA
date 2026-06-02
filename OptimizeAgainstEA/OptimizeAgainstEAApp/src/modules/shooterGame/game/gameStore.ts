import type { GameState } from '../shooter.types';

export const gameStore = {
    state: null as unknown as GameState,
    listeners: new Set<() => void>(),

    notify() {
        this.listeners.forEach(fn => fn());
    },

    subscribe(fn: () => void) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    },
};