import { marketFetch } from '../../schwabClient.js';
import { upsert } from '../dao/ohlcvDao.js';

/** @returns {{ ok: number, skipped: number }} */
export async function fetchAndStoreOhlcv(tickers) {
  const today = new Date().toISOString().slice(0, 10);
  let ok = 0, skipped = 0;

  await Promise.all(tickers.map(async (ticker) => {
    try {
      const data = await marketFetch(`/${encodeURIComponent(ticker)}/pricehistory`, {
        periodType:    'day',
        period:        1,
        frequencyType: 'daily',
        frequency:     1,
      });

      if (!data?.candles?.length) { skipped++; return; }

      // Use the last candle (most recent trading day)
      const bar = data.candles[data.candles.length - 1];
      await upsert(ticker, today, {
        open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
      });
      ok++;
    } catch (e) {
      if (skipped === 0) console.error(`[VA:ohlcv] first failure (${ticker}): ${e.message}`);
      skipped++;
    }
  }));

  return { ok, skipped };
}
