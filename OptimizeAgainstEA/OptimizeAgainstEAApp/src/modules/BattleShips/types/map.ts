export interface Coordinate {
  x: number; // normalized 0–1
  y: number; // normalized 0–1
}

export interface Minimum {
  id: string;
  position: Coordinate;
  isGlobal: boolean;
}

export interface MapConfig {
  id: string;
  minima: Minimum[];
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  winRadius: number; // normalized radius around global min to trigger win
  createdAt: number;
}

export interface ProblemInstance {
  evaluate: (x: number, y: number) => number;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  isWin: (x: number, y: number) => boolean;
  metadata?: {
    name?: string;
    description?: string;
    globalMinimum?: { x: number; y: number; value: number };
  };
}

export interface ProbeResult {
  position: Coordinate;
  value: number;
  isWin: boolean;
}