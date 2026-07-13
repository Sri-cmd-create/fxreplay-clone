# Project structure & architecture

```
src/
  main.tsx                # React entry
  App.tsx                 # layout: Toolbar / AccountBar / [Chart + BottomPanel | sidebar] + Toasts
  index.css               # Tailwind + base styles + fadeIn keyframe
  types.ts                # all domain types

  lib/                    # pure, framework-free domain logic
    instruments.ts        # INSTRUMENTS (symbol, digits, pipSize, contractSize, leverage), TIMEFRAMES
    random.ts             # mulberry32 PRNG, hashSeed (FNV-1a), gaussian (Box-Muller)
    data.ts               # getBaseCandles(instrument): deterministic 45d of 1-min OHLC (Ornstein-Uhlenbeck), cached
    timeframe.ts          # aggregate(base, tfMinutes, count): epoch-aligned OHLC buckets
    trading.ts            # profit, pipsGained, pipValue, requiredMargin, detectStopFill,
                          #   detectPendingTrigger, validatePendingPrice, computeStats
    format.ts             # formatPrice / formatMoney / formatPips / formatTime, etc.

  store/
    useStore.ts           # THE Zustand store: replay engine + trading sim + drawings + alerts + persistence

  hooks/
    useReplayLoop.ts      # setInterval driving tick() while playing (speed = bars/sec)
    useKeyboardShortcuts.ts

  components/
    Toolbar.tsx           # symbol, timeframes, replay controls, speed, random/date jump, clock
    AccountBar.tsx        # balance / equity / floating P&L / margin metrics
    Chart.tsx             # lightweight-charts setup, candle feed, entry+pending price lines, markers, OHLC legend
    DrawingLayer.tsx      # SVG overlay: drawings (+ create/drag/reshape/delete), draggable SL/TP + alert lines
    DrawingToolbar.tsx    # left rail: cursor/trendline/horizontal/rectangle/fib/measure, colors, clear
    OrderPanel.tsx        # order ticket: market/limit/stop, lots or risk% sizing, SL/TP, R:R
    PositionsPanel.tsx    # open positions, live P&L, partial close, inline SL/TP edit
    PendingPanel.tsx      # resting limit/stop orders
    HistoryPanel.tsx      # closed-trade journal + CSV export
    StatsPanel.tsx        # performance stats + equity curve + starting-balance settings
    AlertsPanel.tsx       # price alerts management
    Toasts.tsx            # transient notifications (alert fired, etc.)
    icons.tsx             # inline SVG icons

scripts/smoke.ts          # headless engine smoke test (run with tsx/bun)
```

## State model (src/store/useStore.ts)

- `symbol`, `timeframe`, `playheads: Record<symbol, index>` (per-symbol M1 cursor),
  `playing`, `speed`.
- Account: `startingBalance`, `balance`, `positions[]`, `pendingOrders[]`, `history[]`.
- `alerts[]`, `toasts[]`.
- Drawings: `activeTool`, `drawingColor`, `drawings[]`, `selectedDrawingId`.
- Selectors as methods: `baseCandles()`, `playhead()`, `currentPrice()`,
  `currentTime()`, `atEnd()`, `derived()` (equity/margin).
- The replay core is `advance(get, set, steps)`: advances the active symbol's
  playhead by `steps` 1-min candles, and for EACH candle checks pending-order
  triggers -> opens positions, SL/TP fills -> books closed trades, and price
  alerts -> fires toasts. This bar-level granularity keeps fills accurate.
- Persistence: a subset of state is saved to `localStorage` (key
  `fxreplay:session:v1`) on every change and loaded at startup (guarded for SSR/node).

## Key idea: the replay clock

`playhead` is an index into the finest (1-minute) series. The visible chart is
`aggregate(baseCandles, tfMinutes, playhead + 1)` — so higher timeframes show a
live "forming" last bar, and SL/TP/pending/alert checks always run against every
underlying 1-min candle regardless of the displayed timeframe.

## Swapping in real market data

Replace `getBaseCandles(instrument)` in `src/lib/data.ts` with a loader that
returns an ascending `Candle[]` (`{ time: unixSeconds, open, high, low, close }`).
Nothing else needs to change.
