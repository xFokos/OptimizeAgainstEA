import type { WorkerInMessage, WorkerOutMessage } from '../../types/ea';
import type { FitnessFnId, MazeProblem, WallRule } from '../../types/maze';
import { createMazeProblem } from '../mazeProblem';
import { createMazeEAStepper, type EAStepper } from './evolutionaryAlgorithm';

// Stepper is kept in worker scope — persists between STEP messages.
let stepper: EAStepper | null = null;
// Rebuilds the problem on the same maze with a different fitness fn / wall rule,
// so UPDATE_CONFIG can swap the objective without touching the population.
let buildProblem: ((fitnessFnId: FitnessFnId, wallRule: WallRule) => MazeProblem) | null = null;
let curFitnessFnId: FitnessFnId | null = null;
let curWallRule: WallRule = 'waste';

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'STOP') {
    stepper = null;
    buildProblem = null;
    return;
  }

  if (msg.type === 'START') {
    try {
      // The genome-length factor is fixed for the worker's lifetime: the main
      // thread restarts the run (fresh START) when it changes, so mixed-length
      // populations can never occur.
      const pathLengthFactor = msg.config.pathLengthFactor;
      buildProblem = (fitnessFnId, wallRule) =>
        msg.maze
          ? createMazeProblem({
              cols: msg.maze.cols,
              rows: msg.maze.rows,
              grid: { cols: msg.maze.cols, rows: msg.maze.rows, walls: msg.maze.walls },
              start: msg.maze.start,
              goal: msg.maze.goal,
              fitnessFnId,
              seed: msg.seed,
              wallRule,
              pathLengthFactor,
            })
          : createMazeProblem({
              cols: msg.cols,
              rows: msg.rows,
              seed: msg.seed,
              fitnessFnId,
              wallRule,
              pathLengthFactor,
            });
      curFitnessFnId = msg.config.fitnessFnId;
      curWallRule = msg.config.wallRule;
      // The EA RNG is seeded too, so the only thing that varies between fitness
      // functions on the same maze seed is `evaluate` — the comparison demo.
      stepper = createMazeEAStepper(buildProblem(curFitnessFnId, curWallRule), msg.config, msg.seed);
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

  if (msg.type === 'UPDATE_CONFIG') {
    if (!stepper || !buildProblem) return;
    // Only the fitness function and the wall rule change the problem; rebuild
    // (and re-evaluate the population) just for those. Everything else is pure
    // tuning that the next generation reads directly.
    if (msg.config.fitnessFnId !== curFitnessFnId || msg.config.wallRule !== curWallRule) {
      curFitnessFnId = msg.config.fitnessFnId;
      curWallRule = msg.config.wallRule;
      stepper.updateConfig(msg.config, buildProblem(curFitnessFnId, curWallRule));
    } else {
      stepper.updateConfig(msg.config);
    }
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
