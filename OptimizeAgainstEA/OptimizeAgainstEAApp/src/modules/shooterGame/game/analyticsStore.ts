import type { PlayerGhostFrame, AgentGhostFrame } from '../shooter.types';

export interface RoundRecord {
    round:        number;
    hitsLanded:   number;
    hitsReceived: number;
    bulletsFired: number;
    accuracy:     number;
    dodged:       number;
    fitness:      number;
    generation:   number;
    bestFitness:  number;
    playerFrames: PlayerGhostFrame[];
    agentFrames:  AgentGhostFrame[];
    agentDna:     number[];
}

export const analyticsStore = {
    rounds:    [] as RoundRecord[],
    listeners: new Set<() => void>(),

    push(record: RoundRecord) {
        this.rounds = [...this.rounds, record];
        this.listeners.forEach(fn => fn());
    },

    clear() {
        this.rounds = [];
        this.listeners.forEach(fn => fn());
    },

    subscribe(fn: () => void) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    },
};
