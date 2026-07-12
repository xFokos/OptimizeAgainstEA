import type { MapConfig } from '../types/map';
import { encodeMap } from '../engine/mapCodec';
import { useSavedLibrary, type SavedEntryBase } from '../../../hooks/useSavedLibrary';

// Player-created maps persist here across sessions (localStorage).
const STORAGE_KEY = 'bs.savedMaps';

export interface SavedMap extends SavedEntryBase {
  /** Shareable map code (what gets pasted into a loader). */
  code: string;
  minimaCount: number;
}

function toEntry(config: MapConfig, name?: string): SavedMap {
  return {
    id: config.id,
    ...(name ? { name } : {}),
    code: encodeMap(config),
    createdAt: config.createdAt ?? Date.now(),
    minimaCount: config.minima.length,
  };
}

/**
 * The player's saved-map library — a thin domain wrapper around the shared
 * useSavedLibrary hook. Saving a map whose id already exists is a no-op.
 */
export function useSavedMaps() {
  const { entries, save, remove, rename } = useSavedLibrary<MapConfig, SavedMap>(STORAGE_KEY, toEntry);
  return { savedMaps: entries, saveMap: save, removeMap: remove, renameMap: rename };
}
