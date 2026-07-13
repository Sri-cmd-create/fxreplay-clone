import { useStore } from '../store/useStore';
import { INSTRUMENTS } from '../lib/instruments';
import { getBaseCandles } from '../lib/data';
import { formatPrice, formatSignedNumber } from '../lib/format';

/**
 * Compact watchlist showing all instruments with live price, change since
 * session start, and one-click symbol switch.
 */
export function Watchlist() {
  const activeSymbol = useStore((s) => s.symbol);
  const setSymbol = useStore((s) => s.setSymbol);
  const playheads = useStore((s) => s.playheads);

  return (
    <div className="flex flex-col border-b border-border bg-panel">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Watchlist
      </div>
      {INSTRUMENTS.map((inst) => {
        const sym = inst.symbol;
        const candles = getBaseCandles(inst);
        const idx = playheads[sym] ?? 0;
        const price = candles[Math.min(idx, candles.length - 1)].close;
        // Calculate change from the first revealed candle in this session.
        const startPrice = candles[0].close;
        const changePips = (price - startPrice) / inst.pipSize;
        const changePct = ((price - startPrice) / startPrice) * 100;
        const up = changePips >= 0;
        const active = sym === activeSymbol;

        return (
          <button
            key={sym}
            onClick={() => setSymbol(sym)}
            className={`flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
              active
                ? 'bg-panel-hover/60 border-l-2 border-accent'
                : 'border-l-2 border-transparent hover:bg-panel-hover/40'
            }`}
          >
            <div className="flex flex-col">
              <span
                className={`text-xs font-semibold ${
                  active ? 'text-white' : 'text-muted'
                }`}
              >
                {sym}
              </span>
              <span className="text-[10px] text-muted">{inst.name}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-xs text-white">
                {formatPrice(price, inst.digits)}
              </span>
              <span
                className={`font-mono text-[10px] ${
                  up ? 'text-up' : 'text-down'
                }`}
              >
                {formatSignedNumber(changePips, 0)}p · {changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
