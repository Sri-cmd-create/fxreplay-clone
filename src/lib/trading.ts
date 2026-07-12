import type {
  AccountStats,
  ClosedTrade,
  Instrument,
  PendingOrder,
  Position,
  Side,
} from '../types';

/** Directional multiplier: +1 for a long, -1 for a short. */
export function dir(side: Side): 1 | -1 {
  return side === 'buy' ? 1 : -1;
}

/**
 * Floating/realised profit in the account currency (USD).
 *
 * Because every instrument here is USD-quoted, profit is simply the price
 * delta times position size in units of the base asset.
 */
export function profit(
  side: Side,
  entry: number,
  price: number,
  lots: number,
  instrument: Instrument,
): number {
  return (price - entry) * dir(side) * lots * instrument.contractSize;
}

/** Signed distance in pips, positive when the move favours the position. */
export function pipsGained(
  side: Side,
  entry: number,
  price: number,
  instrument: Instrument,
): number {
  return ((price - entry) * dir(side)) / instrument.pipSize;
}

/** Monetary value of a single pip for a given lot size (USD). */
export function pipValue(lots: number, instrument: Instrument): number {
  return lots * instrument.contractSize * instrument.pipSize;
}

/** Margin required to hold a position, in the account currency (USD). */
export function requiredMargin(
  price: number,
  lots: number,
  instrument: Instrument,
): number {
  return (lots * instrument.contractSize * price) / instrument.leverage;
}

/**
 * Given a candle's high/low range and a position, determine whether the SL or
 * TP was hit while that candle formed. When both could be touched within the
 * same candle we conservatively assume the stop-loss triggered first (the
 * standard pessimistic backtesting assumption).
 */
export function detectStopFill(
  pos: Position,
  high: number,
  low: number,
): { price: number; reason: 'sl' | 'tp' } | null {
  if (pos.side === 'buy') {
    const slHit = pos.sl != null && low <= pos.sl;
    const tpHit = pos.tp != null && high >= pos.tp;
    if (slHit) return { price: pos.sl as number, reason: 'sl' };
    if (tpHit) return { price: pos.tp as number, reason: 'tp' };
  } else {
    const slHit = pos.sl != null && high >= pos.sl;
    const tpHit = pos.tp != null && low <= pos.tp;
    if (slHit) return { price: pos.sl as number, reason: 'sl' };
    if (tpHit) return { price: pos.tp as number, reason: 'tp' };
  }
  return null;
}

/**
 * Determine whether a pending order's trigger price was touched by a candle's
 * range. Returns the fill price (the trigger price — slippage is ignored) when
 * triggered, otherwise null.
 *
 *  - buy limit:  fills when price falls to/through the trigger (low <= price)
 *  - sell limit: fills when price rises to/through the trigger (high >= price)
 *  - buy stop:   fills when price rises to/through the trigger (high >= price)
 *  - sell stop:  fills when price falls to/through the trigger (low <= price)
 */
export function detectPendingTrigger(
  order: PendingOrder,
  high: number,
  low: number,
): number | null {
  const risesTo = high >= order.price;
  const fallsTo = low <= order.price;
  if (order.side === 'buy') {
    if (order.type === 'limit' && fallsTo) return order.price;
    if (order.type === 'stop' && risesTo) return order.price;
  } else {
    if (order.type === 'limit' && risesTo) return order.price;
    if (order.type === 'stop' && fallsTo) return order.price;
  }
  return null;
}

/**
 * Validate that a pending order's trigger price sits on the correct side of the
 * current market price for its side/type. Returns null when valid, or a short
 * human-readable reason when not.
 */
export function validatePendingPrice(
  side: Side,
  type: 'limit' | 'stop',
  price: number,
  currentPrice: number,
): string | null {
  const below = price < currentPrice;
  const above = price > currentPrice;
  if (price === currentPrice) return 'Trigger must differ from current price';
  if (side === 'buy' && type === 'limit' && !below)
    return 'Buy limit must be below the market';
  if (side === 'buy' && type === 'stop' && !above)
    return 'Buy stop must be above the market';
  if (side === 'sell' && type === 'limit' && !above)
    return 'Sell limit must be above the market';
  if (side === 'sell' && type === 'stop' && !below)
    return 'Sell stop must be below the market';
  return null;
}

/** Compute journal statistics from a list of closed trades. */
export function computeStats(trades: ClosedTrade[]): AccountStats {
  const totalTrades = trades.length;
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bestTrade = 0;
  let worstTrade = 0;

  for (const t of trades) {
    if (t.pnl >= 0) {
      wins++;
      grossProfit += t.pnl;
    } else {
      losses++;
      grossLoss += t.pnl;
    }
    bestTrade = Math.max(bestTrade, t.pnl);
    worstTrade = Math.min(worstTrade, t.pnl);
  }

  const netPnl = grossProfit + grossLoss;

  // Max drawdown over the equity curve built from the trade sequence.
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const t of trades) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return {
    totalTrades,
    wins,
    losses,
    winRate: totalTrades ? (wins / totalTrades) * 100 : 0,
    grossProfit,
    grossLoss,
    profitFactor:
      grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : grossProfit > 0 ? Infinity : 0,
    netPnl,
    avgWin: wins ? grossProfit / wins : 0,
    avgLoss: losses ? grossLoss / losses : 0,
    bestTrade,
    worstTrade,
    maxDrawdown,
  };
}
