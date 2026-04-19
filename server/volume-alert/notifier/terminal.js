import { createLogger, fmtVol } from '../logger.js';

const log = createLogger('alert');

export function notify(alert) {
  const ticker = (alert.ticker ?? '').padEnd(6);

  const parts = [];
  if (alert.deviation != null)
    parts.push(`${alert.deviation.toFixed(1)}x expected`);
  if (alert.volume != null)
    parts.push(`actual=${fmtVol(alert.volume)} expected=${fmtVol(alert.avgVolume)}`);
  if (alert.price != null)
    parts.push(`$${alert.price.toFixed(2)}`);

  log.log(`🔔 ${ticker} ${parts.join(' | ')}`);
}
