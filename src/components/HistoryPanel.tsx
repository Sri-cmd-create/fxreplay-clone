import { useStore } from '../store/useStore';
import { getInstrument } from '../lib/instruments';
import {
  formatMoney,
  formatPrice,
  formatSignedNumber,
  formatTime,
} from '../lib/format';
import type { CloseReason } from '../types';

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
    <div className="h-full overflow-auto">
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
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
