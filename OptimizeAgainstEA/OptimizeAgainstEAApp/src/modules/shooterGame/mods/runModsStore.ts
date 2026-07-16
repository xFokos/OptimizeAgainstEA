// Mod-Fortschritt für den aktuellen Run – geteilt zwischen Solo Play und Horde
// (genau wie shooterSettings.playerStats schon heute in beiden Modi dieselben
// Bullet-/Move-Speed-Werte liefert). Bewusst kein Setting: nicht persistiert,
// kein Cross-Progression über Reloads hinweg.
//
// Alle Mods sind jederzeit frei togglebar (Player-Tab) — kein Lock/Unlock.
// Die periodische Choice-Auswahl (alle 5 Generationen in Solo, alle X Kills in
// Horde) ist nur ein Bonus-Moment und aktiviert einen noch inaktiven Mod direkt.
import { createListenable } from '../../../utils/listenable';
import { MOD_POOL, isModOfferable, modStackCount } from './modTypes';

// activeModIds ist ein Multiset: stapelbare Stat-Mods dürfen mehrfach vorkommen
// (jede Kopie = ein Stack), einmalige Verhaltens-Mods höchstens einmal. applyMods
// / computeShotPlan iterieren ohnehin über die Liste, also stackt der Effekt von
// selbst. Wichtig: immer ein NEUES Array zuweisen (nie in-place mutieren), sonst
// merken die useSyncExternalStore-Snapshots die Änderung nicht.
export const runModsStore = {
    activeModIds: [] as string[],
    ...createListenable(),

    count(id: string) {
        return modStackCount(this.activeModIds, id);
    },

    // Fügt einen Stack hinzu (bis zum Cap). Ein Powerup-Pick landet hier.
    addMod(id: string) {
        const mod = MOD_POOL.find(m => m.id === id);
        if (!mod || !isModOfferable(mod, this.activeModIds)) return;
        this.activeModIds = [...this.activeModIds, id];
        this.notify();
    },

    // Entfernt genau eine Kopie.
    removeMod(id: string) {
        const i = this.activeModIds.indexOf(id);
        if (i === -1) return;
        this.activeModIds = this.activeModIds.filter((_, idx) => idx !== i);
        this.notify();
    },

    // An/Aus für einmalige Mods (Settings-Grid). Bei stapelbaren: aktiv → alle
    // Kopien weg, sonst genau eine hinzufügen.
    toggleMod(id: string) {
        this.activeModIds = this.activeModIds.includes(id)
            ? this.activeModIds.filter(m => m !== id)
            : [...this.activeModIds, id];
        this.notify();
    },

    reset() {
        this.activeModIds = [];
        this.notify();
    },
};
