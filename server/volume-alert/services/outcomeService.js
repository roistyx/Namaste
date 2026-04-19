import { marketFetch } from '../../schwabClient.js';
import { getPending, updateOutcome } from '../dao/outcomeDao.js';

/** @returns {number} count of outcomes logged */
export async function resolveOutcomes() {
  const pending = await getPending();
  const now     = Date.now();
  let logged    = 0;

  await Promise.all(pending.map(async (outcome) => {
    try {
      const alertAge = now - new Date(outcome.createdAt).getTime();
      const data     = await marketFetch('/quotes', { symbols: outcome.ticker, fields: 'quote' });
      const currentPrice = data[outcome.ticker]?.quote?.lastPrice;
      if (currentPrice == null) return;

      const update = { currentPrice, checkedAt: new Date() };
      const alertPrice = outcome.alertPrice;

      if (alertPrice && currentPrice) {
        const pct = ((currentPrice - alertPrice) / alertPrice) * 100;
        if (alertAge >= 7 * 24 * 60 * 60 * 1000) {
          update.outcome1w = pct;
          update.resolved  = true;
        } else if (alertAge >= 24 * 60 * 60 * 1000) {
          update.outcome1d = pct;
        } else if (alertAge >= 60 * 60 * 1000) {
          update.outcome1h = pct;
        }
        logged++;
      }

      await updateOutcome(String(outcome._id), update);
    } catch { /* skip unreachable tickers */ }
  }));

  return logged;
}
