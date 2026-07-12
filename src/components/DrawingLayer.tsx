import {
  memo,
  useEffect,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { IChartApi, ISeriesApi, Logical } from 'lightweight-charts';
import { useStore } from '../store/useStore';
import type { Drawing, DrawingType, Point } from '../types';

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

interface Draft {
  type: Exclude<DrawingType, never>;
  a: Point;
  b: Point;
}

interface Props {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
  /** Time (UNIX seconds) of the first (logical index 0) bar currently shown. */
  firstTime: number;
  /** Seconds per bar of the current timeframe. */
  tfSeconds: number;
  digits: number;
  probePrice: number;
}

function DrawingLayerImpl({
  chartRef,
  seriesRef,
  firstTime,
  tfSeconds,
  digits,
  probePrice,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const symbol = useStore((s) => s.symbol);
  const activeTool = useStore((s) => s.activeTool);
  const drawingColor = useStore((s) => s.drawingColor);
  const selectedId = useStore((s) => s.selectedDrawingId);
  const addDrawing = useStore((s) => s.addDrawing);
  const removeDrawing = useStore((s) => s.removeDrawing);
  const selectDrawing = useStore((s) => s.selectDrawing);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const allDrawings = useStore((s) => s.drawings);
  const drawings = allDrawings.filter((d) => d.symbol === symbol);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [, force] = useReducer((x) => x + 1, 0);

  const isDrawMode = activeTool !== 'cursor';

  // ── Keep overlay size in sync ─────────────────────────────────────
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Re-render whenever the chart viewport (pan/zoom/autoscale) changes ──
  const sigRef = useRef('');
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (chart && series) {
        const range = chart.timeScale().getVisibleLogicalRange();
        const y0 = series.priceToCoordinate(probePrice);
        const y1 = series.priceToCoordinate(probePrice * 1.001);
        const sig = `${range?.from ?? ''}|${range?.to ?? ''}|${y0 ?? ''}|${y1 ?? ''}`;
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          force();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chartRef, seriesRef, probePrice]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Escape') {
        setDraft(null);
        selectDrawing(null);
        if (activeTool !== 'cursor') setActiveTool('cursor');
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA' &&
        tag !== 'SELECT'
      ) {
        removeDrawing(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, selectedId, removeDrawing, selectDrawing, setActiveTool]);

  // ── Coordinate mapping ────────────────────────────────────────────
  const mapX = (time: number): number | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const logical = (time - firstTime) / tfSeconds;
    return chart.timeScale().logicalToCoordinate(logical as Logical);
  };
  const mapY = (price: number): number | null => {
    const series = seriesRef.current;
    if (!series) return null;
    return series.priceToCoordinate(price);
  };
  const roundPrice = (v: number) => {
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
  };
  const toData = (clientX: number, clientY: number): Point | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const el = overlayRef.current;
    if (!chart || !series || !el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical == null || price == null) return null;
    return { time: firstTime + (logical as number) * tfSeconds, price: roundPrice(price) };
  };

  // ── Drawing interactions (draw mode) ──────────────────────────────
  const onCapturePointerDown = (e: React.PointerEvent) => {
    const p = toData(e.clientX, e.clientY);
    if (!p) return;
    if (activeTool === 'horizontal') {
      addDrawing({ type: 'horizontal', points: [p], color: drawingColor });
      setActiveTool('cursor');
      return;
    }
    // Two-point tools: first click sets anchor, second click commits.
    if (!draft) {
      setDraft({ type: activeTool as Draft['type'], a: p, b: p });
    } else {
      addDrawing({ type: draft.type, points: [draft.a, p], color: drawingColor });
      setDraft(null);
      setActiveTool('cursor');
    }
  };
  const onCapturePointerMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = toData(e.clientX, e.clientY);
    if (p) setDraft({ ...draft, b: p });
  };

  const ready = size.w > 0 && size.h > 0;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20"
      // In draw mode the overlay itself captures pointer events (reliable
      // across browsers); in cursor mode it is transparent so the chart can
      // pan/zoom, while individual shapes still opt in to selection.
      style={{
        pointerEvents: isDrawMode ? 'auto' : 'none',
        cursor: isDrawMode ? 'crosshair' : undefined,
      }}
      onPointerDown={isDrawMode ? onCapturePointerDown : undefined}
      onPointerMove={isDrawMode ? onCapturePointerMove : undefined}
    >
      {ready && (
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        >
          {drawings.map((d) => (
            <DrawingShape
              key={d.id}
              drawing={d}
              selected={d.id === selectedId}
              width={size.w}
              mapX={mapX}
              mapY={mapY}
              onSelect={() => !isDrawMode && selectDrawing(d.id)}
              onDelete={() => removeDrawing(d.id)}
              interactive={!isDrawMode}
            />
          ))}

          {draft && (
            <DrawingShape
              drawing={{
                id: 'draft',
                symbol,
                type: draft.type,
                points: [draft.a, draft.b],
                color: drawingColor,
              }}
              selected={false}
              preview
              width={size.w}
              mapX={mapX}
              mapY={mapY}
              onSelect={() => {}}
              onDelete={() => {}}
              interactive={false}
            />
          )}

        </svg>
      )}
    </div>
  );
}

export const DrawingLayer = memo(DrawingLayerImpl);

// ── Individual drawing renderer ──────────────────────────────────────────

interface ShapeProps {
  drawing: Drawing;
  selected: boolean;
  preview?: boolean;
  width: number;
  mapX: (time: number) => number | null;
  mapY: (price: number) => number | null;
  onSelect: () => void;
  onDelete: () => void;
  interactive: boolean;
}

function DrawingShape({
  drawing,
  selected,
  preview = false,
  width,
  mapX,
  mapY,
  onSelect,
  onDelete,
  interactive,
}: ShapeProps) {
  const { type, points, color } = drawing;
  const strokeW = selected ? 2.5 : 1.5;
  const dash = preview ? '5 4' : undefined;
  const hitProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!interactive) return;
      e.stopPropagation();
      onSelect();
    },
    style: { pointerEvents: interactive ? ('stroke' as const) : ('none' as const) },
  };

  const p0 = points[0];
  const x0 = mapX(p0.time);
  const y0 = mapY(p0.price);

  if (type === 'horizontal') {
    if (y0 == null) return null;
    return (
      <g>
        <line
          x1={0}
          x2={width}
          y1={y0}
          y2={y0}
          stroke="transparent"
          strokeWidth={10}
          {...hitProps}
        />
        <line x1={0} x2={width} y1={y0} y2={y0} stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
        {selected && <DeleteBadge x={width - 24} y={y0} onDelete={onDelete} />}
      </g>
    );
  }

  const p1 = points[1] ?? points[0];
  const x1 = mapX(p1.time);
  const y1 = mapY(p1.price);
  if (x0 == null || y0 == null || x1 == null || y1 == null) return null;

  if (type === 'trendline') {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    return (
      <g>
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="transparent" strokeWidth={12} {...hitProps} />
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
        {selected && (
          <>
            <Handle x={x0} y={y0} color={color} />
            <Handle x={x1} y={y1} color={color} />
            <DeleteBadge x={mx} y={my - 16} onDelete={onDelete} />
          </>
        )}
      </g>
    );
  }

  if (type === 'rectangle') {
    const rx = Math.min(x0, x1);
    const ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0);
    const rh = Math.abs(y1 - y0);
    return (
      <g>
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={dash}
          style={{ pointerEvents: interactive ? 'all' : 'none' }}
          onPointerDown={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            onSelect();
          }}
        />
        {selected && (
          <>
            <Handle x={x0} y={y0} color={color} />
            <Handle x={x1} y={y1} color={color} />
            <DeleteBadge x={rx + rw} y={ry} onDelete={onDelete} />
          </>
        )}
      </g>
    );
  }

  // Fibonacci retracement
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  return (
    <g>
      <rect
        x={lo}
        y={Math.min(y0, y1)}
        width={hi - lo}
        height={Math.abs(y1 - y0)}
        fill="transparent"
        style={{ pointerEvents: interactive ? 'all' : 'none' }}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onSelect();
        }}
      />
      {FIB_LEVELS.map((level) => {
        const price = p0.price + (p1.price - p0.price) * level;
        const y = mapY(price);
        if (y == null) return null;
        return (
          <g key={level}>
            <line
              x1={lo}
              x2={hi}
              y1={y}
              y2={y}
              stroke={color}
              strokeWidth={level === 0 || level === 1 ? strokeW : 1}
              strokeDasharray={dash ?? (level === 0 || level === 1 ? undefined : '4 3')}
              opacity={0.9}
            />
            <text x={lo + 3} y={y - 2} fill={color} fontSize={9} fontFamily="monospace">
              {level.toFixed(3)} · {price.toFixed(Math.abs(price) >= 100 ? 2 : 4)}
            </text>
          </g>
        );
      })}
      {selected && (
        <>
          <Handle x={x0} y={y0} color={color} />
          <Handle x={x1} y={y1} color={color} />
          <DeleteBadge x={hi} y={Math.min(y0, y1)} onDelete={onDelete} />
        </>
      )}
    </g>
  );
}

function Handle({ x, y, color }: { x: number; y: number; color: string }) {
  return <circle cx={x} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={1.5} />;
}

function DeleteBadge({
  x,
  y,
  onDelete,
}: {
  x: number;
  y: number;
  onDelete: () => void;
}) {
  return (
    <g
      style={{ cursor: 'pointer', pointerEvents: 'all' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      <circle cx={x} cy={y} r={8} fill="#ef5350" />
      <path
        d="M-3 -3 L3 3 M3 -3 L-3 3"
        transform={`translate(${x} ${y})`}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </g>
  );
}
