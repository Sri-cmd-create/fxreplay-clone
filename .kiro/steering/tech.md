# Tech stack & workflow

## Stack

- **Vite** (build/dev server) + **React 18** + **TypeScript** (strict).
- **lightweight-charts v4** (`addCandlestickSeries`, price lines, markers) for the chart.
- **Zustand v4** for state (single store, `src/store/useStore.ts`).
- **Tailwind CSS v3** for styling. Custom palette in `tailwind.config.js`
  (panel `#131722`, up `#26a69a`, down `#ef5350`, accent `#2962ff`, muted `#787b86`).

## Commands

```bash
npm install        # once
npm run dev        # dev server at http://localhost:5173
npm run build      # tsc -b (typecheck) + vite build — MUST stay green
npm run preview    # preview the production build
```

There is no unit-test runner. A **headless engine smoke test** exercises the
store/domain logic and must pass:

```bash
npx tsx scripts/smoke.ts     # or: bun scripts/smoke.ts
```

Add assertions to `scripts/smoke.ts` when you add store logic (data generation,
aggregation, trading math, orders, drawings, alerts, account settings are all covered).

## Conventions

- **TypeScript strict** with `noUnusedLocals`/`noUnusedParameters` on — no unused
  vars/params or the build fails. Prefer `type`-only imports for types.
- Keep domain/math logic in `src/lib/*` (pure, testable). UI in `src/components/*`.
  All shared state and business rules live in the single Zustand store.
- Money math: every instrument is USD-quoted, so
  `profit = (exit - entry) * dir * lots * contractSize`; margin =
  `lots * contractSize * price / leverage`. Times are **UNIX seconds (UTC)**.
- Use the custom Tailwind color tokens, not raw hex, in classNames where possible.
- Avoid emojis in code. Don't add README/docs files unless asked.

## Chart / overlay gotchas (read before touching Chart.tsx or DrawingLayer.tsx)

- Candle data is fed via `series.setData` on symbol/timeframe change and
  incrementally via `series.update` as replay advances (see `Chart.tsx`).
- Drawings, SL/TP lines, and alert lines are an **SVG overlay** (`DrawingLayer.tsx`)
  on top of the chart. It maps price/time <-> pixels using
  `series.priceToCoordinate` and `timeScale().logicalToCoordinate` with
  `logical = (time - firstBarTime) / tfSeconds`, so anchors are timeframe-independent.
- Pointer events: the overlay div is `pointer-events:none` in cursor mode (chart
  pans) and `pointer-events:auto` in draw mode. Dragging uses **pointer capture**
  on the target element so it tracks even off the thin shape. Do NOT rely on a
  child overriding `pointer-events:none` on the `<svg>` root — it's unreliable
  across browsers (this caused an earlier bug).
- The overlay re-renders on chart pan/zoom/autoscale via a small rAF loop that
  detects viewport-signature changes.

## Sandbox limitation (historical note)

The web sandbox this was built in blocked long-running server processes, so the
dev server could not be launched there — verification relied on `npm run build`
plus `scripts/smoke.ts`. In the desktop app you can just `npm run dev`.
