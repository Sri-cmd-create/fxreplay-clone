import { useState } from 'react';
import { useStore } from '../store/useStore';
import { PositionsPanel } from './PositionsPanel';
import { PendingPanel } from './PendingPanel';
import { HistoryPanel } from './HistoryPanel';
import { AlertsPanel } from './AlertsPanel';

type Tab = 'positions' | 'pending' | 'history' | 'alerts';

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>('positions');
  const openCount = useStore((s) => s.positions.length);
  const pendingCount = useStore((s) => s.pendingOrders.length);
  const historyCount = useStore((s) => s.history.length);
  const alertCount = useStore((s) => s.alerts.length);

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center gap-1 border-b border-border px-2">
        <TabButton
          active={tab === 'positions'}
          onClick={() => setTab('positions')}
          label="Open Positions"
          count={openCount}
        />
        <TabButton
          active={tab === 'pending'}
          onClick={() => setTab('pending')}
          label="Pending Orders"
          count={pendingCount}
        />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          label="History"
          count={historyCount}
        />
        <TabButton
          active={tab === 'alerts'}
          onClick={() => setTab('alerts')}
          label="Alerts"
          count={alertCount}
        />
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'positions' && <PositionsPanel />}
        {tab === 'pending' && <PendingPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'alerts' && <AlertsPanel />}
      </div>
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
      className={`relative px-3 py-2 text-xs font-medium transition-colors ${
        active ? 'text-white' : 'text-muted hover:text-white'
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 rounded bg-panel-hover px-1.5 py-0.5 text-[10px] text-white">
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
    </button>
  );
}
