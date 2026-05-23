import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  EAConfig, Generation, Individual,
  WorkerInMessage, WorkerOutMessage,
  SerializedMinima,
} from '../types/ea';
import {
  DEFAULT_EA_CONFIG
} from '../types/ea';
import type { MapConfig } from '../types/map';

export type EAStatus = 'idle' | 'running' | 'solved' | 'exhausted' | 'error';

export interface EAState {
  status:            EAStatus;
  generations:       Generation[];
  currentGeneration: Generation | null;
  best:              Individual | null;
  totalGenerations:  number;
  errorMessage:      string | null;
}

const INITIAL_STATE: EAState = {
  status:            'idle',
  generations:       [],
  currentGeneration: null,
  best:              null,
  totalGenerations:  0,
  errorMessage:      null,
};

export function useEARunner() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<EAState>(INITIAL_STATE);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  // Shared handler wired up when the worker is created
  const attachWorker = useCallback((worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'GENERATION':
          setState((prev) => ({
            ...prev,
            status:            'running',
            currentGeneration: msg.generation,
            generations:       [...prev.generations, msg.generation],
            best:
              prev.best === null || msg.generation.best.fitness < prev.best.fitness
                ? msg.generation.best
                : prev.best,
            totalGenerations: msg.generation.index + 1,
          }));
          break;
        case 'SOLVED':
          setState((prev) => ({
            ...prev,
            status:            'solved',
            currentGeneration: msg.generation,
            generations:       [...prev.generations, msg.generation],
            best:              msg.generation.best,
            totalGenerations:  msg.totalGenerations,
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

  /** Initialise the worker + EA state. Does NOT start running — call step() to advance. */
  const init = useCallback((mapConfig: MapConfig, config: EAConfig = DEFAULT_EA_CONFIG) => {
    workerRef.current?.terminate();
    setState({ ...INITIAL_STATE, status: 'running' });

    const worker = new Worker(
      new URL('../engine/ea/ea.worker.ts', import.meta.url),
      { type: 'module' },
    );
    attachWorker(worker);
    workerRef.current = worker;

    const minima: SerializedMinima = {
      positions: mapConfig.minima.map((m) => ({
        x: m.position.x, y: m.position.y, isGlobal: m.isGlobal,
      })),
    };

    worker.postMessage({ type: 'START', config, minima, winRadius: mapConfig.winRadius } as WorkerInMessage);
  }, [attachWorker]);

  /** Run the EA freely until solved / exhausted (original behaviour) */
  const start = useCallback((mapConfig: MapConfig, config: EAConfig = DEFAULT_EA_CONFIG) => {
    init(mapConfig, config);
    // After START the worker runs to completion via its loop in runEA
  }, [init]);

  /**
   * Advance the EA by `count` generations.
   * Use this in vs-EA mode: call step(n) every time the player makes a guess.
   * `init()` must have been called first.
   */
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