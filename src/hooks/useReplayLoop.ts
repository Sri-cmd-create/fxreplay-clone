import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Drives the replay playback. While `playing` is true it advances the replay
 * one bar of the current timeframe at an interval scaled by the chosen speed
 * (speed = bars per second).
 */
export function useReplayLoop(): void {
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);

  useEffect(() => {
    if (!playing) return;
    const intervalMs = Math.max(20, 1000 / speed);
    const id = window.setInterval(() => {
      useStore.getState().tick();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [playing, speed]);
}
