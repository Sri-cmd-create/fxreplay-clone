import { create } from 'zustand';
import type {
  Candle,
  ClosedTrade,
  Drawing,
  DrawingTool,
  PendingOrder,
  Position,
  Side,
  TimeframeCode,
} from '../types';
import { getBaseCandles } from '../lib/data';
import { getInstrument, TIMEFRAME_MAP } from '../lib/instruments';
import {
  detectPendingTrigger,
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
  pendingOrders: PendingOrder[];
  history: ClosedTrade[];

  // ── Drawings ───────────────────────────────────────────────────────
  activeTool: DrawingTool;
  drawingColor: string;
  drawings: Drawing[];
  selectedDrawingId: string | null;

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
  placePendingOrder: (
    side: Side,
    type: 'limit' | 'stop',
    lots: number,
    price: number,
    sl: number | null,
    tp: number | null,
  ) => void;
  cancelOrder: (id: string) => void;
  cancelAllPending: () => void;
  resetAccount: () => void;

  // ── Drawing actions ────────────────────────────────────────────────
  setActiveTool: (tool: DrawingTool) => void;
  setDrawingColor: (color: string) => void;
  addDrawing: (drawing: Omit<Drawing, 'id' | 'symbol'>) => void;
  removeDrawing: (id: string) => void;
  selectDrawing: (id: string | null) => void;
  clearDrawings: () => void;

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
function nextId(prefix = 'pos'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Default palette for new drawings. */
export const DRAWING_COLORS = [
  '#2962ff',
  '#f0b90b',
  '#26a69a',
  '#ef5350',
  '#ab47bc',
  '#d1d4dc',
];

// ── Persistence ──────────────────────────────────────────────────────────
// The session (account, trades, orders, drawings and replay position) is saved
// to localStorage so a browser refresh resumes exactly where you left off.

const PERSIST_KEY = 'fxreplay:session:v1';

/** The subset of store state that is persisted between sessions. */
type PersistedState = Pick<
  StoreState,
  | 'symbol'
  | 'timeframe'
  | 'playheads'
  | 'speed'
  | 'balance'
  | 'positions'
  | 'pendingOrders'
  | 'history'
  | 'drawings'
  | 'drawingColor'
>;

const hasStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function loadPersisted(): Partial<PersistedState> {
  if (!hasStorage) return {};
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
  } catch {
    return {};
  }
}

const saved = loadPersisted();

export const useStore = create<StoreState>((set, get) => ({
  symbol: saved.symbol ?? 'EURUSD',
  timeframe: saved.timeframe ?? 'M15',
  playheads: saved.playheads ?? { EURUSD: initialPlayhead('EURUSD') },
  playing: false,
  speed: saved.speed ?? 1,

  balance: saved.balance ?? STARTING_BALANCE,
  positions: saved.positions ?? [],
  pendingOrders: saved.pendingOrders ?? [],
  history: saved.history ?? [],

  activeTool: 'cursor',
  drawingColor: saved.drawingColor ?? DRAWING_COLORS[0],
  drawings: saved.drawings ?? [],
  selectedDrawingId: null,

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
    const { symbol, positions, pendingOrders } = get();
    set({
      playheads: { ...get().playheads, [symbol]: initialPlayhead(symbol) },
      playing: false,
      // Positions and resting orders on this symbol are abandoned on restart.
      positions: positions.filter((p) => p.symbol !== symbol),
      pendingOrders: pendingOrders.filter((o) => o.symbol !== symbol),
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

  placePendingOrder: (side, type, lots, price, sl, tp) => {
    const { symbol, currentTime, pendingOrders } = get();
    const order: PendingOrder = {
      id: nextId('ord'),
      symbol,
      side,
      type,
      lots,
      price,
      sl,
      tp,
      createdTime: currentTime(),
    };
    set({ pendingOrders: [...pendingOrders, order] });
  },

  cancelOrder: (id) =>
    set({ pendingOrders: get().pendingOrders.filter((o) => o.id !== id) }),

  cancelAllPending: () => set({ pendingOrders: [] }),

  resetAccount: () =>
    set({
      balance: STARTING_BALANCE,
      positions: [],
      pendingOrders: [],
      history: [],
    }),

  // ── Drawing actions ────────────────────────────────────────────────
  setActiveTool: (tool) =>
    set({ activeTool: tool, selectedDrawingId: null }),
  setDrawingColor: (color) => set({ drawingColor: color }),
  addDrawing: (drawing) =>
    set({
      drawings: [
        ...get().drawings,
        { ...drawing, id: nextId('draw'), symbol: get().symbol },
      ],
    }),
  removeDrawing: (id) =>
    set({
      drawings: get().drawings.filter((d) => d.id !== id),
      selectedDrawingId:
        get().selectedDrawingId === id ? null : get().selectedDrawingId,
    }),
  selectDrawing: (id) => set({ selectedDrawingId: id }),
  clearDrawings: () => {
    const { symbol, drawings } = get();
    set({
      drawings: drawings.filter((d) => d.symbol !== symbol),
      selectedDrawingId: null,
    });
  },

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

// ── Persist on every change ──────────────────────────────────────────────
if (hasStorage) {
  const persist = (state: StoreState) => {
    try {
      const snapshot: PersistedState = {
        symbol: state.symbol,
        timeframe: state.timeframe,
        playheads: state.playheads,
        speed: state.speed,
        balance: state.balance,
        positions: state.positions,
        pendingOrders: state.pendingOrders,
        history: state.history,
        drawings: state.drawings,
        drawingColor: state.drawingColor,
      };
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage full or unavailable — ignore */
    }
  };
  useStore.subscribe(persist);
}

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
  let pendingOrders = state.pendingOrders;
  let history = state.history;
  let balance = state.balance;
  const instrument = getInstrument(symbol);

  for (let i = start + 1; i <= end; i++) {
    const candle = candles[i];

    // 1. Trigger any resting pending orders touched by this candle. A filled
    //    order becomes an open position at its trigger price.
    if (pendingOrders.some((o) => o.symbol === symbol)) {
      const stillPending: PendingOrder[] = [];
      for (const order of pendingOrders) {
        if (order.symbol !== symbol) {
          stillPending.push(order);
          continue;
        }
        const fillPrice = detectPendingTrigger(order, candle.high, candle.low);
        if (fillPrice != null) {
          positions = [
            ...positions,
            {
              id: nextId(),
              symbol: order.symbol,
              side: order.side,
              lots: order.lots,
              entryPrice: fillPrice,
              entryTime: candle.time,
              sl: order.sl,
              tp: order.tp,
            },
          ];
        } else {
          stillPending.push(order);
        }
      }
      pendingOrders = stillPending;
    }

    // 2. Check SL/TP on all open positions (including any just filled above).
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
    pendingOrders,
    history,
    balance,
    playing: end >= candles.length - 1 ? false : state.playing,
  });
}
