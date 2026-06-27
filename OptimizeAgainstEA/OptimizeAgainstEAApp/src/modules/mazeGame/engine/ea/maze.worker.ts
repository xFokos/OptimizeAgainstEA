import type { WorkerInMessage, WorkerOutMessage } from '../../types/ea';
import { createMazeProblem } from '../mazeProblem';
import { createMazeEAStepper, type EAStepper } from './evolutionaryAlgorithm';

// Stepper is kept in worker scope — persists between STEP messages.
let stepper: EAStepper | null = null;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'STOP') {
    stepper = null;
    return;
  }

  if (msg.type === 'START') {
    try {
      const problem = msg.maze
        ? createMazeProblem({
            cols: msg.maze.cols,
            rows: msg.maze.rows,
            grid: { cols: msg.maze.cols, rows: msg.maze.rows, walls: msg.maze.walls },
            start: msg.maze.start,
            goal: msg.maze.goal,
            fitnessFnId: msg.config.fitnessFnId,
            seed: msg.seed,
          })
        : createMazeProblem({
            cols: msg.cols,
            rows: msg.rows,
            seed: msg.seed,
            fitnessFnId: msg.config.fitnessFnId,
          });
      // The EA RNG is seeded too, so the only thing that varies between fitness
      // functions on the same maze seed is `evaluate` — the comparison demo.
      stepper = createMazeEAStepper(problem, msg.config, msg.seed);
    } catch (err) {
      const out: WorkerOutMessage = {
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to build maze',
      };
      self.postMessage(out);
    }
    // First STEP returns generation 0; nothing posted on START (see BattleShips).
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
