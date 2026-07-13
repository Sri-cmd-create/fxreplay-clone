/**
 * Core domain types for the FX Replay clone.
 *
 * Prices/times use conventions compatible with `lightweight-charts`:
 *  - `time` is a UNIX timestamp in **seconds** (UTC).
 */

/** A single OHLC candle. */
export interface Candle {
  /** UNIX time in seconds (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Trade direction. */
export type Side = 'buy' | 'sell';

/** Supported chart timeframes, keyed by their canonical code. */
export type TimeframeCode =
  | 'M1'
  | 'M5'
  | 'M15'
  | 'M30'
  | 'H1'
  | 'H4'
  | 'D1';

export interface Timeframe {
  code: TimeframeCode;
  label: string;
  /** Duration of one bar, in minutes. */
  minutes: number;
}

/**
 * Instrument definition.
 *
 * To keep P&L math exact and account-currency-agnostic, every instrument is
 * quoted in USD (the account currency). Profit in USD is therefore simply
 * `(exit - entry) * direction * lots * contractSize`.
 */
export interface Instrument {
  symbol: string;
  name: string;
  /** Number of decimal places used to display the price. */
  digits: number;
  /** Price increment that equals one "pip". */
  pipSize: number;
  /** Units of the base asset per 1.00 lot. */
  contractSize: number;
  /** Approximate starting price used to seed synthetic data. */
  basePrice: number;
  /** Annualised volatility factor used by the data generator. */
  volatility: number;
  /** Leverage available for margin calculations (e.g. 100 => 1:100). */
  leverage: number;
}

/** Order execution style. */
export type OrderType = 'market' | 'limit' | 'stop';

/**
 * A resting pending order that fills automatically once price reaches its
 * trigger. Combined with `side`:
 *  - buy limit  → trigger below current price
 *  - sell limit → trigger above current price
 *  - buy stop   → trigger above current price
 *  - sell stop  → trigger below current price
 */
export interface PendingOrder {
  id: string;
  symbol: string;
  side: Side;
  /** 'limit' or 'stop' — market orders never rest as pending. */
  type: Exclude<OrderType, 'market'>;
  lots: number;
  /** Trigger (activation) price. */
  price: number;
  /** Stop-loss / take-profit that will attach to the position once filled. */
  sl: number | null;
  tp: number | null;
  /** UNIX seconds when the order was placed. */
  createdTime: number;
}

/** Why a position was closed. */
export type CloseReason = 'manual' | 'sl' | 'tp';

/** An open position in the account. */
export interface Position {
  id: string;
  symbol: string;
  side: Side;
  /** Size in lots. */
  lots: number;
  entryPrice: number;
  /** UNIX seconds when the position was opened. */
  entryTime: number;
  /** Optional stop-loss price. */
  sl: number | null;
  /** Optional take-profit price. */
  tp: number | null;
}

/** A closed trade recorded in the history/journal. */
export interface ClosedTrade extends Position {
  exitPrice: number;
  exitTime: number;
  reason: CloseReason;
  /** Realised profit/loss in account currency (USD). */
  pnl: number;
  /** Distance moved in pips (signed, in the trade's favour = positive). */
  pips: number;
}

/** Aggregate account statistics derived from closed trades. */
export interface AccountStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
}


// ── Chart drawings ─────────────────────────────────────────────────────

/** The currently selected charting tool. `cursor` = no drawing. */
export type DrawingTool =
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'rectangle'
  | 'fib'
  | 'measure';

/** A single anchor point in chart space (timeframe-independent). */
export interface Point {
  /** UNIX seconds (UTC). */
  time: number;
  price: number;
}

/** Concrete drawing kinds (everything except the cursor). */
export type DrawingType = Exclude<DrawingTool, 'cursor'>;

/**
 * A persisted chart drawing. Anchors are stored in (time, price) space so they
 * remain correct across timeframe changes and chart scrolling/zooming.
 *  - horizontal: 1 point (only `price` is used)
 *  - trendline / rectangle / fib: 2 points
 */
export interface Drawing {
  id: string;
  symbol: string;
  type: DrawingType;
  points: Point[];
  color: string;
}
