import type {Coordinate} from '../types/map.ts';

export function euclideanDistance(a: Coordinate, b: Coordinate): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function isWithinRadius(
  point: Coordinate,
  center: Coordinate,
  radius: number
): boolean {
  return euclideanDistance(point, center) <= radius;
}

export function closestMinimumDistance(
  point: Coordinate,
  minima: Coordinate[]
): number {
  if (minima.length === 0) return Infinity;
  return Math.min(...minima.map((m) => euclideanDistance(point, m)));
}
