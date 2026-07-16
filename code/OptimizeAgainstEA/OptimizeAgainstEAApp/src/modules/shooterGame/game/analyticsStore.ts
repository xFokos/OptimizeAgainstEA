import type { PlayerGhostFrame, AgentGhostFrame } from '../shooter.types';
import { createListenable } from '../../../utils/listenable';

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
    rounds: [] as RoundRecord[],
    ...createListenable(),

    push(record: RoundRecord, maxRounds = 20) {
        const trimmed = this.rounds.length >= maxRounds
            ? this.rounds.slice(this.rounds.length - maxRounds + 1)
            : this.rounds;
        this.rounds = [...trimmed, record];
        this.notify();
    },

    clear() {
        this.rounds = [];
        this.notify();
    },
};
