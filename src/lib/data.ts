import type { Candle, Instrument } from '../types';
import { gaussian, hashSeed, mulberry32 } from './random';

/** Number of days of 1-minute history generated per instrument. */
export const HISTORY_DAYS = 45;

/** Minutes in a year — used to scale annualised volatility to per-minute. */
const MINUTES_PER_YEAR = 525_600;

/**
 * Fixed dataset anchor. The generated series ends at this instant so replay
 * sessions are fully deterministic and independent of the wall clock.
 */
const DATASET_END = Math.floor(Date.UTC(2024, 5, 1, 0, 0, 0) / 1000); // 2024-06-01T00:00:00Z

const cache = new Map<string, Candle[]>();

/**
 * Generate (and cache) a deterministic series of 1-minute candles for an
 * instrument using a geometric random walk with mild mean reversion and a
 * slow-moving trend component, producing realistic-looking price action.
 */
export function getBaseCandles(instrument: Instrument): Candle[] {
  const cached = cache.get(instrument.symbol);
  if (cached) return cached;

  const totalMinutes = HISTORY_DAYS * 24 * 60;
  const startTime = DATASET_END - totalMinutes * 60;

  const rand = mulberry32(hashSeed(instrument.symbol));
  const sigmaMinute = instrument.volatility / Math.sqrt(MINUTES_PER_YEAR);

  const candles: Candle[] = new Array(totalMinutes);
  const digits = instrument.digits;

  // Model log-price as a mean-reverting (Ornstein–Uhlenbeck) process anchored
  // to the instrument's base price, plus a slow, short-memory drift term that
  // produces realistic trending/ranging regimes. Mean reversion keeps the
  // series bounded within a plausible band (e.g. EURUSD stays near ~1.08)
  // instead of wandering off exponentially.
  const logBase = Math.log(instrument.basePrice);
  let logP = logBase;
  let drift = 0;

  // Reversion speed: smaller => wider band. The stationary offset from the
  // base price is roughly `drift / kappa`, so kappa must dominate the drift
  // to keep excursions realistic (e.g. EURUSD within a few percent of base).
  const kappa = 0.0012;

  let prevClose = instrument.basePrice;

  for (let i = 0; i < totalMinutes; i++) {
    const time = startTime + i * 60;

    // Evolve a mean-reverting drift (memory ~200 bars) for intraday trends.
    drift += gaussian(rand) * sigmaMinute * 0.04;
    drift *= 0.995;

    const reversion = kappa * (logBase - logP);
    logP += reversion + drift + gaussian(rand) * sigmaMinute;

    const open = prevClose;
    const close = Math.exp(logP);

    // Build a plausible intra-minute range around open/close.
    const wick = Math.abs(gaussian(rand)) * sigmaMinute * close * 0.9;
    const high = Math.max(open, close) + wick * rand();
    const low = Math.min(open, close) - wick * rand();

    candles[i] = {
      time,
      open: round(open, digits),
      high: round(high, digits),
      low: round(low, digits),
      close: round(close, digits),
    };

    prevClose = close;
  }

  cache.set(instrument.symbol, candles);
  return candles;
}

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}
