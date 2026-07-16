import { useCallback, useState } from 'react';

/** What every saved-library entry carries; games extend this with their own fields. */
export interface SavedEntryBase {
  /** Unique id — also used to de-duplicate saves. */
  id: string;
  /** Optional player-given name; UIs fall back to the id when absent. */
  name?: string;
  createdAt: number;
}

// ── Storage helpers (guarded — storage can throw in private mode) ──────────
function read<Entry>(storageKey: string): Entry[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function write<Entry>(storageKey: string, entries: Entry[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

/**
 * Reads and mutates a localStorage-persisted library of player creations
 * (saved PeakFinder maps, saved mazes, …). Each mounted instance seeds its
 * state from localStorage, so screens that are never mounted at the same time
 * always reflect the latest persisted list.
 *
 * `toEntry` turns the game's input into a full entry; its `id` de-duplicates
 * (saving an id that already exists is a no-op). `save` returns the entry's id
 * either way. An empty/blank name in `save`/`rename` clears the name.
 */
export function useSavedLibrary<Input, Entry extends SavedEntryBase>(
  storageKey: string,
  toEntry: (input: Input, name?: string) => Entry,
) {
  const [entries, setEntries] = useState<Entry[]>(() => read<Entry>(storageKey));

  const save = useCallback((input: Input, name?: string) => {
    const entry = toEntry(input, name?.trim() || undefined);
    setEntries((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev;
      const next = [entry, ...prev];
      write(storageKey, next);
      return next;
    });
    return entry.id;
  }, [storageKey, toEntry]);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.id === id ? { ...e, name: trimmed || undefined } : e,
      );
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { entries, save, remove, rename };
}
