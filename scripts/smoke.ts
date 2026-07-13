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

// 5. Pending limit/stop orders
store.resetAccount();
store.restartSession();
const p0 = useStore.getState().currentPrice();
store.placePendingOrder('buy', 'stop', 1, p0 + eur.pipSize * 10, null, null);
store.placePendingOrder('buy', 'limit', 1, p0 - eur.pipSize * 10, null, null);
assert(useStore.getState().pendingOrders.length === 2, 'two pending orders placed');

let filledAny = false;
for (let i = 0; i < 3000 && useStore.getState().pendingOrders.length > 0; i++) {
  const before = useStore.getState().positions.length;
  useStore.getState().stepForward();
  if (useStore.getState().positions.length > before) filledAny = true;
}
console.log(
  'pending remaining:', useStore.getState().pendingOrders.length,
  'positions:', useStore.getState().positions.length,
);
assert(filledAny, 'at least one pending order triggered into a position during replay');

// 6. Drawings CRUD
store.addDrawing({
  type: 'trendline',
  points: [{ time: p0, price: 1.1 }, { time: p0 + 3600, price: 1.12 }],
  color: '#2962ff',
});
assert(useStore.getState().drawings.length === 1, 'drawing added');
const drawId = useStore.getState().drawings[0].id;
store.updateDrawing(drawId, [
  { time: p0, price: 1.15 },
  { time: p0 + 3600, price: 1.16 },
]);
assert(
  useStore.getState().drawings[0].points[0].price === 1.15,
  'updateDrawing repositions anchor points',
);
store.removeDrawing(drawId);
assert(useStore.getState().drawings.length === 0, 'drawing removed');

// 7. Partial close
store.resetAccount();
store.openPosition('buy', 1, null, null);
const posId = useStore.getState().positions[0].id;
store.closePartial(posId, 0.4);
const rem = useStore.getState().positions[0];
console.log('remaining lots:', rem.lots, 'history:', useStore.getState().history.length);
assert(Math.abs(rem.lots - 0.6) < 1e-9, 'partial close leaves 0.6 lots');
assert(useStore.getState().history.length === 1, 'partial close books one closed trade');
store.closePartial(posId, 5); // more than remaining -> full close
assert(useStore.getState().positions.length === 0, 'closing >= remaining fully closes');

// 8. Jump / random start
store.randomStart();
console.log('playhead after random start:', useStore.getState().playhead());
assert(useStore.getState().playing === false, 'random start pauses replay');
store.jumpToTime(useStore.getState().baseCandles()[0].time);
assert(useStore.getState().playhead() === 0, 'jumpToTime maps to the correct index');

// 9. Measure drawing + configurable starting balance
store.addDrawing({
  type: 'measure',
  points: [{ time: p0, price: 1.1 }, { time: p0 + 3600, price: 1.11 }],
  color: '#2962ff',
});
assert(
  useStore.getState().drawings.some((d) => d.type === 'measure'),
  'measure drawing added',
);

store.setStartingBalance(25000);
assert(useStore.getState().startingBalance === 25000, 'starting balance updated');
assert(useStore.getState().balance === 25000, 'setStartingBalance resets balance to it');
assert(useStore.getState().history.length === 0, 'setStartingBalance clears history');
store.resetAccount();
assert(useStore.getState().balance === 25000, 'resetAccount uses the configured starting balance');

// 10. Price alerts
store.setStartingBalance(10000);
store.restartSession();
const ap = useStore.getState().currentPrice();
store.addAlert(ap + eur.pipSize * 10);
store.addAlert(ap - eur.pipSize * 10);
assert(useStore.getState().alerts.length === 2, 'two alerts added');
for (let i = 0; i < 3000 && useStore.getState().alerts.some((a) => !a.triggered); i++) {
  useStore.getState().stepForward();
}
console.log(
  'alerts triggered:', useStore.getState().alerts.filter((a) => a.triggered).length,
  'toasts:', useStore.getState().toasts.length,
);
assert(
  useStore.getState().alerts.some((a) => a.triggered),
  'at least one alert triggered during replay',
);
assert(useStore.getState().toasts.length > 0, 'triggering an alert pushes a toast');

console.log('\nALL SMOKE TESTS PASSED');
