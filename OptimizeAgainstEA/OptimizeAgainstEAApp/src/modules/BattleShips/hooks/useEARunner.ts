import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  EAConfig, Generation, Individual,
  WorkerInMessage, WorkerOutMessage,
} from '../types/ea';
import { DEFAULT_EA_CONFIG } from '../types/ea';
import type { ProblemSource } from '../engine/problemCode';
import type { ReplayFrame } from '../engine/ea/eaReplayLog';

export type EAStatus = 'idle' | 'running' | 'solved' | 'exhausted' | 'error';

export interface EAState {
  status:            EAStatus;
  generations:       Generation[];
  currentGeneration: Generation | null;
  best:              Individual | null;
  totalGenerations:  number;
  latestReplay:      ReplayFrame[] | null;
  errorMessage:      string | null;
}

const INITIAL_STATE: EAState = {
  status:            'idle',
  generations:       [],
  currentGeneration: null,
  best:              null,
  totalGenerations:  0,
  latestReplay:      null,
  errorMessage:      null,
};

export function useEARunner() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<EAState>(INITIAL_STATE);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const attachWorker = useCallback((worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'GENERATION':
          setState((prev) => {
            // Once solved, the generation count is locked to the solving
            // generation — further player probes keep the worker running but
            // must not advance the "Solved in X generations" tally.
            const solved = prev.status === 'solved';
            return {
              ...prev,
              status:            solved ? 'solved' : 'running',
              currentGeneration: msg.generation,
              generations:       [...prev.generations, msg.generation],
              best:
                prev.best === null || msg.generation.best.fitness < prev.best.fitness
                  ? msg.generation.best
                  : prev.best,
              totalGenerations: solved ? prev.totalGenerations : msg.generation.index + 1,
              latestReplay:     msg.replay ?? prev.latestReplay,
            };
          });
          break;
        case 'SOLVED':
          setState((prev) => ({
            ...prev,
            status:            'solved',
            currentGeneration: msg.generation,
            generations:       [...prev.generations, msg.generation],
            best:              msg.generation.best,
            totalGenerations:  msg.totalGenerations,
            latestReplay:      msg.replay ?? prev.latestReplay,
          }));
          break;
        case 'EXHAUSTED':
          setState((prev) => ({
            ...prev,
            status:           'exhausted',
            best:             msg.best,
            totalGenerations: msg.totalGenerations,
          }));
          break;
        case 'ERROR':
          setState((prev) => ({
            ...prev,
            status:       'error',
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

  const init = useCallback((source: ProblemSource, config: EAConfig = DEFAULT_EA_CONFIG) => {
    workerRef.current?.terminate();
    setState({ ...INITIAL_STATE, status: 'running' });

    const worker = new Worker(
      new URL('../engine/ea/ea.worker.ts', import.meta.url),
      { type: 'module' },
    );
    attachWorker(worker);
    workerRef.current = worker;

    worker.postMessage({ type: 'START', config, source } as WorkerInMessage);
  }, [attachWorker]);

  const start = useCallback((source: ProblemSource, config: EAConfig = DEFAULT_EA_CONFIG) => {
    init(source, config);
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