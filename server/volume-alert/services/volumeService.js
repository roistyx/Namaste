import { marketFetch } from '../../schwabClient.js';
import { saveQuote } from '../dao/volumeDao.js';

const MARKET_OPEN_HOUR  = 9.5;  // 9:30 ET
const MARKET_CLOSE_HOUR = 16;   // 4:00 ET

function marketTimeProgress() {
  const now = new Date();
  // Approximate ET offset (UTC-5 or UTC-4; close enough for ratio)
  const etHour = (now.getUTCHours() - 4 + 24) % 24 + now.getUTCMinutes() / 60;
  if (etHour < MARKET_OPEN_HOUR || etHour >= MARKET_CLOSE_HOUR) return null;
  return (etHour - MARKET_OPEN_HOUR) / (MARKET_CLOSE_HOUR - MARKET_OPEN_HOUR);
}

export function isMarketOpen() {
  return marketTimeProgress() !== null;
}

const CHUNK_SIZE     = 20;
const CHUNK_PAUSE_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {{ quotes: object[], failedCount: number }}
 */
export async function pollTickers(tickers) {
  const progress = marketTimeProgress();
  if (progress === null) return { quotes: [], failedCount: 0 };

  const quotes = [];
  let failedCount = 0;

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    if (i > 0) await sleep(CHUNK_PAUSE_MS);

    const chunk = tickers.slice(i, i + CHUNK_SIZE);

    let data;
    try {
      data = await marketFetch('/quotes', { symbols: chunk.join(','), fields: 'quote,fundamental' });
    } catch (e) {
      if (failedCount === 0) console.error(`[VA:poll] first failure (chunk @${i}): ${e.message}`);
      failedCount += chunk.length;
      continue;
    }

    for (const ticker of chunk) {
      const entry = data[ticker];
      if (!entry?.quote) {
        failedCount++;
        continue;
      }

      const q      = entry.quote;
      const f      = entry.fundamental ?? {};
      const vol    = q.totalVolume ?? null;
      const avgVol = f.vol10DayAvg ?? null;
      const projectedRatio = (vol != null && avgVol != null && avgVol > 0 && progress > 0)
        ? (vol / avgVol) * (1 / progress)
        : null;

      const quote = {
        ticker,
        price:         q.lastPrice        ?? null,
        change:        q.netChange         ?? null,
        changePct:     q.netPercentChangeInDouble ?? null,
        volume:        vol,
        avgVolume:     avgVol,
        projectedRatio,
        ts:            new Date(),
      };

      await saveQuote(quote);
      quotes.push(quote);
    }
  }

  return { quotes, failedCount };
}
