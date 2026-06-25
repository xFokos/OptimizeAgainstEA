import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  EAConfig, Generation, Individual,
  WorkerInMessage, WorkerOutMessage,
} from '../types/ea';
import { DEFAULT_MAZE_EA_CONFIG } from '../types/ea';
import type { ReplayFrame } from '../engine/ea/eaReplayLog';

export type EAStatus = 'idle' | 'running' | 'solved' | 'exhausted' | 'error';

export interface MazeRunParams {
  seed: number;
  cols: number;
  rows: number;
}

export interface EAState {
  status: EAStatus;
  generations: Generation[];
  currentGeneration: Generation | null;
  best: Individual | null;
  totalGenerations: number;
  latestReplay: ReplayFrame[] | null;
  errorMessage: string | null;
}

const INITIAL_STATE: EAState = {
  status: 'idle',
  generations: [],
  currentGeneration: null,
  best: null,
  totalGenerations: 0,
  latestReplay: null,
  errorMessage: null,
};

/**
 * Worker interface for the maze EA. Mirrors BattleShips' useEARunner; the only
 * differences are the worker URL, the START payload (maze seed/cols/rows instead
 * of serialized minima) and the maze-typed messages.
 */
export function useMazeEARunner() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<EAState>(INITIAL_STATE);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const attachWorker = useCallback((worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'GENERATION':
          setState((prev) => {
            const solved = prev.status === 'solved';
            return {
              ...prev,
              status: solved ? 'solved' : 'running',
              currentGeneration: msg.generation,
              generations: [...prev.generations, msg.generation],
              best:
                prev.best === null || msg.generation.best.fitness < prev.best.fitness
                  ? msg.generation.best
                  : prev.best,
              totalGenerations: solved ? prev.totalGenerations : msg.generation.index + 1,
              latestReplay: msg.replay ?? prev.latestReplay,
            };
          });
          break;
        case 'SOLVED':
          setState((prev) => ({
            ...prev,
            status: 'solved',
            currentGeneration: msg.generation,
            generations: [...prev.generations, msg.generation],
            best: msg.generation.best,
            totalGenerations: msg.totalGenerations,
            latestReplay: msg.replay ?? prev.latestReplay,
          }));
          break;
        case 'EXHAUSTED':
          setState((prev) => ({
            ...prev,
            status: 'exhausted',
            best: msg.best,
            totalGenerations: msg.totalGenerations,
          }));
          break;
        case 'ERROR':
          setState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: msg.message,
          }));
          worker.terminate();
          break;
      }
    };

    worker.onerror = (err) => {
      setState((prev) => ({ ...prev, status: 'error', errorMessage: err.message }));
      worker.terminate();
    };
  }, []);

  const init = useCallback((params: MazeRunParams, config: EAConfig = DEFAULT_MAZE_EA_CONFIG) => {
    workerRef.current?.terminate();
    setState({ ...INITIAL_STATE, status: 'running' });

    const worker = new Worker(
      new URL('../engine/ea/maze.worker.ts', import.meta.url),
      { type: 'module' },
    );
    attachWorker(worker);
    workerRef.current = worker;

    worker.postMessage({
      type: 'START',
      config,
      seed: params.seed,
      cols: params.cols,
      rows: params.rows,
    } as WorkerInMessage);
  }, [attachWorker]);

  const start = useCallback((params: MazeRunParams, config: EAConfig = DEFAULT_MAZE_EA_CONFIG) => {
    init(params, config);
  }, [init]);

  const step = useCallback((count: number = 1) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'STEP', count } as WorkerInMessage);
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' } as WorkerInMessage);
    workerRef.current?.terminate();
    workerRef.current = null;
    setState((prev) => ({ ...prev, status: 'idle' }));
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { ...state, init, start, step, stop, reset };
}
