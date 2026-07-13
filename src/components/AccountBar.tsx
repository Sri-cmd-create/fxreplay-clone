import { useStore } from '../store/useStore';
import { formatMoney } from '../lib/format';

function Metric({
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
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export function AccountBar() {
  const balance = useStore((s) => s.balance);
  const startingBalance = useStore((s) => s.startingBalance);
  const derived = useStore((s) => s.derived());

  const pnlTone = derived.floatingPnl > 0 ? 'up' : derived.floatingPnl < 0 ? 'down' : 'default';
  const returnPct = ((derived.equity - startingBalance) / startingBalance) * 100;
  const returnTone = returnPct >= 0 ? 'up' : 'down';

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-panel-alt px-4 py-2">
      <Metric label="Balance" value={formatMoney(balance)} />
      <Metric
        label="Equity"
        value={formatMoney(derived.equity)}
        tone={derived.equity >= balance ? 'up' : 'down'}
      />
      <Metric
        label="Return"
        value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`}
        tone={returnTone}
      />
      <Metric
        label="Floating P&L"
        value={formatMoney(derived.floatingPnl, true)}
        tone={pnlTone}
      />
      <Metric label="Used Margin" value={formatMoney(derived.usedMargin)} />
      <Metric label="Free Margin" value={formatMoney(derived.freeMargin)} />
      <Metric
        label="Margin Level"
        value={derived.usedMargin > 0 ? `${derived.marginLevel.toFixed(1)}%` : '—'}
      />
    </div>
  );
}
