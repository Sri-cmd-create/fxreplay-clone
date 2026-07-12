import { create } from 'zustand';
import type {
  Candle,
  ClosedTrade,
  Position,
  Side,
  TimeframeCode,
} from '../types';
import { getBaseCandles } from '../lib/data';
import { getInstrument, TIMEFRAME_MAP } from '../lib/instruments';
import {
  detectStopFill,
  profit,
  pipsGained,
  requiredMargin,
} from '../lib/trading';

/** How many bars of the *current* timeframe remain to be replayed at start. */
const FORWARD_BARS_M1 = 20 * 24 * 60; // ~20 days of 1-minute data

/** Available playback speeds (bars per second multipliers). */
export const SPEEDS = [0.5, 1, 2, 5, 10, 25] as const;

const STARTING_BALANCE = 10_000;

export interface DerivedAccount {
  floatingPnl: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
}

interface StoreState {
  // ── Market / replay ────────────────────────────────────────────────
  symbol: string;
  timeframe: TimeframeCode;
  /** Last revealed base-candle index, per symbol (inclusive). */
  playheads: Record<string, number>;
  playing: boolean;
  speed: number;

  // ── Account ────────────────────────────────────────────────────────
  balance: number;
  positions: Position[];
  history: ClosedTrade[];

  // ── Actions ────────────────────────────────────────────────────────
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: TimeframeCode) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  /** Advance replay by one bar of the current timeframe. */
  stepForward: () => void;
  /** Internal play-loop tick; advances one play step. */
  tick: () => void;
  /** Restart the current symbol's replay from the beginning of the session. */
  restartSession: () => void;

  openPosition: (
    side: Side,
    lots: number,
    sl: number | null,
    tp: number | null,
  ) => void;
  closePosition: (id: string) => void;
  closeAll: () => void;
  modifyPosition: (id: string, sl: number | null, tp: number | null) => void;
  resetAccount: () => void;

  // ── Selectors ──────────────────────────────────────────────────────
  baseCandles: () => Candle[];
  playhead: () => number;
  currentPrice: () => number;
  currentTime: () => number;
  atEnd: () => boolean;
  derived: () => DerivedAccount;
}

function initialPlayhead(symbol: string): number {
  const total = getBaseCandles(getInstrument(symbol)).length;
  return Math.max(0, total - FORWARD_BARS_M1);
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `pos-${Date.now().toString(36)}-${idCounter}`;
}

export const useStore = create<StoreState>((set, get) => ({
  symbol: 'EURUSD',
  timeframe: 'M15',
  playheads: { EURUSD: initialPlayhead('EURUSD') },
  playing: false,
  speed: 1,

  balance: STARTING_BALANCE,
  positions: [],
  history: [],

  setSymbol: (symbol) => {
    const state = get();
    if (symbol === state.symbol) return;
    const playheads = { ...state.playheads };
    if (playheads[symbol] == null) playheads[symbol] = initialPlayhead(symbol);
    set({ symbol, playheads, playing: false });
  },

  setTimeframe: (tf) => set({ timeframe: tf }),

  play: () => {
    if (get().atEnd()) return;
    set({ playing: true });
  },
  pause: () => set({ playing: false }),
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),

  stepForward: () => {
    const { timeframe } = get();
    advance(get, set, TIMEFRAME_MAP[timeframe].minutes);
  },

  tick: () => {
    const { timeframe, atEnd } = get();
    if (atEnd()) {
      set({ playing: false });
      return;
    }
    advance(get, set, TIMEFRAME_MAP[timeframe].minutes);
  },

  restartSession: () => {
    const { symbol, positions } = get();
    set({
      playheads: { ...get().playheads, [symbol]: initialPlayhead(symbol) },
      playing: false,
      // Positions on this symbol are abandoned when the session restarts.
      positions: positions.filter((p) => p.symbol !== symbol),
    });
  },

  openPosition: (side, lots, sl, tp) => {
    const { symbol, currentPrice, currentTime, positions } = get();
    const price = currentPrice();
    const pos: Position = {
      id: nextId(),
      symbol,
      side,
      lots,
      entryPrice: price,
      entryTime: currentTime(),
      sl,
      tp,
    };
    set({ positions: [...positions, pos] });
  },

  closePosition: (id) => {
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;
    const instrument = getInstrument(pos.symbol);
    const price = priceForSymbol(state, pos.symbol);
    const time = timeForSymbol(state, pos.symbol);
    const pnl = profit(pos.side, pos.entryPrice, price, pos.lots, instrument);
    const closed: ClosedTrade = {
      ...pos,
      exitPrice: price,
      exitTime: time,
      reason: 'manual',
      pnl,
      pips: pipsGained(pos.side, pos.entryPrice, price, instrument),
    };
    set({
      positions: state.positions.filter((p) => p.id !== id),
      history: [closed, ...state.history],
      balance: state.balance + pnl,
    });
  },

  closeAll: () => {
    const ids = get().positions.map((p) => p.id);
    ids.forEach((id) => get().closePosition(id));
  },

  modifyPosition: (id, sl, tp) => {
    set({
      positions: get().positions.map((p) =>
        p.id === id ? { ...p, sl, tp } : p,
      ),
    });
  },

  resetAccount: () =>
    set({ balance: STARTING_BALANCE, positions: [], history: [] }),

  // ── Selectors ──────────────────────────────────────────────────────
  baseCandles: () => getBaseCandles(getInstrument(get().symbol)),
  playhead: () => {
    const { symbol, playheads } = get();
    return playheads[symbol] ?? 0;
  },
  currentPrice: () => {
    const candles = get().baseCandles();
    return candles[get().playhead()].close;
  },
  currentTime: () => {
    const candles = get().baseCandles();
    return candles[get().playhead()].time;
  },
  atEnd: () => get().playhead() >= get().baseCandles().length - 1,

  derived: () => {
    const state = get();
    let floatingPnl = 0;
    let usedMargin = 0;
    for (const pos of state.positions) {
      const instrument = getInstrument(pos.symbol);
      const price = priceForSymbol(state, pos.symbol);
      floatingPnl += profit(pos.side, pos.entryPrice, price, pos.lots, instrument);
      usedMargin += requiredMargin(price, pos.lots, instrument);
    }
    const equity = state.balance + floatingPnl;
    const freeMargin = equity - usedMargin;
    const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;
    return { floatingPnl, equity, usedMargin, freeMargin, marginLevel };
  },
}));

// ── Helpers operating on a snapshot of the store ─────────────────────────

function priceForSymbol(state: StoreState, symbol: string): number {
  const candles = getBaseCandles(getInstrument(symbol));
  const idx = state.playheads[symbol] ?? candles.length - 1;
  return candles[Math.min(idx, candles.length - 1)].close;
}

function timeForSymbol(state: StoreState, symbol: string): number {
  const candles = getBaseCandles(getInstrument(symbol));
  const idx = state.playheads[symbol] ?? candles.length - 1;
  return candles[Math.min(idx, candles.length - 1)].time;
}

/**
 * Advance the active symbol's playhead by `steps` base (1-minute) candles.
 * Every intermediate candle is inspected so stop-loss / take-profit fills are
 * detected at bar-level granularity, and triggered positions are booked into
 * history with the correct realised P&L.
 */
function advance(
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  steps: number,
): void {
  const state = get();
  const { symbol } = state;
  const candles = getBaseCandles(getInstrument(symbol));
  const start = state.playheads[symbol] ?? 0;
  const end = Math.min(start + steps, candles.length - 1);
  if (end <= start) {
    set({ playing: false });
    return;
  }

  let positions = state.positions;
  let history = state.history;
  let balance = state.balance;
  const instrument = getInstrument(symbol);

  for (let i = start + 1; i <= end; i++) {
    const candle = candles[i];
    const remaining: Position[] = [];
    for (const pos of positions) {
      if (pos.symbol !== symbol) {
        remaining.push(pos);
        continue;
      }
      const fill = detectStopFill(pos, candle.high, candle.low);
      if (fill) {
        const pnl = profit(pos.side, pos.entryPrice, fill.price, pos.lots, instrument);
        const closed: ClosedTrade = {
          ...pos,
          exitPrice: fill.price,
          exitTime: candle.time,
          reason: fill.reason,
          pnl,
          pips: pipsGained(pos.side, pos.entryPrice, fill.price, instrument),
        };
        history = [closed, ...history];
        balance += pnl;
      } else {
        remaining.push(pos);
      }
    }
    positions = remaining;
  }

  set({
    playheads: { ...state.playheads, [symbol]: end },
    positions,
    history,
    balance,
    playing: end >= candles.length - 1 ? false : state.playing,
  });
}
