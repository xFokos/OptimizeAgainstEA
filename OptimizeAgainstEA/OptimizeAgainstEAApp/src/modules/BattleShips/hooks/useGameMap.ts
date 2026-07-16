import { useState, useCallback } from 'react';
import type { Minimum, MapConfig, Coordinate } from '../types/map.ts';
import { encodeMap, MAP_SIZES, DEFAULT_MAP_SIZE, type MapSizeId } from '../engine/mapCodec';

const DEFAULT_BOUNDS = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Create-mode map state. `size` picks the same presets a random map uses — how
 * many mountains fit, how close together they may stand, and how tight the
 * summit is. Growing or shrinking the size mid-build never discards what's
 * already placed: it only changes what may be added from here on (so shrinking
 * below the current count simply means the map is full).
 */
export function useGameMap(size: MapSizeId = DEFAULT_MAP_SIZE) {
  const preset = MAP_SIZES[size] ?? MAP_SIZES[DEFAULT_MAP_SIZE];
  const maxMinima = preset.minima[1];
  const minSpacing = preset.minSpacing;

  const [minima, setMinima] = useState<Minimum[]>([]);
  const [mapId, setMapId] = useState(() => generateId());

  const addMinimum = useCallback((position: Coordinate) => {
    setMinima((prev) => {
      if (prev.length >= maxMinima) return prev;
      const tooClose = prev.some((m) => {
        const dx = m.position.x - position.x;
        const dy = m.position.y - position.y;
        return Math.sqrt(dx * dx + dy * dy) < minSpacing;
      });
      if (tooClose) return prev;
      return [...prev, { id: `m_${Date.now()}`, position, isGlobal: false }];
    });
  }, [maxMinima, minSpacing]);

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
      winRadius: preset.winRadius,
      basinScale: preset.basinScale,
      createdAt: Date.now(),
    };
  }, [mapId, minima, preset.winRadius, preset.basinScale]);

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
    minSpacing,
    winRadius: preset.winRadius,
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