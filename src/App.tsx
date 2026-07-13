import { useCallback, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Chart } from './components/Chart';
import { DrawingToolbar } from './components/DrawingToolbar';
import { OrderPanel } from './components/OrderPanel';
import { BottomPanel } from './components/BottomPanel';
import { Toasts } from './components/Toasts';
import { useReplayLoop } from './hooks/useReplayLoop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useReplayLoop();
  useKeyboardShortcuts();

  const [bottomH, setBottomH] = useState(180);
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0e17]">
      <Toasts />
      {/* Top toolbar - single thin row */}
      <Toolbar />

      {/* Main area: drawing strip | chart | order panel */}
      <div className="flex min-h-0 flex-1">
        {/* Left: thin drawing tools strip */}
        <DrawingToolbar />

        {/* Center: chart + bottom panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Chart />
          </div>
          {/* Drag divider */}
          <div
            className="h-[3px] shrink-0 cursor-row-resize bg-border/50 hover:bg-accent/60 active:bg-accent"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          />
          <div className="shrink-0" style={{ height: bottomH }}>
            <BottomPanel />
          </div>
        </div>

        {/* Right: compact order panel */}
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel">
          <OrderPanel />
        </aside>
      </div>
    </div>
  );
}
