import { useStore } from '../store/useStore';
import { getInstrument } from '../lib/instruments';
import {
  formatMoney,
  formatPrice,
  formatSignedNumber,
  formatTime,
} from '../lib/format';
import type { CloseReason, ClosedTrade } from '../types';

const reasonLabel: Record<CloseReason, string> = {
  manual: 'Manual',
  sl: 'Stop Loss',
  tp: 'Take Profit',
};
const reasonTone: Record<CloseReason, string> = {
  manual: 'text-muted',
  sl: 'text-down',
  tp: 'text-up',
};

export function HistoryPanel() {
  const history = useStore((s) => s.history);

  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No closed trades yet. Your trade journal will appear here.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1">
        <span className="text-[11px] text-muted">
          {history.length} closed {history.length === 1 ? 'trade' : 'trades'}
        </span>
        <button
          onClick={() => exportCsv(history)}
          className="rounded bg-panel-alt px-2 py-0.5 text-[10px] font-medium text-white hover:bg-panel-hover"
        >
          Export CSV
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-panel-alt text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <Th>Symbol</Th>
            <Th>Side</Th>
            <Th className="text-right">Lots</Th>
            <Th className="text-right">Entry</Th>
            <Th className="text-right">Exit</Th>
            <Th>Closed</Th>
            <Th>Reason</Th>
            <Th className="text-right">Pips</Th>
            <Th className="text-right">P&L</Th>
          </tr>
        </thead>
        <tbody>
          {history.map((t) => {
            const instrument = getInstrument(t.symbol);
            const tone = t.pnl >= 0 ? 'text-up' : 'text-down';
            return (
              <tr key={t.id} className="border-b border-border/60 hover:bg-panel-hover/40">
                <Td className="font-semibold text-white">{t.symbol}</Td>
                <Td>
                  <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>
                    {t.side.toUpperCase()}
                  </span>
                </Td>
                <Td className="text-right font-mono">{t.lots}</Td>
                <Td className="text-right font-mono">
                  {formatPrice(t.entryPrice, instrument.digits)}
                </Td>
                <Td className="text-right font-mono">
                  {formatPrice(t.exitPrice, instrument.digits)}
                </Td>
                <Td className="font-mono text-muted">{formatTime(t.exitTime)}</Td>
                <Td className={reasonTone[t.reason]}>{reasonLabel[t.reason]}</Td>
                <Td className={`text-right font-mono ${tone}`}>
                  {formatSignedNumber(t.pips, 1)}
                </Td>
                <Td className={`text-right font-mono font-semibold ${tone}`}>
                  {formatMoney(t.pnl, true)}
                </Td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}

/** Export the trade journal (oldest-first) as a downloadable CSV file. */
function exportCsv(history: ClosedTrade[]) {
  const header = [
    'Symbol',
    'Side',
    'Lots',
    'Entry',
    'Exit',
    'Opened (UTC)',
    'Closed (UTC)',
    'Reason',
    'Pips',
    'PnL',
  ];
  const rows = [...history].reverse().map((t) => [
    t.symbol,
    t.side,
    t.lots,
    t.entryPrice,
    t.exitPrice,
    new Date(t.entryTime * 1000).toISOString(),
    new Date(t.exitTime * 1000).toISOString(),
    t.reason,
    t.pips.toFixed(1),
    t.pnl.toFixed(2),
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fxreplay-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
