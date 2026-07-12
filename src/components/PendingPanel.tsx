import { useStore } from '../store/useStore';
import { getBaseCandles } from '../lib/data';
import { getInstrument } from '../lib/instruments';
import { formatPrice, formatSignedNumber, formatTime } from '../lib/format';
import { CloseIcon } from './icons';

export function PendingPanel() {
  const pendingOrders = useStore((s) => s.pendingOrders);
  const playheads = useStore((s) => s.playheads);
  const cancelOrder = useStore((s) => s.cancelOrder);
  const cancelAllPending = useStore((s) => s.cancelAllPending);

  const priceOf = (symbol: string) => {
    const candles = getBaseCandles(getInstrument(symbol));
    const idx = Math.min(playheads[symbol] ?? candles.length - 1, candles.length - 1);
    return candles[idx].close;
  };

  if (pendingOrders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No pending orders. Use the Limit or Stop order type to place one.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-panel-alt text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <Th>Symbol</Th>
            <Th>Order</Th>
            <Th className="text-right">Lots</Th>
            <Th className="text-right">Trigger</Th>
            <Th className="text-right">Market</Th>
            <Th className="text-right">Distance</Th>
            <Th className="text-right">SL</Th>
            <Th className="text-right">TP</Th>
            <Th>Placed</Th>
            <Th className="text-right">
              <button
                onClick={cancelAllPending}
                className="rounded bg-panel-hover px-2 py-0.5 text-[10px] font-medium text-white hover:bg-down"
              >
                Cancel all
              </button>
            </Th>
          </tr>
        </thead>
        <tbody>
          {pendingOrders.map((o) => {
            const instrument = getInstrument(o.symbol);
            const market = priceOf(o.symbol);
            const isBuy = o.side === 'buy';
            const distPips = (o.price - market) / instrument.pipSize;
            return (
              <tr key={o.id} className="border-b border-border/60 hover:bg-panel-hover/40">
                <Td className="font-semibold text-white">{o.symbol}</Td>
                <Td>
                  <span className={isBuy ? 'text-up' : 'text-down'}>
                    {o.side.toUpperCase()} {o.type.toUpperCase()}
                  </span>
                </Td>
                <Td className="text-right font-mono">{o.lots}</Td>
                <Td className="text-right font-mono text-white">
                  {formatPrice(o.price, instrument.digits)}
                </Td>
                <Td className="text-right font-mono text-muted">
                  {formatPrice(market, instrument.digits)}
                </Td>
                <Td className="text-right font-mono text-muted">
                  {formatSignedNumber(distPips, 1)}
                </Td>
                <Td className="text-right font-mono text-down">
                  {o.sl != null ? formatPrice(o.sl, instrument.digits) : '—'}
                </Td>
                <Td className="text-right font-mono text-up">
                  {o.tp != null ? formatPrice(o.tp, instrument.digits) : '—'}
                </Td>
                <Td className="font-mono text-muted">{formatTime(o.createdTime)}</Td>
                <Td className="text-right">
                  <button
                    title="Cancel order"
                    onClick={() => cancelOrder(o.id)}
                    className="rounded p-1 text-muted hover:bg-down hover:text-white"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
