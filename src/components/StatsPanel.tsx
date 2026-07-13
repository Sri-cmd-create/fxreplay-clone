import { useState } from 'react';
import { useStore } from '../store/useStore';
import { computeStats } from '../lib/trading';
import { formatMoney } from '../lib/format';
import { GearIcon } from './icons';
import type { ClosedTrade } from '../types';

export function StatsPanel() {
  const history = useStore((s) => s.history);
  const resetAccount = useStore((s) => s.resetAccount);
  const startingBalance = useStore((s) => s.startingBalance);
  const setStartingBalance = useStore((s) => s.setStartingBalance);
  const stats = computeStats(history);

  const [showSettings, setShowSettings] = useState(false);
  const [balInput, setBalInput] = useState(String(startingBalance));

  const pf = stats.profitFactor;
  const pfLabel = !isFinite(pf) ? '∞' : pf.toFixed(2);

  const applyBalance = () => {
    const n = Number(balInput);
    if (Number.isFinite(n) && n >= 1) {
      setStartingBalance(n);
      setShowSettings(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Performance
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setBalInput(String(startingBalance));
              setShowSettings((v) => !v);
            }}
            title="Account settings"
            className={`flex h-6 w-6 items-center justify-center rounded ${
              showSettings
                ? 'bg-panel-hover text-white'
                : 'text-muted hover:bg-panel-hover hover:text-white'
            }`}
          >
            <GearIcon width={13} height={13} />
          </button>
          <button
            onClick={resetAccount}
            className="rounded bg-panel-alt px-2 py-0.5 text-[10px] text-muted hover:bg-panel-hover hover:text-white"
          >
            Reset account
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="flex items-center gap-2 rounded bg-panel-alt/60 p-2 text-[11px]">
          <label className="whitespace-nowrap text-muted">Starting balance</label>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted">
              $
            </span>
            <input
              type="number"
              min={1}
              step={1000}
              value={balInput}
              onChange={(e) => setBalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyBalance();
              }}
              className="h-7 w-full rounded bg-panel pl-5 pr-2 text-right font-mono text-white outline-none ring-1 ring-border focus:ring-accent"
            />
          </div>
          <button
            onClick={applyBalance}
            className="whitespace-nowrap rounded bg-accent px-2 py-1 text-[10px] font-medium text-white hover:brightness-110"
          >
            Set &amp; reset
          </button>
        </div>
      )}

      <EquityCurve history={history} startBalance={startingBalance} />

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <Stat label="Trades" value={String(stats.totalTrades)} />
        <Stat
          label="Win rate"
          value={`${stats.winRate.toFixed(1)}%`}
          tone={stats.winRate >= 50 ? 'up' : 'down'}
        />
        <Stat label="Wins" value={String(stats.wins)} tone="up" />
        <Stat label="Losses" value={String(stats.losses)} tone="down" />
        <Stat
          label="Net P&L"
          value={formatMoney(stats.netPnl, true)}
          tone={stats.netPnl >= 0 ? 'up' : 'down'}
        />
        <Stat label="Profit factor" value={pfLabel} />
        <Stat label="Avg win" value={formatMoney(stats.avgWin)} tone="up" />
        <Stat label="Avg loss" value={formatMoney(stats.avgLoss)} tone="down" />
        <Stat label="Best" value={formatMoney(stats.bestTrade)} tone="up" />
        <Stat label="Worst" value={formatMoney(stats.worstTrade)} tone="down" />
        <Stat label="Max DD" value={formatMoney(stats.maxDrawdown)} tone="down" />
      </div>
    </div>
  );
}

/** Realised-balance equity curve sparkline built from closed trades. */
function EquityCurve({
  history,
  startBalance,
}: {
  history: ClosedTrade[];
  startBalance: number;
}) {
  // history is newest-first; walk it chronologically to build the balance path.
  const chrono = [...history].reverse();
  const equity: number[] = [startBalance];
  let bal = startBalance;
  for (const t of chrono) {
    bal += t.pnl;
    equity.push(bal);
  }

  const last = equity[equity.length - 1];
  const up = last >= startBalance;
  const color = up ? '#26a69a' : '#ef5350';

  const W = 100;
  const H = 32;
  const PAD = 2;

  let body;
  if (equity.length < 2) {
    body = (
      <div className="flex h-[52px] items-center justify-center text-[11px] text-muted">
        No closed trades yet — your equity curve will build here.
      </div>
    );
  } else {
    const min = Math.min(...equity);
    const max = Math.max(...equity);
    const span = max - min || 1;
    const n = equity.length;
    const points = equity
      .map((v, i) => {
        const x = (i / (n - 1)) * W;
        const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    const baselineY = H - PAD - ((startBalance - min) / span) * (H - PAD * 2);

    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[52px] w-full"
      >
        <line
          x1={0}
          x2={W}
          y1={baselineY}
          y2={baselineY}
          stroke="#2a2e39"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div className="rounded bg-panel-alt/60 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
        <span>Equity curve</span>
        <span className={`font-mono ${up ? 'text-up' : 'text-down'}`}>
          {formatMoney(last)}
        </span>
      </div>
      {body}
    </div>
  );
}

function Stat({
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
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
