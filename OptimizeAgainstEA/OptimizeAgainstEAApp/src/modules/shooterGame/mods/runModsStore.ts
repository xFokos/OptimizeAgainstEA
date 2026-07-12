// Mod-Fortschritt für den aktuellen Run – geteilt zwischen Solo Play und Horde
// (genau wie shooterSettings.playerStats schon heute in beiden Modi dieselben
// Bullet-/Move-Speed-Werte liefert). Bewusst kein Setting: nicht persistiert,
// kein Cross-Progression über Reloads hinweg.
//
// Alle Mods sind jederzeit frei togglebar (Player-Tab) — kein Lock/Unlock.
// Die periodische Choice-Auswahl (alle 5 Generationen in Solo, alle X Kills in
// Horde) ist nur ein Bonus-Moment und aktiviert einen noch inaktiven Mod direkt.
import { createListenable } from '../../../utils/listenable';

export const runModsStore = {
    activeModIds: [] as string[],
    ...createListenable(),

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
