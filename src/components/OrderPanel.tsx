import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getInstrument } from '../lib/instruments';
import { formatMoney, formatPrice } from '../lib/format';
import { pipValue, requiredMargin } from '../lib/trading';

const LOT_PRESETS = [0.01, 0.1, 0.5, 1];

export function OrderPanel() {
  const symbol = useStore((s) => s.symbol);
  const currentPrice = useStore((s) => {
    void s.playheads[s.symbol];
    return s.currentPrice();
  });
  const freeMargin = useStore((s) => s.derived().freeMargin);
  const openPosition = useStore((s) => s.openPosition);

  const instrument = getInstrument(symbol);

  const [lots, setLots] = useState(0.1);
  const [useSl, setUseSl] = useState(true);
  const [useTp, setUseTp] = useState(true);
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState(40);

  const perPip = pipValue(lots, instrument);
  const margin = requiredMargin(currentPrice, lots, instrument);
  const risk = useSl ? perPip * slPips : 0;
  const reward = useTp ? perPip * tpPips : 0;
  const rr = risk > 0 && reward > 0 ? reward / risk : 0;
  const insufficient = margin > freeMargin;

  const submit = (side: 'buy' | 'sell') => {
    if (insufficient) return;
    const distance = (pips: number) => pips * instrument.pipSize;
    let sl: number | null = null;
    let tp: number | null = null;
    if (useSl && slPips > 0) {
      sl = side === 'buy'
        ? currentPrice - distance(slPips)
        : currentPrice + distance(slPips);
    }
    if (useTp && tpPips > 0) {
      tp = side === 'buy'
        ? currentPrice + distance(tpPips)
        : currentPrice - distance(tpPips);
    }
    openPosition(side, lots, sl, tp);
  };

  const clampLots = (v: number) => Math.max(0.01, Math.round(v * 100) / 100);

  return (
    <div className="flex flex-col gap-3 border-b border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Order Ticket
        </span>
        <span className="font-mono text-sm font-semibold text-white">
          {formatPrice(currentPrice, instrument.digits)}
        </span>
      </div>

      {/* Lot size */}
      <div>
        <label className="mb-1 block text-[11px] text-muted">Volume (lots)</label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLots((v) => clampLots(v - 0.01))}
            className="h-8 w-8 rounded bg-panel-alt text-lg text-muted hover:bg-panel-hover hover:text-white"
          >
            −
          </button>
          <input
            type="number"
            step={0.01}
            min={0.01}
            value={lots}
            onChange={(e) => setLots(clampLots(Number(e.target.value) || 0.01))}
            className="h-8 w-full rounded bg-panel-alt px-2 text-center font-mono text-sm text-white outline-none ring-1 ring-border focus:ring-accent"
          />
          <button
            onClick={() => setLots((v) => clampLots(v + 0.01))}
            className="h-8 w-8 rounded bg-panel-alt text-lg text-muted hover:bg-panel-hover hover:text-white"
          >
            +
          </button>
        </div>
        <div className="mt-1 flex gap-1">
          {LOT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setLots(p)}
              className={`flex-1 rounded px-1 py-0.5 text-[11px] ${
                lots === p
                  ? 'bg-accent text-white'
                  : 'bg-panel-alt text-muted hover:bg-panel-hover hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2">
        <StopField
          label="Stop Loss"
          enabled={useSl}
          onToggle={() => setUseSl((v) => !v)}
          value={slPips}
          onChange={setSlPips}
          accent="down"
        />
        <StopField
          label="Take Profit"
          enabled={useTp}
          onToggle={() => setUseTp((v) => !v)}
          value={tpPips}
          onChange={setTpPips}
          accent="up"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Info label="Pip value" value={formatMoney(perPip)} />
        <Info label="Margin" value={formatMoney(margin)} />
        <Info label="Risk" value={useSl ? formatMoney(risk) : '—'} tone="down" />
        <Info label="Reward" value={useTp ? formatMoney(reward) : '—'} tone="up" />
        <Info label="R:R" value={rr > 0 ? `1 : ${rr.toFixed(2)}` : '—'} />
      </div>

      {insufficient && (
        <p className="text-center text-[11px] text-down">
          Insufficient free margin for this volume.
        </p>
      )}

      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => submit('sell')}
          disabled={insufficient}
          className="rounded bg-down py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          SELL
        </button>
        <button
          onClick={() => submit('buy')}
          disabled={insufficient}
          className="rounded bg-up py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          BUY
        </button>
      </div>
    </div>
  );
}

function StopField({
  label,
  enabled,
  onToggle,
  value,
  onChange,
  accent,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  value: number;
  onChange: (v: number) => void;
  accent: 'up' | 'down';
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[11px] text-muted">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="h-3 w-3 accent-accent"
        />
        {label}
      </label>
      <div className="flex items-center">
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          disabled={!enabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className={`h-8 w-full rounded-l bg-panel-alt px-2 text-center font-mono text-sm text-white outline-none ring-1 ring-border focus:ring-accent disabled:opacity-40 ${
            accent === 'up' ? 'focus:ring-up' : 'focus:ring-down'
          }`}
        />
        <span className="flex h-8 items-center rounded-r bg-panel-hover px-2 text-[10px] text-muted">
          pips
        </span>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'up' | 'down';
}) {
  const color =
    tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-white';
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}
