import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getBaseCandles } from '../lib/data';
import { getInstrument } from '../lib/instruments';
import { formatPrice, formatSignedNumber, formatTime } from '../lib/format';
import { CloseIcon } from './icons';

export function AlertsPanel() {
  const symbol = useStore((s) => s.symbol);
  const alerts = useStore((s) => s.alerts);
  const playheads = useStore((s) => s.playheads);
  const addAlert = useStore((s) => s.addAlert);
  const removeAlert = useStore((s) => s.removeAlert);
  const clearAlerts = useStore((s) => s.clearAlerts);
  const currentPrice = useStore((s) => {
    void s.playheads[s.symbol];
    return s.currentPrice();
  });

  const instrument = getInstrument(symbol);
  const [priceInput, setPriceInput] = useState('');

  const priceOf = (sym: string) => {
    const candles = getBaseCandles(getInstrument(sym));
    const idx = Math.min(playheads[sym] ?? candles.length - 1, candles.length - 1);
    return candles[idx].close;
  };

  const add = () => {
    const n = Number(priceInput);
    const price = Number.isFinite(n) && n > 0 ? n : currentPrice;
    addAlert(Number(price.toFixed(instrument.digits)));
    setPriceInput('');
  };

  const hasTriggered = alerts.some((a) => a.triggered);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="text-[11px] text-muted">Add alert @</span>
        <input
          type="number"
          value={priceInput}
          placeholder={formatPrice(currentPrice, instrument.digits)}
          onChange={(e) => setPriceInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          className="h-7 w-28 rounded bg-panel-alt px-2 text-right font-mono text-xs text-white outline-none ring-1 ring-border focus:ring-accent"
        />
        <button
          onClick={add}
          className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-white hover:brightness-110"
        >
          Add {symbol}
        </button>
        {hasTriggered && (
          <button
            onClick={clearAlerts}
            className="ml-auto rounded bg-panel-alt px-2 py-1 text-[10px] font-medium text-muted hover:bg-panel-hover hover:text-white"
          >
            Clear triggered
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          No alerts. Add one above, then drag its line on the chart to fine-tune.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-panel-alt text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <Th>Symbol</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Distance</Th>
                <Th>Status</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const inst = getInstrument(a.symbol);
                const mkt = priceOf(a.symbol);
                const distPips = (a.price - mkt) / inst.pipSize;
                return (
                  <tr key={a.id} className="border-b border-border/60 hover:bg-panel-hover/40">
                    <Td className="font-semibold text-white">{a.symbol}</Td>
                    <Td className="text-right font-mono text-[#f0b90b]">
                      {formatPrice(a.price, inst.digits)}
                    </Td>
                    <Td className="text-right font-mono text-muted">
                      {a.triggered ? '—' : `${formatSignedNumber(distPips, 1)} pips`}
                    </Td>
                    <Td>
                      {a.triggered ? (
                        <span className="text-up">
                          Triggered · {a.triggeredTime != null ? formatTime(a.triggeredTime) : ''}
                        </span>
                      ) : (
                        <span className="text-[#f0b90b]">Armed</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <button
                        title="Delete alert"
                        onClick={() => removeAlert(a.id)}
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
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
