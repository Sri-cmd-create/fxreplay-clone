import type { Candle } from '../types';

/**
 * Aggregate a series of base (1-minute) candles into a higher timeframe.
 *
 * Buckets are aligned to the UNIX epoch (i.e. a bucket starts at a time that
 * is an exact multiple of `tfMinutes`), matching how brokers align bars. The
 * final bucket may be partial when replay is mid-bar — that is intentional and
 * mirrors a live "forming" candle.
 *
 * @param base       Base 1-minute candles, ascending by time.
 * @param count      Only the first `count` base candles are considered
 *                   (the replay playhead). Defaults to the whole array.
 * @param tfMinutes  Target timeframe size in minutes.
 */
export function aggregate(
  base: Candle[],
  tfMinutes: number,
  count: number = base.length,
): Candle[] {
  if (tfMinutes <= 1) return count >= base.length ? base : base.slice(0, count);

  const bucketSeconds = tfMinutes * 60;
  const out: Candle[] = [];
  const limit = Math.min(count, base.length);

  let current: Candle | null = null;
  let currentBucket = -1;

  for (let i = 0; i < limit; i++) {
    const c = base[i];
    const bucket = Math.floor(c.time / bucketSeconds) * bucketSeconds;

    if (bucket !== currentBucket) {
      if (current) out.push(current);
      current = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close };
      currentBucket = bucket;
    } else if (current) {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
    }
  }

  if (current) out.push(current);
  return out;
}
