import { useState, useCallback } from 'react';
import type { ProblemInstance, ProbeResult, Coordinate } from '../types/map.ts';

export type PlayStatus = 'idle' | 'playing' | 'won';

export function usePlaySession(problem: ProblemInstance | null) {
  const [probes, setProbes] = useState<ProbeResult[]>([]);
  const [status, setStatus] = useState<PlayStatus>('idle');

  const probe = useCallback(
    (position: Coordinate) => {
      if (!problem) return;

      const value = problem.evaluate(position.x, position.y);
      const win = problem.isWin(position.x, position.y);

      const result: ProbeResult = { position, value, isWin: win };
      setProbes((prev) => [...prev, result]);
      // Once won, the status stays 'won' — but probes still register so the
      // player can keep exploring the map after dismissing the win overlay.
      if (win) setStatus('won');
      else if (status === 'idle') setStatus('playing');
    },
    [problem, status]
  );

  const reset = useCallback(() => {
    setProbes([]);
    setStatus('idle');
  }, []);

  // Best probe so far (lowest value = closest to a minimum)
  const bestProbe = probes.reduce<ProbeResult | null>(
    (best, p) => (best === null || p.value < best.value ? p : best),
    null
  );

  return { probes, status, bestProbe, probe, reset };
}
