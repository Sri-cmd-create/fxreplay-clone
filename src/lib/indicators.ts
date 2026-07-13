import type { Candle } from '../types';

/** Supported indicator types. */
export type IndicatorType = 'sma' | 'ema';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  period: number;
  color: string;
}

/** Simple Moving Average. */
export function sma(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  result[period - 1] = sum / period;

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close;
    result[i] = sum / period;
  }
  return result;
}

/** Exponential Moving Average. */
export function ema(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  // Seed with SMA of first `period` bars
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let prev = sum / period;
  result[period - 1] = prev;

  const k = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

/** Compute indicator values based on config. */
export function computeIndicator(
  candles: Candle[],
  config: IndicatorConfig,
): (number | null)[] {
  switch (config.type) {
    case 'sma':
      return sma(candles, config.period);
    case 'ema':
      return ema(candles, config.period);
    default:
      return new Array(candles.length).fill(null);
  }
}

/** Default indicator presets. */
export const DEFAULT_INDICATORS: IndicatorConfig[] = [];

export const INDICATOR_PRESETS: IndicatorConfig[] = [
  { id: 'ema-9', type: 'ema', period: 9, color: '#f0b90b' },
  { id: 'ema-21', type: 'ema', period: 21, color: '#2962ff' },
  { id: 'sma-50', type: 'sma', period: 50, color: '#ab47bc' },
  { id: 'sma-200', type: 'sma', period: 200, color: '#ef5350' },
];
