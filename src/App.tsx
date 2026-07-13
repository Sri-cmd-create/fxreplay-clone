import { useCallback, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { AccountBar } from './components/AccountBar';
import { Chart } from './components/Chart';
import { Watchlist } from './components/Watchlist';
import { OrderPanel } from './components/OrderPanel';
import { StatsPanel } from './components/StatsPanel';
import { BottomPanel } from './components/BottomPanel';
import { Toasts } from './components/Toasts';
import { useReplayLoop } from './hooks/useReplayLoop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useReplayLoop();
  useKeyboardShortcuts();

  const [bottomH, setBottomH] = useState(224);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startY: e.clientY, startH: bottomH };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bottomH],
  );
  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const newH = d.startH - (e.clientY - d.startY);
    setBottomH(Math.max(80, Math.min(500, newH)));
  }, []);
  const onDragEnd = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0c0e15]">
      <Toasts />
      <Toolbar />
      <AccountBar />

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: watchlist */}
        <aside className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-panel">
          <Watchlist />
        </aside>

        {/* Chart + bottom panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 border-b border-border">
            <Chart />
          </div>
          {/* Drag divider */}
          <div
            className="h-1 shrink-0 cursor-row-resize bg-border hover:bg-accent active:bg-accent"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          />
          <div className="shrink-0" style={{ height: bottomH }}>
            <BottomPanel />
          </div>
        </div>

        {/* Right sidebar: order ticket + performance */}
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel">
          <OrderPanel />
          <StatsPanel />
        </aside>
      </div>
    </div>
  );
}
