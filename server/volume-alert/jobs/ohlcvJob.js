import cron from 'node-cron';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { fetchAndStoreOhlcv } from '../services/ohlcvService.js';
import { createLogger } from '../logger.js';

const log = createLogger('ohlcv');

const TICKERS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../config/tickers.json',
);

function loadTickers() {
  try { return JSON.parse(readFileSync(TICKERS_PATH, 'utf8')); }
  catch { return []; }
}

export function startOhlcvJob() {
  cron.schedule(config.ohlcvCron, async () => {
    const tickers = loadTickers();
    const timer   = log.start(`Fetching ${tickers.length} tickers × daily bars…`);
    const { ok, skipped } = await fetchAndStoreOhlcv(tickers);
    timer.done(`${ok} ok, ${skipped} skipped`);
  });

  log.log(`Scheduled: ${config.ohlcvCron}`);
}
