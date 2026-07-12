import { useStore } from '../store/useStore';
import { computeStats } from '../lib/trading';
import { formatMoney } from '../lib/format';

export function StatsPanel() {
  const history = useStore((s) => s.history);
  const resetAccount = useStore((s) => s.resetAccount);
  const stats = computeStats(history);

  const pf = stats.profitFactor;
  const pfLabel = !isFinite(pf) ? '∞' : pf.toFixed(2);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Performance
        </span>
        <button
          onClick={resetAccount}
          className="rounded bg-panel-alt px-2 py-0.5 text-[10px] text-muted hover:bg-panel-hover hover:text-white"
        >
          Reset account
        </button>
      </div>

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
