import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReplayFrame } from '../engine/ea/eaReplayLog';

/**
 * Playback state machine for the per-generation replay. A maze-typed copy of
 * BattleShips' useEAReplay — identical logic, only the ReplayFrame type differs.
 */
export function useMazeEAReplay(frames: ReplayFrame[]) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentFrame = frames[frameIndex] ?? null;
  const isFirst = frameIndex === 0;
  const isLast = frameIndex === frames.length - 1;

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const next = useCallback(() => {
    setFrameIndex((i) => Math.min(i + 1, frames.length - 1));
  }, [frames.length]);

  const prev = useCallback(() => {
    setFrameIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback((i: number) => {
    setFrameIndex(Math.max(0, Math.min(i, frames.length - 1)));
  }, [frames.length]);

  const play = useCallback((intervalMs = 1600) => {
    stopInterval();
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setFrameIndex((i) => {
        if (i >= frames.length - 1) {
          stopInterval();
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, intervalMs);
  }, [frames.length, stopInterval]);

  const pause = useCallback(() => {
    stopInterval();
    setIsPlaying(false);
  }, [stopInterval]);

  // Playback self-terminates inside the interval when the last frame is reached
  // (see `play`); we only need to clear the interval on unmount.
  useEffect(() => () => stopInterval(), [stopInterval]);

  return {
    frameIndex,
    currentFrame,
    isPlaying,
    isFirst,
    isLast,
    totalFrames: frames.length,
    next,
    prev,
    goTo,
    play,
    pause,
  };
}
