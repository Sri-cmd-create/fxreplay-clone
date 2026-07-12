import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getBaseCandles } from '../lib/data';
import { getInstrument } from '../lib/instruments';
import { formatMoney, formatPrice, formatSignedNumber } from '../lib/format';
import { pipsGained, profit } from '../lib/trading';
import type { Position } from '../types';
import { CloseIcon } from './icons';

export function PositionsPanel() {
  const positions = useStore((s) => s.positions);
  const playheads = useStore((s) => s.playheads);
  const closePosition = useStore((s) => s.closePosition);
  const closePartial = useStore((s) => s.closePartial);
  const closeAll = useStore((s) => s.closeAll);

  const priceOf = (symbol: string) => {
    const candles = getBaseCandles(getInstrument(symbol));
    const idx = Math.min(playheads[symbol] ?? candles.length - 1, candles.length - 1);
    return candles[idx].close;
  };

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No open positions. Place an order to get started.
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
            <Th className="text-right">Price</Th>
            <Th className="text-right">SL</Th>
            <Th className="text-right">TP</Th>
            <Th className="text-right">Pips</Th>
            <Th className="text-right">P&L</Th>
            <Th className="text-right">
              <button
                onClick={closeAll}
                className="rounded bg-panel-hover px-2 py-0.5 text-[10px] font-medium text-white hover:bg-down"
              >
                Close all
              </button>
            </Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const instrument = getInstrument(pos.symbol);
            const price = priceOf(pos.symbol);
            const pnl = profit(pos.side, pos.entryPrice, price, pos.lots, instrument);
            const pips = pipsGained(pos.side, pos.entryPrice, price, instrument);
            const tone = pnl >= 0 ? 'text-up' : 'text-down';
            return (
              <tr key={pos.id} className="border-b border-border/60 hover:bg-panel-hover/40">
                <Td className="font-semibold text-white">{pos.symbol}</Td>
                <Td>
                  <span className={pos.side === 'buy' ? 'text-up' : 'text-down'}>
                    {pos.side.toUpperCase()}
                  </span>
                </Td>
                <Td className="text-right font-mono">{pos.lots}</Td>
                <Td className="text-right font-mono">
                  {formatPrice(pos.entryPrice, instrument.digits)}
                </Td>
                <Td className="text-right font-mono">
                  {formatPrice(price, instrument.digits)}
                </Td>
                <Td className="text-right">
                  <EditableStop pos={pos} field="sl" digits={instrument.digits} />
                </Td>
                <Td className="text-right">
                  <EditableStop pos={pos} field="tp" digits={instrument.digits} />
                </Td>
                <Td className={`text-right font-mono ${tone}`}>
                  {formatSignedNumber(pips, 1)}
                </Td>
                <Td className={`text-right font-mono font-semibold ${tone}`}>
                  {formatMoney(pnl, true)}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Close half"
                      onClick={() =>
                        closePartial(pos.id, Math.floor((pos.lots / 2) * 100) / 100)
                      }
                      className="rounded bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-accent"
                    >
                      ½
                    </button>
                    <button
                      title="Close position"
                      onClick={() => closePosition(pos.id)}
                      className="rounded p-1 text-muted hover:bg-down hover:text-white"
                    >
                      <CloseIcon width={12} height={12} />
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Inline-editable stop-loss / take-profit cell. */
function EditableStop({
  pos,
  field,
  digits,
}: {
  pos: Position;
  field: 'sl' | 'tp';
  digits: number;
}) {
  const modifyPosition = useStore((s) => s.modifyPosition);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const current = pos[field];
  const color = field === 'sl' ? 'text-down' : 'text-up';

  const begin = () => {
    setVal(current != null ? String(current) : '');
    setEditing(true);
  };
  const commit = () => {
    const trimmed = val.trim();
    const num = trimmed === '' ? null : Number(trimmed);
    const value = num != null && Number.isFinite(num) && num > 0 ? num : null;
    modifyPosition(
      pos.id,
      field === 'sl' ? value : pos.sl,
      field === 'tp' ? value : pos.tp,
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step={Math.pow(10, -digits)}
        value={val}
        placeholder="—"
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        className="h-6 w-20 rounded bg-panel-alt px-1 text-right font-mono text-xs text-white outline-none ring-1 ring-accent"
      />
    );
  }
  return (
    <button
      onClick={begin}
      title="Click to edit"
      className={`font-mono ${color} hover:underline`}
    >
      {current != null ? formatPrice(current, digits) : '—'}
    </button>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
