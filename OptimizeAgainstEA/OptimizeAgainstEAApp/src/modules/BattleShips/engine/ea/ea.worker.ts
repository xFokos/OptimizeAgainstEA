import type { WorkerInMessage, WorkerOutMessage } from '../../types/ea';
import type { ProblemInstance } from '../../types/map';
import { buildProblemFromSource } from '../problemCode';
import { createEAStepper, type EAStepper } from './evolutionaryAlgorithm';

// Stepper is kept in worker scope — persists between STEP messages
let stepper: EAStepper | null = null;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'STOP') {
    stepper = null;
    return;
  }

  if (msg.type === 'START') {
    let problem: ProblemInstance;
    try {
      problem = buildProblemFromSource(msg.source);
    } catch (err) {
      const out: WorkerOutMessage = {
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to build problem',
      };
      self.postMessage(out);
      return;
    }
    stepper = createEAStepper(problem, msg.config);
    // The initial random population is NOT posted here: the first STEP already
    // returns generation 0 (it summarises the population before breeding). Posting
    // it on START too would duplicate generation 0 — making the first replay step
    // show no movement and adding a phantom point to the fitness chart.
    return;
  }

  if (msg.type === 'STEP') {
    if (!stepper) return;

    const result = stepper.step(msg.count);

    if (result.type === 'generation') {
      self.postMessage({ type: 'GENERATION', generation: result.generation, replay: result.replay } as WorkerOutMessage);
    } else if (result.type === 'solved') {
      self.postMessage({ type: 'SOLVED', generation: result.generation, totalGenerations: result.totalGenerations, replay: result.replay } as WorkerOutMessage);
    } else if (result.type === 'exhausted') {
      self.postMessage({ type: 'EXHAUSTED', totalGenerations: result.totalGenerations, best: result.best } as WorkerOutMessage);
    }
  }
};