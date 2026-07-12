/* Runtime smoke test for the core replay/trading engine (no DOM). */
import { getBaseCandles } from '../src/lib/data';
import { aggregate } from '../src/lib/timeframe';
import { getInstrument } from '../src/lib/instruments';
import { useStore } from '../src/store/useStore';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok -', msg);
}

// 1. Data generation
const eur = getInstrument('EURUSD');
const base = getBaseCandles(eur);
console.log('EURUSD base candles:', base.length);
assert(base.length === 45 * 24 * 60, 'base candle count = 45 days of M1');
assert(base.every((c) => c.high >= c.low), 'high >= low for every candle');
assert(
  base.every((c) => c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close),
  'OHLC integrity (high is max, low is min)',
);

// 2. Aggregation
const h1 = aggregate(base, 60, 600);
assert(h1.length === Math.ceil(600 / 60) || h1.length === 10 || h1.length === 11, 'H1 bucket count reasonable for 600 M1');
const firstBucketOk = h1[0].time % 3600 === 0;
assert(firstBucketOk, 'H1 buckets aligned to the hour');
console.log('H1 bars from first 600 M1:', h1.length);

// 3. Trading flow through the store
const store = useStore.getState();
store.setSymbol('EURUSD');
const startBalance = useStore.getState().balance;
const price = useStore.getState().currentPrice();
console.log('start balance:', startBalance, 'price:', price);

// Open a buy with a tight TP just above and far SL, then replay forward.
store.openPosition('buy', 1, price - 0.01, price + eur.pipSize * 5);
assert(useStore.getState().positions.length === 1, 'position opened');

// Advance the replay until the position resolves or we run 500 steps.
for (let i = 0; i < 500 && useStore.getState().positions.length > 0; i++) {
  useStore.getState().stepForward();
}
const st = useStore.getState();
console.log('after replay: open =', st.positions.length, 'history =', st.history.length, 'balance =', st.balance.toFixed(2));
assert(st.history.length >= 1, 'the TP-protected trade eventually closed into history');
const closed = st.history[0];
console.log('closed reason:', closed.reason, 'pnl:', closed.pnl.toFixed(2), 'pips:', closed.pips.toFixed(1));
assert(Math.abs(st.balance - (startBalance + st.history.reduce((a, t) => a + t.pnl, 0))) < 1e-6, 'balance reconciles with realised P&L');

// 4. Derived margin math
store.openPosition('sell', 0.5, null, null);
const d = useStore.getState().derived();
console.log('derived:', JSON.stringify({ eq: d.equity.toFixed(2), fm: d.freeMargin.toFixed(2), um: d.usedMargin.toFixed(2) }));
assert(d.usedMargin > 0, 'used margin > 0 with an open position');
assert(Math.abs(d.equity - (useStore.getState().balance + d.floatingPnl)) < 1e-6, 'equity = balance + floating P&L');

console.log('\nALL SMOKE TESTS PASSED');
