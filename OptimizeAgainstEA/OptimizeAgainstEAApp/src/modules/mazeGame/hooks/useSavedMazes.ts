import type { SerializedMaze } from '../types/maze';
import { encodeMaze, mazeId } from '../engine/mazeCodec';
import { useSavedLibrary, type SavedEntryBase } from '../../../hooks/useSavedLibrary';

// Player-created mazes persist here across sessions (localStorage).
const STORAGE_KEY = 'maze.savedMazes';

export interface SavedMaze extends SavedEntryBase {
  /** Shareable maze code (what gets pasted into a loader). */
  code: string;
  cols: number;
  rows: number;
}

function toEntry(maze: SerializedMaze, name?: string): SavedMaze {
  return {
    id: mazeId(maze),
    ...(name ? { name } : {}),
    code: encodeMaze(maze),
    createdAt: Date.now(),
    cols: maze.cols,
    rows: maze.rows,
  };
}

/**
 * The player's saved-maze library — a thin domain wrapper around the shared
 * useSavedLibrary hook. Saving an identical maze (same content-derived id) is
 * a no-op; `saveMaze` returns the id either way.
 */
export function useSavedMazes() {
  const { entries, save, remove, rename } = useSavedLibrary<SerializedMaze, SavedMaze>(STORAGE_KEY, toEntry);
  return { savedMazes: entries, saveMaze: save, removeMaze: remove, renameMaze: rename };
}
