import { createListenable } from '../../../utils/listenable';
import type { Individual } from '../shooter.types';

// Solange das Trainings-Replay offen ist, zeigen die Seitenleisten seinen
// Zustand statt der Live-Spieldaten: die linke Bar das Fitness-Ranking
// (statt Round Stats), das DNA-Panel rechts die DNA des fokussierten
// Kandidaten. Das Overlay öffnet/schließt den Store und liest den Fokus
// daraus; Klicks im Ranking setzen ihn.
export interface TrainingReplayUI {
    /** Zuletzt evaluierte Presim-Generation mit echten Fitness-Werten. */
    evaluated: Individual[];
    /** Indizes in `evaluated`, beste Fitness zuerst. */
    ranking:   number[];
    /** Aktuell fokussierter Kandidat (Index in `evaluated`). */
    focusIdx:  number;
}

export const trainingReplayStore = {
    ...createListenable(),
    state: null as TrainingReplayUI | null,
    // Schließt das offene Replay (vom Overlay gesetzt) — damit externe UI wie
    // der "← Game"-Button in der linken Bar es zumachen kann.
    requestClose: () => {},

    open(evaluated: Individual[], focusIdx: number) {
        const ranking = evaluated
            .map((_, i) => i)
            .sort((a, b) => evaluated[b].fitness - evaluated[a].fitness);
        this.state = { evaluated, ranking, focusIdx };
        this.notify();
    },

    setFocus(focusIdx: number) {
        if (!this.state) return;
        this.state = { ...this.state, focusIdx };
        this.notify();
    },

    close() {
        this.state = null;
        this.requestClose = () => {};
        this.notify();
    },
};
