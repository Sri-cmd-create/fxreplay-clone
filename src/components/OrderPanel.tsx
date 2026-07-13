import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getInstrument } from '../lib/instruments';
import { formatMoney, formatPrice } from '../lib/format';
import { pipValue, requiredMargin, validatePendingPrice } from '../lib/trading';
import type { OrderType, Side } from '../types';

const LOT_PRESETS = [0.01, 0.1, 0.5, 1];
const RISK_PRESETS = [0.5, 1, 2, 3];
const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
];

export function OrderPanel() {
  const symbol = useStore((s) => s.symbol);
  const currentPrice = useStore((s) => {
    void s.playheads[s.symbol];
    return s.currentPrice();
  });
  const freeMargin = useStore((s) => s.derived().freeMargin);
  const balance = useStore((s) => s.balance);
  const openPosition = useStore((s) => s.openPosition);
  const placePendingOrder = useStore((s) => s.placePendingOrder);

  const instrument = getInstrument(symbol);
  const roundP = (v: number) => {
    const f = Math.pow(10, instrument.digits);
    return Math.round(v * f) / f;
  };

  const [orderType, setOrderType] = useState<OrderType>('market');
  const [triggerPrice, setTriggerPrice] = useState(0);
  const [sizeMode, setSizeMode] = useState<'lots' | 'risk'>('lots');
  const [lots, setLots] = useState(0.1);
  const [riskPct, setRiskPct] = useState(1);
  const [useSl, setUseSl] = useState(true);
  const [useTp, setUseTp] = useState(true);
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState(40);

  // Seed the trigger price when switching to a pending type or changing symbol.
  useEffect(() => {
    if (orderType !== 'market') {
      setTriggerPrice(roundP(currentPrice - 10 * instrument.pipSize));
    }
    // Intentionally not reacting to live price ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, symbol]);

  const isPending = orderType !== 'market';
  const basePrice = isPending ? triggerPrice : currentPrice;

  // Position sizing
  let effectiveLots = lots;
  let sizingError: string | null = null;
  if (sizeMode === 'risk') {
    if (!useSl || slPips <= 0) {
      sizingError = 'Enable SL to size by risk';
      effectiveLots = 0;
    } else {
      const riskAmount = balance * (riskPct / 100);
      const riskPerLot = slPips * pipValue(1, instrument);
      effectiveLots = Math.max(0.01, Math.floor((riskAmount / riskPerLot) * 100) / 100);
    }
  }

  const perPip = pipValue(effectiveLots, instrument);
  const margin = requiredMargin(basePrice, effectiveLots, instrument);
  const risk = useSl ? perPip * slPips : 0;
  const reward = useTp ? perPip * tpPips : 0;
  const rr = risk > 0 && reward > 0 ? reward / risk : 0;
  const insufficient = margin > freeMargin;
  const blocked = insufficient || sizingError != null;

  const invalidFor = (side: Side): string | null =>
    isPending
      ? validatePendingPrice(side, orderType as 'limit' | 'stop', triggerPrice, currentPrice)
      : null;

  const computeStops = (side: Side) => {
    const distance = (pips: number) => pips * instrument.pipSize;
    let sl: number | null = null;
    let tp: number | null = null;
    if (useSl && slPips > 0) {
      sl = side === 'buy' ? basePrice - distance(slPips) : basePrice + distance(slPips);
    }
    if (useTp && tpPips > 0) {
      tp = side === 'buy' ? basePrice + distance(tpPips) : basePrice - distance(tpPips);
    }
    return { sl: sl != null ? roundP(sl) : null, tp: tp != null ? roundP(tp) : null };
  };

  const submit = (side: Side) => {
    if (blocked) return;
    const { sl, tp } = computeStops(side);
    if (isPending) {
      if (invalidFor(side)) return;
      placePendingOrder(side, orderType as 'limit' | 'stop', effectiveLots, roundP(triggerPrice), sl, tp);
    } else {
      openPosition(side, effectiveLots, sl, tp);
    }
  };

  const clampLots = (v: number) => Math.max(0.01, Math.round(v * 100) / 100);
  const clampRisk = (v: number) => Math.min(100, Math.max(0.1, Math.round(v * 100) / 100));
  const orderLabel = (side: Side) =>
    isPending ? `${side === 'buy' ? 'Buy' : 'Sell'} ${orderType}` : side.toUpperCase();

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Current price - prominent */}
      <div className="text-center">
        <div className="font-mono text-lg font-bold text-white">
          {formatPrice(currentPrice, instrument.digits)}
        </div>
        <div className="text-[10px] text-muted">{symbol}</div>
      </div>

      {/* Buy / Sell buttons - prominent at top */}
      <div className="grid grid-cols-2 gap-1.5">
        <OrderButton
          side="sell"
          label={orderLabel('sell')}
          invalidReason={invalidFor('sell')}
          disabled={blocked}
          onClick={() => submit('sell')}
        />
        <OrderButton
          side="buy"
          label={orderLabel('buy')}
          invalidReason={invalidFor('buy')}
          disabled={blocked}
          onClick={() => submit('buy')}
        />
      </div>

      {insufficient && (
        <p className="text-center text-[10px] text-down">Insufficient margin</p>
      )}
      {sizingError && (
        <p className="text-center text-[10px] text-muted">{sizingError}</p>
      )}

      {/* Order type */}
      <div className="flex items-center gap-px rounded bg-panel-alt p-px">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setOrderType(t.value)}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              orderType === t.value
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-panel-hover hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trigger price (pending only) */}
      {isPending && (
        <div>
          <label className="mb-0.5 block text-[10px] text-muted">Trigger price</label>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setTriggerPrice((v) => roundP(v - instrument.pipSize))}
              className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
            >
              -
            </button>
            <input
              type="number"
              step={instrument.pipSize}
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(Number(e.target.value) || 0)}
              className="h-6 w-full rounded bg-panel-alt px-1 text-center font-mono text-[11px] text-white outline-none ring-1 ring-border focus:ring-accent"
            />
            <button
              onClick={() => setTriggerPrice((v) => roundP(v + instrument.pipSize))}
              className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Position sizing */}
      <div>
        <div className="mb-0.5 flex items-center justify-between">
          <label className="text-[10px] text-muted">
            {sizeMode === 'lots' ? 'Lots' : 'Risk %'}
          </label>
          <div className="flex items-center gap-px rounded bg-panel-alt p-px">
            {(['lots', 'risk'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSizeMode(m)}
                className={`rounded px-1 py-px text-[9px] font-medium transition-colors ${
                  sizeMode === m
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                {m === 'lots' ? 'Lots' : 'Risk'}
              </button>
            ))}
          </div>
        </div>

        {sizeMode === 'lots' ? (
          <>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setLots((v) => clampLots(v - 0.01))}
                className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
              >
                -
              </button>
              <input
                type="number"
                step={0.01}
                min={0.01}
                value={lots}
                onChange={(e) => setLots(clampLots(Number(e.target.value) || 0.01))}
                className="h-6 w-full rounded bg-panel-alt px-1 text-center font-mono text-[11px] text-white outline-none ring-1 ring-border focus:ring-accent"
              />
              <button
                onClick={() => setLots((v) => clampLots(v + 0.01))}
                className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
              >
                +
              </button>
            </div>
            <div className="mt-0.5 flex gap-0.5">
              {LOT_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setLots(p)}
                  className={`flex-1 rounded px-0.5 py-px text-[9px] ${
                    lots === p
                      ? 'bg-accent text-white'
                      : 'bg-panel-alt text-muted hover:bg-panel-hover hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setRiskPct((v) => clampRisk(v - 0.25))}
                className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
              >
                -
              </button>
              <div className="relative w-full">
                <input
                  type="number"
                  step={0.25}
                  min={0.1}
                  value={riskPct}
                  onChange={(e) => setRiskPct(clampRisk(Number(e.target.value) || 0.1))}
                  className="h-6 w-full rounded bg-panel-alt px-1 text-center font-mono text-[11px] text-white outline-none ring-1 ring-border focus:ring-accent"
                />
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted">
                  %
                </span>
              </div>
              <button
                onClick={() => setRiskPct((v) => clampRisk(v + 0.25))}
                className="h-6 w-6 rounded bg-panel-alt text-sm text-muted hover:bg-panel-hover hover:text-white"
              >
                +
              </button>
            </div>
            <div className="mt-0.5 flex gap-0.5">
              {RISK_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setRiskPct(p)}
                  className={`flex-1 rounded px-0.5 py-px text-[9px] ${
                    riskPct === p
                      ? 'bg-accent text-white'
                      : 'bg-panel-alt text-muted hover:bg-panel-hover hover:text-white'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-1.5">
        <StopField
          label="SL"
          enabled={useSl}
          onToggle={() => setUseSl((v) => !v)}
          value={slPips}
          onChange={setSlPips}
          accent="down"
        />
        <StopField
          label="TP"
          enabled={useTp}
          onToggle={() => setUseTp((v) => !v)}
          value={tpPips}
          onChange={setTpPips}
          accent="up"
        />
      </div>

      {/* Summary - compact */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        {sizeMode === 'risk' && (
          <Info
            label="Vol"
            value={sizingError ? '-' : `${effectiveLots.toFixed(2)}`}
          />
        )}
        <Info label="Pip val" value={formatMoney(perPip)} />
        <Info label="Margin" value={formatMoney(margin)} />
        <Info label="Risk" value={useSl ? formatMoney(risk) : '-'} tone="down" />
        <Info label="Reward" value={useTp ? formatMoney(reward) : '-'} tone="up" />
        <Info label="R:R" value={rr > 0 ? `1:${rr.toFixed(1)}` : '-'} />
      </div>
    </div>
  );
}

function OrderButton({
  side,
  label,
  invalidReason,
  disabled,
  onClick,
}: {
  side: Side;
  label: string;
  invalidReason: string | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const blocked = disabled || invalidReason != null;
  return (
    <div className="flex flex-col">
      <button
        onClick={onClick}
        disabled={blocked}
        title={invalidReason ?? undefined}
        className={`rounded py-2 text-xs font-bold uppercase text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
          side === 'buy' ? 'bg-up' : 'bg-down'
        }`}
      >
        {label}
      </button>
      {invalidReason && (
        <span className="mt-0.5 text-center text-[9px] leading-tight text-muted">
          {invalidReason}
        </span>
      )}
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
      <label className="mb-0.5 flex items-center gap-1 text-[10px] text-muted">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="h-2.5 w-2.5 accent-accent"
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
          className={`h-6 w-full rounded-l bg-panel-alt px-1 text-center font-mono text-[11px] text-white outline-none ring-1 ring-border focus:ring-accent disabled:opacity-40 ${
            accent === 'up' ? 'focus:ring-up' : 'focus:ring-down'
          }`}
        />
        <span className="flex h-6 items-center rounded-r bg-panel-hover px-1 text-[9px] text-muted">
          pip
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
