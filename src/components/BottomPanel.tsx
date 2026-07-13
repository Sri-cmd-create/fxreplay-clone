import { useState } from 'react';
import { useStore } from '../store/useStore';
import { formatMoney } from '../lib/format';
import { PositionsPanel } from './PositionsPanel';
import { PendingPanel } from './PendingPanel';
import { HistoryPanel } from './HistoryPanel';
import { AlertsPanel } from './AlertsPanel';
import { StatsPanel } from './StatsPanel';

type Tab = 'positions' | 'pending' | 'history' | 'stats' | 'alerts';

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>('positions');
  const openCount = useStore((s) => s.positions.length);
  const pendingCount = useStore((s) => s.pendingOrders.length);
  const historyCount = useStore((s) => s.history.length);
  const alertCount = useStore((s) => s.alerts.length);

  // Account metrics
  const balance = useStore((s) => s.balance);
  const startingBalance = useStore((s) => s.startingBalance);
  const derived = useStore((s) => s.derived());

  const pnlTone = derived.floatingPnl > 0 ? 'text-up' : derived.floatingPnl < 0 ? 'text-down' : 'text-white';
  const returnPct = ((derived.equity - startingBalance) / startingBalance) * 100;
  const returnTone = returnPct >= 0 ? 'text-up' : 'text-down';

  return (
    <div className="flex h-full flex-col border-t border-border bg-panel">
      {/* Account metrics row + tabs */}
      <div className="flex items-center border-b border-border px-2">
        {/* Account metrics */}
        <div className="flex items-center gap-4 pr-4 text-[10px]">
          <MetricInline label="Balance" value={formatMoney(balance)} />
          <MetricInline
            label="Equity"
            value={formatMoney(derived.equity)}
            className={derived.equity >= balance ? 'text-up' : 'text-down'}
          />
          <MetricInline
            label="P&L"
            value={formatMoney(derived.floatingPnl, true)}
            className={pnlTone}
          />
          <MetricInline
            label="Return"
            value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`}
            className={returnTone}
          />
          <MetricInline label="Margin" value={formatMoney(derived.usedMargin)} />
          <MetricInline label="Free" value={formatMoney(derived.freeMargin)} />
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Tabs */}
        <div className="flex items-center gap-0.5 pl-2">
          <TabButton
            active={tab === 'positions'}
            onClick={() => setTab('positions')}
            label="Positions"
            count={openCount}
          />
          <TabButton
            active={tab === 'pending'}
            onClick={() => setTab('pending')}
            label="Orders"
            count={pendingCount}
          />
          <TabButton
            active={tab === 'history'}
            onClick={() => setTab('history')}
            label="History"
            count={historyCount}
          />
          <TabButton
            active={tab === 'stats'}
            onClick={() => setTab('stats')}
            label="Stats"
            count={0}
          />
          <TabButton
            active={tab === 'alerts'}
            onClick={() => setTab('alerts')}
            label="Alerts"
            count={alertCount}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'positions' && <PositionsPanel />}
        {tab === 'pending' && <PendingPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'stats' && <StatsPanel />}
        {tab === 'alerts' && <AlertsPanel />}
      </div>
    </div>
  );
}

function MetricInline({
  label,
  value,
  className = 'text-white',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted uppercase">{label}</span>
      <span className={`font-mono font-semibold ${className}`}>{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-2 py-1.5 text-[11px] font-medium transition-colors ${
        active ? 'text-white' : 'text-muted hover:text-white'
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1 rounded bg-panel-hover px-1 py-px text-[9px] text-white">
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
    </button>
  );
}
