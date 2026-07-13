import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getInstrument } from '../lib/instruments';
import { formatPrice } from '../lib/format';
import { BellIcon } from './icons';

interface Props {
  x: number;
  y: number;
  price: number;
  onClose: () => void;
}

/**
 * Right-click context menu on the chart: quick buy/sell at the current market
 * price using the order ticket's lot size, or set an alert at the clicked level.
 */
export function ChartContextMenu({ x, y, price, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const symbol = useStore((s) => s.symbol);
  const openPosition = useStore((s) => s.openPosition);
  const addAlert = useStore((s) => s.addAlert);
  const currentPrice = useStore((s) => {
    void s.playheads[s.symbol];
    return s.currentPrice();
  });
  const instrument = getInstrument(symbol);
  const roundedPrice = Number(price.toFixed(instrument.digits));

  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [onClose]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const buy = () => {
    openPosition('buy', 0.1, null, null);
    onClose();
  };
  const sell = () => {
    openPosition('sell', 0.1, null, null);
    onClose();
  };
  const alert = () => {
    addAlert(roundedPrice);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-panel-alt shadow-xl shadow-black/50"
      style={{ left: x, top: y }}
    >
      <div className="border-b border-border px-3 py-1.5 text-[10px] text-muted">
        {symbol} · market @ {formatPrice(currentPrice, instrument.digits)}
      </div>
      <button
        onClick={buy}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-up hover:bg-panel-hover"
      >
        <span className="h-2 w-2 rounded-full bg-up" />
        Buy at market
      </button>
      <button
        onClick={sell}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-down hover:bg-panel-hover"
      >
        <span className="h-2 w-2 rounded-full bg-down" />
        Sell at market
      </button>
      <div className="border-t border-border" />
      <button
        onClick={alert}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#f0b90b] hover:bg-panel-hover"
      >
        <BellIcon width={12} height={12} />
        Alert @ {formatPrice(roundedPrice, instrument.digits)}
      </button>
    </div>
  );
}
