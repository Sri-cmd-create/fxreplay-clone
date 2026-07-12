import type {
  AccountStats,
  ClosedTrade,
  Instrument,
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
