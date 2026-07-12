import type { Instrument, Timeframe, TimeframeCode } from '../types';

/** All instruments available in the replay terminal. */
export const INSTRUMENTS: Instrument[] = [
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    digits: 5,
    pipSize: 0.0001,
    contractSize: 100_000,
    basePrice: 1.085,
    volatility: 0.07,
    leverage: 100,
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    digits: 5,
    pipSize: 0.0001,
    contractSize: 100_000,
    basePrice: 1.265,
    volatility: 0.09,
    leverage: 100,
  },
  {
    symbol: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    digits: 5,
    pipSize: 0.0001,
    contractSize: 100_000,
    basePrice: 0.655,
    volatility: 0.08,
    leverage: 100,
  },
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    digits: 2,
    pipSize: 0.1,
    contractSize: 100,
    basePrice: 2320,
    volatility: 0.14,
    leverage: 100,
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    digits: 2,
    pipSize: 1,
    contractSize: 1,
    basePrice: 64000,
    volatility: 0.55,
    leverage: 20,
  },
];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i]),
);

export function getInstrument(symbol: string): Instrument {
  const found = INSTRUMENT_MAP[symbol];
  if (!found) throw new Error(`Unknown instrument: ${symbol}`);
  return found;
}

/** Ordered list of supported timeframes. */
export const TIMEFRAMES: Timeframe[] = [
  { code: 'M1', label: '1m', minutes: 1 },
  { code: 'M5', label: '5m', minutes: 5 },
  { code: 'M15', label: '15m', minutes: 15 },
  { code: 'M30', label: '30m', minutes: 30 },
  { code: 'H1', label: '1H', minutes: 60 },
  { code: 'H4', label: '4H', minutes: 240 },
  { code: 'D1', label: '1D', minutes: 1440 },
];

export const TIMEFRAME_MAP: Record<TimeframeCode, Timeframe> =
  Object.fromEntries(TIMEFRAMES.map((t) => [t.code, t])) as Record<
    TimeframeCode,
    Timeframe
  >;
