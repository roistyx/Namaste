import cron from 'node-cron';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { pollTickers, isMarketOpen } from '../services/volumeService.js';
import { checkQuote } from '../services/alertService.js';
import { createLogger } from '../logger.js';

const log = createLogger('poll');

const TICKERS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../config/tickers.json',
);

function loadTickers() {
  try { return JSON.parse(readFileSync(TICKERS_PATH, 'utf8')); }
  catch { return []; }
}

export function startPollJob() {
  cron.schedule(config.pollCron, async () => {
    if (!isMarketOpen()) return;

    const tickers = loadTickers();
    if (!tickers.length) return;

    const timer = log.start(`Polling ${tickers.length} tickers…`);
    const { quotes, failedCount } = await pollTickers(tickers);

    let alertsFired = 0;
    for (const quote of quotes) {
      if (await checkQuote(quote)) alertsFired++;
    }

    timer.done(`${quotes.length} ok, ${failedCount} failed, ${alertsFired} alerts fired`);
  });

  log.log(`Scheduled: ${config.pollCron}`);
}
