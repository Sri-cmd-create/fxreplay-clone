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
import { formatPrice } from '../lib/format';
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
  pipSize: number;
  probePrice: number;
}

function DrawingLayerImpl({
  chartRef,
  seriesRef,
  firstTime,
  tfSeconds,
  digits,
  pipSize,
  probePrice,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const symbol = useStore((s) => s.symbol);
  const activeTool = useStore((s) => s.activeTool);
  const drawingColor = useStore((s) => s.drawingColor);
  const selectedId = useStore((s) => s.selectedDrawingId);
  const addDrawing = useStore((s) => s.addDrawing);
  const updateDrawing = useStore((s) => s.updateDrawing);
  const removeDrawing = useStore((s) => s.removeDrawing);
  const selectDrawing = useStore((s) => s.selectDrawing);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const allDrawings = useStore((s) => s.drawings);
  const drawings = allDrawings.filter((d) => d.symbol === symbol);
  const positions = useStore((s) => s.positions);
  const modifyPosition = useStore((s) => s.modifyPosition);
  const activePositions = positions.filter((p) => p.symbol === symbol);
  const alerts = useStore((s) => s.alerts);
  const updateAlert = useStore((s) => s.updateAlert);
  const activeAlerts = alerts.filter((a) => a.symbol === symbol);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [, force] = useReducer((x) => x + 1, 0);

  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'point';
    pointIndex?: number;
    start: Point;
    orig: Point[];
    pointerId: number;
  } | null>(null);

  // Drag state for stop-loss / take-profit lines of open positions.
  const slDragRef = useRef<{
    id: string;
    field: 'sl' | 'tp';
    pointerId: number;
  } | null>(null);

  // Drag state for price-alert lines.
  const alertDragRef = useRef<{ id: string; pointerId: number } | null>(null);

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

  // ── Dragging existing drawings (cursor mode) ──────────────────────
  const drag: DragApi = {
    begin: (e, id, origPoints, mode, pointIndex) => {
      const start = toData(e.clientX, e.clientY);
      if (!start) return;
      e.stopPropagation();
      selectDrawing(id);
      dragRef.current = {
        id,
        mode,
        pointIndex,
        start,
        orig: origPoints.map((p) => ({ ...p })),
        pointerId: e.pointerId,
      };
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const cur = toData(e.clientX, e.clientY);
      if (!cur) return;
      if (d.mode === 'point' && d.pointIndex != null) {
        const pts = d.orig.map((p, i) => (i === d.pointIndex ? cur : p));
        updateDrawing(d.id, pts);
      } else {
        const dt = cur.time - d.start.time;
        const dp = cur.price - d.start.price;
        const pts = d.orig.map((p) => ({
          time: p.time + dt,
          price: roundPrice(p.price + dp),
        }));
        updateDrawing(d.id, pts);
      }
    },
    end: (e) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        (e.currentTarget as Element).releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
    },
  };

  // ── Dragging SL / TP lines of open positions ──────────────────────
  const slDrag = {
    begin: (e: React.PointerEvent, id: string, field: 'sl' | 'tp') => {
      e.stopPropagation();
      slDragRef.current = { id, field, pointerId: e.pointerId };
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e: React.PointerEvent) => {
      const d = slDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const cur = toData(e.clientX, e.clientY);
      if (!cur) return;
      const pos = useStore.getState().positions.find((p) => p.id === d.id);
      if (!pos) return;
      modifyPosition(
        d.id,
        d.field === 'sl' ? cur.price : pos.sl,
        d.field === 'tp' ? cur.price : pos.tp,
      );
    },
    end: (e: React.PointerEvent) => {
      const d = slDragRef.current;
      if (!d) return;
      try {
        (e.currentTarget as Element).releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
      slDragRef.current = null;
    },
  };

  const slBind = (id: string, field: 'sl' | 'tp', hit: 'stroke' | 'all') =>
    isDrawMode
      ? { style: { pointerEvents: 'none' as const } }
      : {
          onPointerDown: (e: React.PointerEvent) => slDrag.begin(e, id, field),
          onPointerMove: slDrag.move,
          onPointerUp: slDrag.end,
          style: { pointerEvents: hit, cursor: 'ns-resize' } as React.CSSProperties,
        };

  const renderPosLine = (
    id: string,
    field: 'sl' | 'tp',
    price: number,
    color: string,
  ) => {
    const y = mapY(price);
    if (y == null) return null;
    return (
      <g key={`${id}-${field}`}>
        <line x1={0} x2={size.w} y1={y} y2={y} stroke="transparent" strokeWidth={10} {...slBind(id, field, 'stroke')} />
        <line
          x1={0}
          x2={size.w - 70}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        />
        <g {...slBind(id, field, 'all')}>
          <rect x={size.w - 68} y={y - 8} width={64} height={16} rx={2} fill={color} />
          <text x={size.w - 36} y={y + 4} textAnchor="middle" fontSize={9} fill="#fff" fontFamily="monospace">
            {field.toUpperCase()} {formatPrice(price, digits)}
          </text>
        </g>
      </g>
    );
  };

  // ── Dragging price-alert lines ────────────────────────────────────
  const alertDrag = {
    begin: (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      alertDragRef.current = { id, pointerId: e.pointerId };
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e: React.PointerEvent) => {
      const d = alertDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const cur = toData(e.clientX, e.clientY);
      if (!cur) return;
      updateAlert(d.id, cur.price);
    },
    end: (e: React.PointerEvent) => {
      const d = alertDragRef.current;
      if (!d) return;
      try {
        (e.currentTarget as Element).releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
      alertDragRef.current = null;
    },
  };

  const alertBind = (id: string, hit: 'stroke' | 'all') =>
    isDrawMode
      ? { style: { pointerEvents: 'none' as const } }
      : {
          onPointerDown: (e: React.PointerEvent) => alertDrag.begin(e, id),
          onPointerMove: alertDrag.move,
          onPointerUp: alertDrag.end,
          style: { pointerEvents: hit, cursor: 'ns-resize' } as React.CSSProperties,
        };

  const renderAlertLine = (id: string, price: number, triggered: boolean) => {
    const y = mapY(price);
    if (y == null) return null;
    const color = triggered ? '#787b86' : '#f0b90b';
    return (
      <g key={id}>
        <line x1={0} x2={size.w} y1={y} y2={y} stroke="transparent" strokeWidth={10} {...alertBind(id, 'stroke')} />
        <line
          x1={78}
          x2={size.w}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2 3"
          style={{ pointerEvents: 'none' }}
        />
        <g {...alertBind(id, 'all')}>
          <rect x={2} y={y - 8} width={76} height={16} rx={2} fill={color} />
          <path
            d="M12 5a3 3 0 00-3 3c0 2-.75 2.75-1 3.25h8c-.25-.5-1-1.25-1-3.25a3 3 0 00-3-3zM11 12.5a1 1 0 002 0"
            transform={`translate(${-4} ${y - 12}) scale(0.7)`}
            fill={triggered ? '#fff' : '#131722'}
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={22}
            y={y + 3}
            fontSize={9}
            fill={triggered ? '#fff' : '#131722'}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {formatPrice(price, digits)}
          </text>
        </g>
      </g>
    );
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
          {activePositions.map((pos) => (
            <g key={`pos-${pos.id}`}>
              {pos.sl != null && renderPosLine(pos.id, 'sl', pos.sl, '#ef4444')}
              {pos.tp != null && renderPosLine(pos.id, 'tp', pos.tp, '#22c55e')}
            </g>
          ))}

          {activeAlerts.map((a) => renderAlertLine(a.id, a.price, a.triggered))}

          {drawings.map((d) => (
            <DrawingShape
              key={d.id}
              drawing={d}
              selected={d.id === selectedId}
              width={size.w}
              mapX={mapX}
              mapY={mapY}
              drag={drag}
              digits={digits}
              pipSize={pipSize}
              tfSeconds={tfSeconds}
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
              drag={drag}
              digits={digits}
              pipSize={pipSize}
              tfSeconds={tfSeconds}
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

interface DragApi {
  begin: (
    e: React.PointerEvent,
    id: string,
    origPoints: Point[],
    mode: 'move' | 'point',
    pointIndex?: number,
  ) => void;
  move: (e: React.PointerEvent) => void;
  end: (e: React.PointerEvent) => void;
}

interface ShapeProps {
  drawing: Drawing;
  selected: boolean;
  preview?: boolean;
  width: number;
  mapX: (time: number) => number | null;
  mapY: (price: number) => number | null;
  drag: DragApi;
  digits: number;
  pipSize: number;
  tfSeconds: number;
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
  drag,
  digits,
  pipSize,
  tfSeconds,
  onDelete,
  interactive,
}: ShapeProps) {
  const { type, points, color } = drawing;
  const strokeW = selected ? 2.5 : 1.5;
  const dash = preview ? '5 4' : undefined;

  // Pointer handlers that start a drag on a shape body ('move') or an
  // endpoint handle ('point'). Uses pointer capture so the drag continues
  // smoothly even when the cursor leaves the (thin) shape.
  const dragBind = (
    mode: 'move' | 'point',
    hit: 'stroke' | 'all',
    cursor: string,
    pointIndex?: number,
  ) =>
    interactive
      ? {
          onPointerDown: (e: React.PointerEvent) =>
            drag.begin(e, drawing.id, points, mode, pointIndex),
          onPointerMove: drag.move,
          onPointerUp: drag.end,
          style: { pointerEvents: hit, cursor } as React.CSSProperties,
        }
      : { style: { pointerEvents: 'none' as const } };

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
          {...dragBind('move', 'stroke', 'ns-resize')}
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
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="transparent" strokeWidth={12} {...dragBind('move', 'stroke', 'move')} />
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
        {selected && (
          <>
            <Handle x={x0} y={y0} color={color} drag={dragBind('point', 'all', 'grab', 0)} />
            <Handle x={x1} y={y1} color={color} drag={dragBind('point', 'all', 'grab', 1)} />
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
          {...dragBind('move', 'all', 'move')}
        />
        {selected && (
          <>
            <Handle x={x0} y={y0} color={color} drag={dragBind('point', 'all', 'grab', 0)} />
            <Handle x={x1} y={y1} color={color} drag={dragBind('point', 'all', 'grab', 1)} />
            <DeleteBadge x={rx + rw} y={ry} onDelete={onDelete} />
          </>
        )}
      </g>
    );
  }

  if (type === 'measure') {
    const rx = Math.min(x0, x1);
    const ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0);
    const rh = Math.abs(y1 - y0);
    const cx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const priceDelta = p1.price - p0.price;
    const pips = priceDelta / pipSize;
    const pct = p0.price !== 0 ? (priceDelta / p0.price) * 100 : 0;
    const bars = Math.round(Math.abs(p1.time - p0.time) / tfSeconds);
    const up = priceDelta >= 0;
    const mColor = up ? '#22c55e' : '#ef4444';
    const dir = y1 < y0 ? -1 : 1;
    return (
      <g>
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill={`${mColor}22`}
          stroke={mColor}
          strokeWidth={strokeW}
          strokeDasharray={dash}
          {...dragBind('move', 'all', 'move')}
        />
        <line x1={cx} y1={y0} x2={cx} y2={y1} stroke={mColor} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        <polygon
          points={`${cx - 4},${y1 - dir * 7} ${cx + 4},${y1 - dir * 7} ${cx},${y1}`}
          fill={mColor}
          style={{ pointerEvents: 'none' }}
        />
        <g style={{ pointerEvents: 'none' }}>
          <rect x={cx - 58} y={my - 15} width={116} height={30} rx={3} fill={mColor} />
          <text x={cx} y={my - 3} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#fff" fontFamily="monospace">
            {pips >= 0 ? '+' : ''}
            {pips.toFixed(1)} pips
          </text>
          <text x={cx} y={my + 9} textAnchor="middle" fontSize={9} fill="#fff" fontFamily="monospace">
            {pct >= 0 ? '+' : ''}
            {pct.toFixed(2)}% · {bars} bars
          </text>
        </g>
        {selected && (
          <>
            <Handle x={x0} y={y0} color={mColor} drag={dragBind('point', 'all', 'grab', 0)} />
            <Handle x={x1} y={y1} color={mColor} drag={dragBind('point', 'all', 'grab', 1)} />
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
        {...dragBind('move', 'all', 'move')}
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
              {level.toFixed(3)} · {price.toFixed(digits)}
            </text>
          </g>
        );
      })}
      {selected && (
        <>
          <Handle x={x0} y={y0} color={color} drag={dragBind('point', 'all', 'grab', 0)} />
          <Handle x={x1} y={y1} color={color} drag={dragBind('point', 'all', 'grab', 1)} />
          <DeleteBadge x={hi} y={Math.min(y0, y1)} onDelete={onDelete} />
        </>
      )}
    </g>
  );
}

function Handle({
  x,
  y,
  color,
  drag,
}: {
  x: number;
  y: number;
  color: string;
  drag?: React.SVGProps<SVGCircleElement>;
}) {
  return <circle cx={x} cy={y} r={5} fill="#fff" stroke={color} strokeWidth={1.5} {...drag} />;
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
      <circle cx={x} cy={y} r={8} fill="#ef4444" />
      <path
        d="M-3 -3 L3 3 M3 -3 L-3 3"
        transform={`translate(${x} ${y})`}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </g>
  );
}
