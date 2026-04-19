import { config } from '../config/env.js';
import { create, getRecentForTicker } from '../dao/alertDao.js';
import { notify } from '../notifier/index.js';

async function isCoolingDown(ticker, type) {
  const sinceMs = Date.now() - config.alertCooldownHours * 60 * 60 * 1000;
  const recent  = await getRecentForTicker(ticker, type, sinceMs);
  return recent.length > 0;
}

/**
 * Check a quote for alert conditions.
 * @returns {boolean} true if an alert was fired
 */
export async function checkQuote(quote) {
  const { ticker, price, changePct, volume, avgVolume, projectedRatio } = quote;

  const volSpike  = projectedRatio != null && projectedRatio >= config.volSpikeRatio;
  const priceMove = changePct != null && Math.abs(changePct) >= config.priceMovePct;

  if (!volSpike && !priceMove) return false;

  const type = (volSpike && priceMove) ? 'both' : volSpike ? 'volume' : 'price';

  if (await isCoolingDown(ticker, type)) return false;

  const parts = [];
  if (volSpike)  parts.push(`projected volume ${projectedRatio.toFixed(1)}× avg`);
  if (priceMove) parts.push(`price ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`);

  const alert = await create({
    ticker, type, price, volume, avgVolume,
    deviation: projectedRatio,
    message:   parts.join(', '),
  });

  await notify(alert);
  return true;
}
