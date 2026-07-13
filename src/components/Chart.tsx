import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useStore } from '../store/useStore';
import { getBaseCandles } from '../lib/data';
import { getInstrument, TIMEFRAME_MAP } from '../lib/instruments';
import { aggregate } from '../lib/timeframe';
import type { Candle } from '../types';
import { DrawingToolbar } from './DrawingToolbar';
import { DrawingLayer } from './DrawingLayer';

function toSeriesData(candles: Candle[]): CandlestickData[] {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function Chart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const dataKeyRef = useRef<string>('');
  const prevLenRef = useRef<number>(0);

  const [chartReady, setChartReady] = useState(false);

  const symbol = useStore((s) => s.symbol);
  const timeframe = useStore((s) => s.timeframe);
  const playhead = useStore((s) => s.playheads[s.symbol] ?? 0);
  const positions = useStore((s) => s.positions);
  const pendingOrders = useStore((s) => s.pendingOrders);
  const history = useStore((s) => s.history);

  const instrument = getInstrument(symbol);
  const tf = TIMEFRAME_MAP[timeframe];
  const tfMinutes = tf.minutes;

  // Aggregate only the revealed portion of the base series for the timeframe.
  const visible = useMemo(() => {
    const base = getBaseCandles(instrument);
    return aggregate(base, tfMinutes, playhead + 1);
  }, [instrument, tfMinutes, playhead]);

  // ── Create the chart once ─────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(42,46,57,0.5)' },
        horzLines: { color: 'rgba(42,46,57,0.5)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
      dataKeyRef.current = '';
      prevLenRef.current = 0;
      setChartReady(false);
    };
  }, []);

  // ── Feed data (rebuild on symbol/timeframe change, incremental otherwise)
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    series.applyOptions({
      priceFormat: {
        type: 'price',
        precision: instrument.digits,
        minMove: 1 / Math.pow(10, instrument.digits),
      },
    });

    const dataKey = `${symbol}|${timeframe}`;
    if (dataKey !== dataKeyRef.current) {
      // New market/timeframe: rebuild everything.
      series.setData(toSeriesData(visible));
      chart.timeScale().fitContent();
      dataKeyRef.current = dataKey;
      prevLenRef.current = visible.length;
      return;
    }

    // Same market/timeframe: only the trailing (forming) bar plus any newly
    // completed bars can have changed — update those incrementally.
    const from = Math.max(0, prevLenRef.current - 1);
    for (let i = from; i < visible.length; i++) {
      const c = visible[i];
      series.update({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });
    }
    prevLenRef.current = visible.length;
  }, [symbol, timeframe, visible, instrument.digits]);

  // ── Position price lines + entry markers ──────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear previous lines.
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    const bucket = tfMinutes * 60;
    const snap = (t: number) => (Math.floor(t / bucket) * bucket) as UTCTimestamp;
    const markers: SeriesMarker<Time>[] = [];

    // Closed trades on this symbol: a muted entry marker + a win/loss-coloured
    // exit marker labelled with how it closed (TP / SL / manual).
    for (const t of history) {
      if (t.symbol !== symbol) continue;
      const isBuy = t.side === 'buy';
      const win = t.pnl >= 0;
      markers.push({
        time: snap(t.entryTime),
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: '#787b86',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
      });
      markers.push({
        time: snap(t.exitTime),
        position: isBuy ? 'aboveBar' : 'belowBar',
        color: win ? '#26a69a' : '#ef5350',
        shape: 'circle',
        text: t.reason === 'tp' ? 'TP' : t.reason === 'sl' ? 'SL' : 'Close',
      });
    }

    for (const pos of positions) {
      if (pos.symbol !== symbol) continue;
      const isBuy = pos.side === 'buy';

      priceLinesRef.current.push(
        series.createPriceLine({
          price: pos.entryPrice,
          color: isBuy ? '#26a69a' : '#ef5350',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${isBuy ? 'BUY' : 'SELL'} ${pos.lots}`,
        }),
      );
      // SL / TP are drawn as draggable lines in the DrawingLayer overlay.

      markers.push({
        time: snap(pos.entryTime),
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#26a69a' : '#ef5350',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: isBuy ? 'Buy' : 'Sell',
      });
    }

    // Resting pending orders: a dotted trigger line (+ their SL/TP).
    for (const o of pendingOrders) {
      if (o.symbol !== symbol) continue;
      const isBuy = o.side === 'buy';
      priceLinesRef.current.push(
        series.createPriceLine({
          price: o.price,
          color: isBuy ? '#26a69a' : '#ef5350',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${o.side.toUpperCase()} ${o.type.toUpperCase()} ${o.lots}`,
        }),
      );
      if (o.sl != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: o.sl,
            color: '#ef5350',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: 'SL',
          }),
        );
      }
      if (o.tp != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: o.tp,
            color: '#26a69a',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: 'TP',
          }),
        );
      }
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(markers);
  }, [positions, pendingOrders, history, symbol, tfMinutes]);

  const firstTime = visible[0]?.time ?? 0;
  const lastCandle = visible[visible.length - 1] ?? null;

  return (
    <div className="flex h-full w-full">
      <DrawingToolbar />
      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <ChartLegend
          chartRef={chartRef}
          seriesRef={seriesRef}
          ready={chartReady}
          symbol={symbol}
          timeframeLabel={tf.label}
          digits={instrument.digits}
          fallback={lastCandle}
        />
        <DrawingLayer
          chartRef={chartRef}
          seriesRef={seriesRef}
          firstTime={firstTime}
          tfSeconds={tfMinutes * 60}
          digits={instrument.digits}
          pipSize={instrument.pipSize}
          probePrice={instrument.basePrice}
        />
      </div>
    </div>
  );
}

// ── Live OHLC legend (top-left), following the crosshair ─────────────────

interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

function ChartLegend({
  chartRef,
  seriesRef,
  ready,
  symbol,
  timeframeLabel,
  digits,
  fallback,
}: {
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
  ready: boolean;
  symbol: string;
  timeframeLabel: string;
  digits: number;
  fallback: Candle | null;
}) {
  const [hover, setHover] = useState<OHLC | null>(null);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!ready || !chart || !series) return;

    const handler = (param: MouseEventParams) => {
      const d = param.seriesData.get(series) as CandlestickData | undefined;
      if (d && typeof d.open === 'number') {
        setHover({ open: d.open, high: d.high, low: d.low, close: d.close });
      } else {
        setHover(null);
      }
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [chartRef, seriesRef, ready]);

  const bar: OHLC | null = hover ?? fallback;
  if (!bar) return null;

  const up = bar.close >= bar.open;
  const color = up ? '#26a69a' : '#ef5350';
  const change = bar.close - bar.open;
  const pct = bar.open ? (change / bar.open) * 100 : 0;
  const fmt = (v: number) =>
    v.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
      <span className="text-sm font-semibold text-white">{symbol}</span>
      <span className="text-muted">{timeframeLabel}</span>
      <span className="font-mono text-muted">
        O <span style={{ color }}>{fmt(bar.open)}</span>
      </span>
      <span className="font-mono text-muted">
        H <span style={{ color }}>{fmt(bar.high)}</span>
      </span>
      <span className="font-mono text-muted">
        L <span style={{ color }}>{fmt(bar.low)}</span>
      </span>
      <span className="font-mono text-muted">
        C <span style={{ color }}>{fmt(bar.close)}</span>
      </span>
      <span className="font-mono" style={{ color }}>
        {change >= 0 ? '+' : ''}
        {fmt(change)} ({pct >= 0 ? '+' : ''}
        {pct.toFixed(2)}%)
      </span>
    </div>
  );
}
