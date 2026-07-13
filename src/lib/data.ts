import type { Candle, Instrument } from '../types';
import { gaussian, hashSeed, mulberry32 } from './random';

/** Number of days of 1-minute history generated per instrument (fallback). */
export const HISTORY_DAYS = 45;

const MINUTES_PER_YEAR = 525_600;
const DATASET_END = Math.floor(Date.UTC(2024, 5, 1, 0, 0, 0) / 1000);

const cache = new Map<string, Candle[]>();

/** Whether real data has been loaded for a symbol. */
const realDataLoaded = new Map<string, boolean>();

/**
 * Load real Dukascopy data from public/data/<SYMBOL>.json if available.
 * Call this once at app startup; it's async and optional.
 */
export async function loadRealData(symbol: string): Promise<boolean> {
  try {
    const resp = await fetch(`/data/${symbol}.json`);
    if (!resp.ok) return false;
    const raw: Candle[] = await resp.json();
    if (!Array.isArray(raw) || raw.length < 100) return false;
    // Validate first candle shape
    const first = raw[0];
    if (typeof first.time !== 'number' || typeof first.open !== 'number') return false;
    cache.set(symbol, raw);
    realDataLoaded.set(symbol, true);
    return true;
  } catch {
    return false;
  }
}

/** Try to load all instruments' real data. Non-blocking; falls back to synthetic. */
export async function loadAllRealData(symbols: string[]): Promise<void> {
  await Promise.all(symbols.map((s) => loadRealData(s)));
}

/** Returns true if real (Dukascopy) data is being used for this symbol. */
export function isRealData(symbol: string): boolean {
  return realDataLoaded.get(symbol) ?? false;
}

/**
 * Get the base (1-minute) candle series for an instrument.
 * Uses real Dukascopy data if loaded, otherwise generates synthetic data.
 */
export function getBaseCandles(instrument: Instrument): Candle[] {
  const cached = cache.get(instrument.symbol);
  if (cached) return cached;

  // Generate synthetic data as fallback
  const candles = generateSyntheticCandles(instrument);
  cache.set(instrument.symbol, candles);
  return candles;
}

/** Clear cached data for a symbol (useful when switching data sources). */
export function clearCachedData(symbol: string): void {
  cache.delete(symbol);
  realDataLoaded.delete(symbol);
}

// ── Synthetic data generation ────────────────────────────────────────────

function generateSyntheticCandles(instrument: Instrument): Candle[] {
  const totalMinutes = HISTORY_DAYS * 24 * 60;
  const startTime = DATASET_END - totalMinutes * 60;

  const rand = mulberry32(hashSeed(instrument.symbol));
  const sigmaMinute = instrument.volatility / Math.sqrt(MINUTES_PER_YEAR);

  const candles: Candle[] = new Array(totalMinutes);
  const digits = instrument.digits;

  const logBase = Math.log(instrument.basePrice);
  let logP = logBase;
  let drift = 0;
  const kappa = 0.0012;
  let prevClose = instrument.basePrice;

  for (let i = 0; i < totalMinutes; i++) {
    const time = startTime + i * 60;

    drift += gaussian(rand) * sigmaMinute * 0.04;
    drift *= 0.995;

    const reversion = kappa * (logBase - logP);
    logP += reversion + drift + gaussian(rand) * sigmaMinute;

    const open = prevClose;
    const close = Math.exp(logP);

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

  return candles;
}

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}
