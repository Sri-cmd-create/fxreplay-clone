# FX Replay Pro — clone

A fully working clone of **FXReplay Pro**: a browser-based forex **chart replay &
backtesting** terminal. Load a market, hit play, and replay historical price
action candle-by-candle while placing simulated trades — exactly how you would
practice discretionary trading and backtest a strategy without risking real
money.

Everything runs entirely in the browser with **no backend and no API keys**.
Realistic OHLC data is generated deterministically on the fly, so every session
is reproducible and works fully offline.

## Features

- **Candlestick chart** powered by [`lightweight-charts`](https://github.com/tradingview/lightweight-charts) (the same engine TradingView-style terminals use).
- **Replay engine** — play / pause, step one bar at a time, restart the session, and adjustable playback speed (0.5× → 25× bars per second).
- **Multiple timeframes** — M1, M5, M15, M30, H1, H4, D1. The finest 1-minute data is aggregated up on demand, so higher timeframes form a live "in-progress" bar as replay advances.
- **Multiple instruments** — EURUSD, GBPUSD, AUDUSD, XAUUSD (Gold), BTCUSD, each with its own realistic price behaviour and its own independent replay clock.
- **Order ticket** — market buy/sell with configurable volume (lots), stop-loss and take-profit set in pips, plus live pip value, required margin, risk, reward and R:R.
- **Simulated execution** — stop-loss / take-profit orders are checked against each 1-minute candle's high/low as replay progresses and fill automatically at bar-level granularity (the standard pessimistic backtest assumption: if both SL and TP fall inside one candle, the stop fills first).
- **Account model** — balance, equity, floating P&L, used/free margin and margin level, using leverage-aware margin math.
- **Open positions** panel with live P&L / pips and one-click close (or close-all).
- **Trade journal** with realised P&L, exit reason (manual / SL / TP) and timestamps.
- **Performance stats** — trade count, win rate, profit factor, average win/loss, best/worst trade and max drawdown.

## Tech stack

| Concern            | Choice                                   |
| ------------------ | ---------------------------------------- |
| Build tool         | [Vite](https://vitejs.dev/)              |
| UI                 | React 18 + TypeScript                    |
| Charting           | `lightweight-charts` v4                  |
| State              | [Zustand](https://github.com/pmndrs/zustand) |
| Styling            | Tailwind CSS                             |

## Getting started

```bash
npm install
npm run dev       # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build     # type-check + production build into dist/
npm run preview   # preview the production build locally
```

## How it works

### Data generation

`src/lib/data.ts` generates 45 days of 1-minute candles per instrument using a
mean-reverting (Ornstein–Uhlenbeck) log-price process anchored to a base price,
plus a slow short-memory drift term that produces realistic trending and ranging
regimes. A seeded PRNG (`src/lib/random.ts`) keys the series off the symbol name,
so each instrument's history is identical on every load. The dataset is anchored
to a fixed historical end date, making sessions fully deterministic.

To use **real** market data instead, replace `getBaseCandles()` with a loader
that returns an ascending array of `{ time, open, high, low, close }` (time in
UNIX **seconds**). Nothing else needs to change.

### Replay model

The replay "playhead" is an index into the 1-minute base series and is tracked
**per instrument**, so switching symbols preserves each market's position in
time. Advancing the replay reveals more base candles; the chart re-aggregates
the revealed portion into the selected timeframe. Because SL/TP fills are
evaluated on every intermediate 1-minute candle, execution stays accurate even
when you step across a large higher-timeframe bar.

### P&L & margin

All instruments are quoted in USD (the account currency), so realised/floating
profit is simply `(exit − entry) × direction × lots × contractSize`. Required
margin is `lots × contractSize × price ÷ leverage`. See `src/lib/trading.ts`.

## Project structure

```
src/
  App.tsx                 # top-level layout
  types.ts                # domain types
  hooks/useReplayLoop.ts  # playback timer
  lib/
    instruments.ts        # instrument & timeframe definitions
    data.ts               # synthetic OHLC generation
    timeframe.ts          # base -> higher timeframe aggregation
    trading.ts            # P&L, pips, margin, SL/TP fills, stats
    random.ts             # deterministic PRNG helpers
    format.ts             # price/money/time formatting
  store/useStore.ts       # Zustand store: replay engine + trading sim
  components/             # Chart, Toolbar, AccountBar, OrderPanel,
                          # PositionsPanel, HistoryPanel, StatsPanel, ...
scripts/smoke.ts          # headless runtime smoke test for the engine
```

## Notes & disclaimer

This is an educational trading **simulator** built on synthetic data. It does
not connect to a broker and is not financial advice.
