import { useStore, DRAWING_COLORS } from '../store/useStore';
import type { DrawingTool } from '../types';
import {
  CursorIcon,
  TrendlineIcon,
  HorizontalIcon,
  RectangleIcon,
  FibIcon,
  RulerIcon,
  TrashIcon,
} from './icons';

const TOOLS: { tool: DrawingTool; label: string; Icon: typeof CursorIcon }[] = [
  { tool: 'cursor', label: 'Cursor / pan', Icon: CursorIcon },
  { tool: 'trendline', label: 'Trend line', Icon: TrendlineIcon },
  { tool: 'horizontal', label: 'Horizontal line', Icon: HorizontalIcon },
  { tool: 'rectangle', label: 'Rectangle', Icon: RectangleIcon },
  { tool: 'fib', label: 'Fibonacci retracement', Icon: FibIcon },
  { tool: 'measure', label: 'Measure (pips / % / bars)', Icon: RulerIcon },
];

export function DrawingToolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const drawingColor = useStore((s) => s.drawingColor);
  const setDrawingColor = useStore((s) => s.setDrawingColor);
  const clearDrawings = useStore((s) => s.clearDrawings);
  const symbol = useStore((s) => s.symbol);
  const hasDrawings = useStore((s) =>
    s.drawings.some((d) => d.symbol === symbol),
  );

  return (
    <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-panel py-1.5">
      {TOOLS.map(({ tool, label, Icon }) => (
        <button
          key={tool}
          title={label}
          onClick={() => setActiveTool(tool)}
          className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
            activeTool === tool
              ? 'bg-accent text-white'
              : 'text-muted hover:bg-panel-hover hover:text-white'
          }`}
        >
          <Icon width={16} height={16} />
        </button>
      ))}

      <div className="my-0.5 h-px w-5 bg-border" />

      {/* Colour palette */}
      <div className="flex flex-col items-center gap-0.5">
        {DRAWING_COLORS.map((c) => (
          <button
            key={c}
            title={`Colour ${c}`}
            onClick={() => setDrawingColor(c)}
            className={`h-3.5 w-3.5 rounded-full ring-offset-1 ring-offset-panel ${
              drawingColor === c ? 'ring-2 ring-white' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="my-0.5 h-px w-5 bg-border" />

      <button
        title="Clear all drawings on this symbol"
        onClick={clearDrawings}
        disabled={!hasDrawings}
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-down hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <TrashIcon width={14} height={14} />
      </button>
    </div>
  );
}
