import { useState, useCallback } from 'react';
import type { Minimum, MapConfig, Coordinate } from '../types/map.ts';
import { encodeMap } from '../engine/mapCodec';

const WIN_RADIUS = 0.04;
const DEFAULT_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

/** Minimum allowed distance between any two minima (normalized 0–1). */
export const MIN_SPACING = 0.12;

/** Maximum minima a creator can place. Raise or lower this freely. */
export const MAX_MINIMA = 12;

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function useGameMap(maxMinima: number = MAX_MINIMA) {
  const [minima, setMinima] = useState<Minimum[]>([]);
  const [mapId, setMapId] = useState(() => generateId());

  const addMinimum = useCallback((position: Coordinate) => {
    setMinima((prev) => {
      if (prev.length >= maxMinima) return prev;
      const tooClose = prev.some((m) => {
        const dx = m.position.x - position.x;
        const dy = m.position.y - position.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_SPACING;
      });
      if (tooClose) return prev;
      return [...prev, { id: `m_${Date.now()}`, position, isGlobal: false }];
    });
  }, [maxMinima]);

  const removeMinimum = useCallback((id: string) => {
    setMinima((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const setGlobalMinimum = useCallback((id: string) => {
    setMinima((prev) =>
        prev.map((m) => ({ ...m, isGlobal: m.id === id }))
    );
  }, []);

  /** Set an explicit floor (depth) for a local minimum, or pass undefined to revert to the random default. */
  const setFloor = useCallback((id: string, floor: number | undefined) => {
    setMinima((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const next: Minimum = { ...m };
          if (floor === undefined) delete next.floor;
          else next.floor = floor;
          return next;
        })
    );
  }, []);

  // Starting over means a brand-new map — mint a fresh id so each created
  // map saves as its own entry (saveMap de-duplicates by id).
  const clearAll = useCallback(() => {
    setMinima([]);
    setMapId(generateId());
  }, []);

  const getMapConfig = useCallback((): MapConfig => {
    return {
      id: mapId,
      minima,
      bounds: DEFAULT_BOUNDS,
      winRadius: WIN_RADIUS,
      createdAt: Date.now(),
    };
  }, [mapId, minima]);

  const getCode = useCallback((): string => {
    return encodeMap(getMapConfig());
  }, [getMapConfig]);

  const hasGlobal = minima.some((m) => m.isGlobal);
  const globalMinimum = minima.find((m) => m.isGlobal) ?? null;
  const isFull = minima.length >= maxMinima;

  return {
    minima,
    mapId,
    maxMinima,
    minSpacing: MIN_SPACING,
    isFull,
    hasGlobal,
    globalMinimum,
    addMinimum,
    removeMinimum,
    setGlobalMinimum,
    setFloor,
    clearAll,
    getMapConfig,
    getCode,
  };
}