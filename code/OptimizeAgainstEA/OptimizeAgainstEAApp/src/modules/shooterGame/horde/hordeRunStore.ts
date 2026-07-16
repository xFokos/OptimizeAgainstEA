import { createListenable } from '../../../utils/listenable';

export interface HordeRunRecord {
    score:      number;
    generation: number;
}

export const hordeRunStore = {
    lastRun: null as HordeRunRecord | null,
    ...createListenable(),

    record(run: HordeRunRecord) {
        this.lastRun = run;
        this.notify();
    },
};
