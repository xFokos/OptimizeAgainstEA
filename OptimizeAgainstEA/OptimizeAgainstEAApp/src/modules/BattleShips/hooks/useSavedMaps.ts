import { useCallback, useState } from 'react';
import type { MapConfig } from '../types/map';
import { encodeMap } from '../engine/mapCodec';

// Player-created maps persist here across sessions (localStorage).
const STORAGE_KEY = 'bs.savedMaps';

export interface SavedMap {
  /** The map's id — also used to de-duplicate saves. */
  id: string;
  /** Optional player-given name; falls back to the id when absent. */
  name?: string;
  /** Shareable map code (what gets pasted into a loader). */
  code: string;
  createdAt: number;
  minimaCount: number;
}

// ── Storage helpers (guarded — storage can throw in private mode) ──────────
function read(): SavedMap[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedMap[]) : [];
  } catch {
    return [];
  }
}

function write(maps: SavedMap[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  } catch {
    /* ignore */
  }
}

/**
 * Reads and mutates the player's saved-map library. Each mounted instance
 * seeds its state from localStorage, so loader screens (which are never
 * mounted at the same time) always reflect the latest persisted list.
 */
export function useSavedMaps() {
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>(read);

  /** Persist a freshly created map. No-ops if a map with the same id exists. */
  const saveMap = useCallback((config: MapConfig, name?: string) => {
    const trimmed = name?.trim();
    setSavedMaps((prev) => {
      if (prev.some((m) => m.id === config.id)) return prev;
      const entry: SavedMap = {
        id: config.id,
        ...(trimmed ? { name: trimmed } : {}),
        code: encodeMap(config),
        createdAt: config.createdAt ?? Date.now(),
        minimaCount: config.minima.length,
      };
      const next = [entry, ...prev];
      write(next);
      return next;
    });
  }, []);

  const removeMap = useCallback((id: string) => {
    setSavedMaps((prev) => {
      const next = prev.filter((m) => m.id !== id);
      write(next);
      return next;
    });
  }, []);

  /** Rename a saved map. An empty/blank name clears it (reverts to the id). */
  const renameMap = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setSavedMaps((prev) => {
      const next = prev.map((m) =>
        m.id === id ? { ...m, name: trimmed || undefined } : m,
      );
      write(next);
      return next;
    });
  }, []);

  return { savedMaps, saveMap, removeMap, renameMap };
}
