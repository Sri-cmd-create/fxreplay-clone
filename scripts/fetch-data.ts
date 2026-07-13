/**
 * Download historical OHLC data from Dukascopy and save as JSON files.
 * Run with: npx tsx scripts/fetch-data.ts
 *
 * Fetches 45 days of 1-minute candles for each instrument.
 * Output goes to public/data/<SYMBOL>.json
 */
import { getHistoricalRates } from 'dukascopy-node';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const INSTRUMENTS = [
  { symbol: 'EURUSD', dukascopyId: 'eurusd' },
  { symbol: 'GBPUSD', dukascopyId: 'gbpusd' },
  { symbol: 'AUDUSD', dukascopyId: 'audusd' },
  { symbol: 'XAUUSD', dukascopyId: 'xauusd' },
  { symbol: 'BTCUSD', dukascopyId: 'btcusd' },
];

const DAYS = 45;
const OUT_DIR = join(process.cwd(), 'public', 'data');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // yesterday to ensure data is available
  endDate.setUTCHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DAYS);

  console.log(`Fetching ${DAYS} days of M1 data: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);

  for (const inst of INSTRUMENTS) {
    console.log(`  ${inst.symbol} (${inst.dukascopyId})...`);
    try {
      const data = await getHistoricalRates({
        instrument: inst.dukascopyId,
        dates: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        timeframe: 'm1',
        format: 'json',
        // @ts-expect-error dukascopy-node types are imprecise
        priceType: 'bid',
      });

      // data is an array of { timestamp, open, high, low, close, volume }
      const candles = (data as Array<{ timestamp: number; open: number; high: number; low: number; close: number }>).map((c) => ({
        time: Math.floor(c.timestamp / 1000), // ms -> seconds
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const outPath = join(OUT_DIR, `${inst.symbol}.json`);
      writeFileSync(outPath, JSON.stringify(candles));
      console.log(`    -> ${candles.length} candles saved to ${outPath}`);
    } catch (err) {
      console.error(`    ERROR for ${inst.symbol}:`, (err as Error).message);
    }
  }

  console.log('\nDone. Run `npm run dev` and the app will use real data if available.');
}

main();
