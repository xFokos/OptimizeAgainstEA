import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Playback state machine for stepping through a recorded frame list — shared
 * by every replay overlay (PeakFinder EA replay, Maze EA replay, generation
 * replay). Generic over the frame type: the hook only navigates, it never
 * looks inside a frame.
 *
 * `autoplayIntervalMs` is the dwell time per frame when `play()` is called
 * without an argument; an explicit `play(ms)` overrides it.
 */
export function useReplayPlayer<Frame>(frames: Frame[], autoplayIntervalMs = 1200) {
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

  const play = useCallback((intervalMs = autoplayIntervalMs) => {
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
  }, [frames.length, autoplayIntervalMs, stopInterval]);

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
