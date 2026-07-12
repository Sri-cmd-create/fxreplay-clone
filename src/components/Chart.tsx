import { useEffect, useMemo, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
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

  const symbol = useStore((s) => s.symbol);
  const timeframe = useStore((s) => s.timeframe);
  const playhead = useStore((s) => s.playheads[s.symbol] ?? 0);
  const positions = useStore((s) => s.positions);
  const pendingOrders = useStore((s) => s.pendingOrders);

  const instrument = getInstrument(symbol);
  const tfMinutes = TIMEFRAME_MAP[timeframe].minutes;

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

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
      dataKeyRef.current = '';
      prevLenRef.current = 0;
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
    const markers: SeriesMarker<Time>[] = [];

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
      if (pos.sl != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: pos.sl,
            color: '#ef5350',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
          }),
        );
      }
      if (pos.tp != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: pos.tp,
            color: '#26a69a',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
          }),
        );
      }

      const snapped = (Math.floor(pos.entryTime / bucket) * bucket) as UTCTimestamp;
      markers.push({
        time: snapped,
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
  }, [positions, pendingOrders, symbol, tfMinutes]);

  const firstTime = visible[0]?.time ?? 0;

  return (
    <div className="flex h-full w-full">
      <DrawingToolbar />
      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <DrawingLayer
          chartRef={chartRef}
          seriesRef={seriesRef}
          firstTime={firstTime}
          tfSeconds={tfMinutes * 60}
          digits={instrument.digits}
          probePrice={instrument.basePrice}
        />
      </div>
    </div>
  );
}
