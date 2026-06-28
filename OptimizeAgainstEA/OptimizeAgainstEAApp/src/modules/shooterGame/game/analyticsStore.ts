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

    push(record: RoundRecord, maxRounds = 20) {
        const trimmed = this.rounds.length >= maxRounds
            ? this.rounds.slice(this.rounds.length - maxRounds + 1)
            : this.rounds;
        this.rounds = [...trimmed, record];
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
