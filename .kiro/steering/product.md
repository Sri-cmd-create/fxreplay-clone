# Product: FX Replay Pro (clone)

A browser-based **forex chart-replay & backtesting terminal** — a clone of FXReplay Pro.
Traders load a market, press play, and replay historical candlestick data
candle-by-candle while placing simulated trades to practice discretionary
trading and backtest strategies. Everything runs client-side with **no backend
and no API keys**; realistic OHLC data is generated deterministically.

## Core capabilities (all implemented and working)

- **Replay engine**: play/pause, step one bar, restart, adjustable speed
  (0.5x–25x bars/sec), jump to a random or specific start date. Playhead is
  tracked **per instrument** so switching symbols preserves each market's time.
- **Instruments**: EURUSD, GBPUSD, AUDUSD, XAUUSD, BTCUSD (each USD-quoted).
- **Timeframes**: M1, M5, M15, M30, H1, H4, D1 (aggregated on demand from 1-min data).
- **Chart**: lightweight-charts candlesticks, live OHLC legend, per-trade
  entry/exit markers, price lines for entry & pending orders.
- **Orders**: market, limit, and stop; SL/TP set in pips; risk/reward/R:R preview.
  **Risk-based sizing** ("risk N% of balance" auto-computes lot size from the stop).
- **Pending orders**: limit/stop rest on the book and fill at their trigger during replay.
- **Position management**: open positions with live P&L, partial close (½),
  inline-editable SL/TP, and **draggable SL/TP lines on the chart**.
- **Account model**: balance, equity, floating P&L, used/free margin, margin level,
  leverage-aware. **Configurable starting balance**.
- **Journal & stats**: trade history, win rate, profit factor, drawdown, an
  **equity curve** sparkline, and **CSV export**.
- **Drawing tools**: trend line, horizontal line, rectangle, Fibonacci
  retracement, and a **measure/ruler** tool (pips / % / bars). Create, drag to
  move, drag endpoints to reshape, delete. Per-symbol.
- **Price alerts**: set a level, get a toast notification + line color change
  when replay reaches it; draggable to re-arm.
- **Persistence**: the whole session (account, trades, orders, alerts, drawings,
  replay position, starting balance) is saved to localStorage and resumes on refresh.
- **Keyboard**: Space = play/pause, Right arrow = step, Delete = remove selected
  drawing, Esc = cancel.

## Roadmap / not yet built

- Trade directly from the chart (drag to place entry + SL + TP before confirming)
- Multi-symbol watchlist sidebar
- Real market-data adapter (replace `getBaseCandles()` — see tech.md)
- Final polish/QA pass, then merge PR #1

## Important framing

This is an educational **simulator** on synthetic data. It is not connected to a
broker and is not financial advice.
