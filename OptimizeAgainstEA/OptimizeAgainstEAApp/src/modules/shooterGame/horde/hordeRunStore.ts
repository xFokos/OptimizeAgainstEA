export interface HordeRunRecord {
    score:      number;
    generation: number;
}

export const hordeRunStore = {
    lastRun:   null as HordeRunRecord | null,
    listeners: new Set<() => void>(),

    record(run: HordeRunRecord) {
        this.lastRun = run;
        this.listeners.forEach(fn => fn());
    },

    subscribe(fn: () => void) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    },
};
