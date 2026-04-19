import cron from 'node-cron';
import { syncTickers } from '../services/tickerSyncService.js';
import { createLogger } from '../logger.js';

const log = createLogger('sync');

const SYNC_CRON = '0 7 * * 1-5'; // 7:00 AM Mon–Fri, before market open

export async function startTickerSyncJob() {
  await syncTickers().catch((e) =>
    console.error('[VA:sync] startup sync failed:', e.message),
  );

  cron.schedule(SYNC_CRON, async () => {
    const timer   = log.start('Syncing tickers from portfolios…');
    const tickers = await syncTickers().catch((e) => {
      console.error('[VA:sync] daily sync failed:', e.message);
      return [];
    });
    timer.done(`${tickers.length} symbols written`);
  });

  log.log(`Scheduled: ${SYNC_CRON}`);
}
