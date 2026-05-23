import type { WorkerInMessage, WorkerOutMessage, EAConfig } from '../../types/ea';
import type { MapConfig, ProblemInstance, Minimum } from '../../types/map';
import { createMapProblem } from '../functionSurface';
import { createEAStepper, type EAStepper } from './evolutionaryAlgorithm';

function buildProblem(
  positions: Array<{ x: number; y: number; isGlobal: boolean }>,
  winRadius: number,
): ProblemInstance {
  const minima: Minimum[] = positions.map((p, i) => ({
    id: `m_${i}`, position: { x: p.x, y: p.y }, isGlobal: p.isGlobal,
  }));
  const config: MapConfig = {
    id: 'ea-worker', minima,
    bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    winRadius, createdAt: 0,
  };
  return createMapProblem(config);
}

// Stepper is kept in worker scope — persists between STEP messages
let stepper: EAStepper | null = null;
let eaConfig: EAConfig | null = null;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'STOP') {
    stepper  = null;
    eaConfig = null;
    return;
  }

  if (msg.type === 'START') {
    let problem: ProblemInstance;
    try {
      problem = buildProblem(msg.minima.positions, msg.winRadius);
    } catch (err) {
      const out: WorkerOutMessage = {
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to build problem',
      };
      self.postMessage(out);
      return;
    }
    eaConfig = msg.config;
    stepper  = createEAStepper(problem, msg.config);
    // Post the initial generation (gen 0 = just the random population)
    const result = stepper.step(0);
    if (result.type === 'generation') {
      self.postMessage({ type: 'GENERATION', generation: result.generation } as WorkerOutMessage);
    }
    return;
  }

  if (msg.type === 'STEP') {
    if (!stepper) return;

    const result = stepper.step(msg.count);

    if (result.type === 'generation') {
      self.postMessage({ type: 'GENERATION', generation: result.generation } as WorkerOutMessage);
    } else if (result.type === 'solved') {
      self.postMessage({ type: 'SOLVED', generation: result.generation, totalGenerations: result.totalGenerations } as WorkerOutMessage);
    } else if (result.type === 'exhausted') {
      self.postMessage({ type: 'EXHAUSTED', totalGenerations: result.totalGenerations, best: result.best } as WorkerOutMessage);
    }
  }
};