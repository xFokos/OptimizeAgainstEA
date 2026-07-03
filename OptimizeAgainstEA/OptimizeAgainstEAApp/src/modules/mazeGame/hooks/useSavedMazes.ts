import { useCallback, useState } from 'react';
import type { SerializedMaze } from '../types/maze';
import { encodeMaze, mazeId } from '../engine/mazeCodec';

// Player-created mazes persist here across sessions (localStorage).
// Mirrors BattleShips' useSavedMaps.
const STORAGE_KEY = 'maze.savedMazes';

export interface SavedMaze {
  /** Content-derived id — also used to de-duplicate saves. */
  id: string;
  /** Optional player-given name; falls back to the id when absent. */
  name?: string;
  /** Shareable maze code (what gets pasted into a loader). */
  code: string;
  createdAt: number;
  cols: number;
  rows: number;
}

// ── Storage helpers (guarded — storage can throw in private mode) ──────────
function read(): SavedMaze[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedMaze[]) : [];
  } catch {
    return [];
  }
}

function write(mazes: SavedMaze[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mazes));
  } catch {
    /* ignore */
  }
}

/**
 * Reads and mutates the player's saved-maze library. Each mounted instance
 * seeds its state from localStorage, so the creator and the experiment setup
 * screen (never mounted at the same time) always see the latest list.
 */
export function useSavedMazes() {
  const [savedMazes, setSavedMazes] = useState<SavedMaze[]>(read);

  /** Persist a maze. No-ops if an identical maze (same id) is already saved. */
  const saveMaze = useCallback((maze: SerializedMaze, name?: string) => {
    const trimmed = name?.trim();
    const id = mazeId(maze);
    setSavedMazes((prev) => {
      if (prev.some((m) => m.id === id)) return prev;
      const entry: SavedMaze = {
        id,
        ...(trimmed ? { name: trimmed } : {}),
        code: encodeMaze(maze),
        createdAt: Date.now(),
        cols: maze.cols,
        rows: maze.rows,
      };
      const next = [entry, ...prev];
      write(next);
      return next;
    });
    return id;
  }, []);

  const removeMaze = useCallback((id: string) => {
    setSavedMazes((prev) => {
      const next = prev.filter((m) => m.id !== id);
      write(next);
      return next;
    });
  }, []);

  /** Rename a saved maze. An empty/blank name clears it (reverts to the id). */
  const renameMaze = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setSavedMazes((prev) => {
      const next = prev.map((m) =>
        m.id === id ? { ...m, name: trimmed || undefined } : m,
      );
      write(next);
      return next;
    });
  }, []);

  return { savedMazes, saveMaze, removeMaze, renameMaze };
}
