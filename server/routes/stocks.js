import { Router } from 'express';

const router = Router();
const BASE = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY || '';

const CANDIDATES = [
  'AAPL', 'TSLA', 'NVDA', 'AMD', 'AMZN', 'MSFT', 'META', 'GOOGL', 'NFLX', 'INTC',
  'BAC', 'F', 'PLTR', 'SOFI', 'NIO', 'AAL', 'CCL', 'SNAP', 'RIVN', 'UBER',
];

function unix(daysAgo = 0) {
  return Math.floor((Date.now() - daysAgo * 86400000) / 1000);
}

async function fetchCandles(symbol, daysBack) {
  const res = await fetch(
    `${BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${unix(daysBack)}&to=${unix()}&token=${API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.s === 'ok' && data.c?.length ? data : null;
}

const BULLISH = /\b(surges?|rallies|rally|gains?|rises?|jumps?|soars?|beats?|upgrades?|bullish|record)\b/i;
const BEARISH = /\b(falls?|drops?|declines?|plunges?|misses?|downgrades?|bearish|loss|slump|crash)\b/i;

// GET /api/stocks/active
router.get('/active', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });
  try {
    const results = await Promise.all(
      CANDIDATES.map(async (symbol) => {
        try {
          const data = await fetchCandles(symbol, 5);
          if (!data) return null;
          const i = data.c.length - 1;
          const prevClose = i > 0 ? data.c[i - 1] : data.o[0];
          return {
            ticker: symbol,
            price: data.c[i].toFixed(2),
            change_percentage: (((data.c[i] - prevClose) / prevClose) * 100).toFixed(2),
            volume: data.v[i],
          };
        } catch {
          return null;
        }
      })
    );
    res.json(results.filter(Boolean).sort((a, b) => b.volume - a.volume).slice(0, 10));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stocks/sentiment/:ticker
router.get('/sentiment/:ticker', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });
  const { ticker } = req.params;
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const r = await fetch(
      `${BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`
    );
    if (!r.ok) return res.status(r.status).json({ error: 'Finnhub error' });
    const articles = await r.json();
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.json({ score: 0, label: 'Neutral', articles: 0 });
    }
    const scores = articles.slice(0, 20).map((a) => {
      const text = `${a.headline} ${a.summary}`;
      if (BULLISH.test(text)) return 1;
      if (BEARISH.test(text)) return -1;
      return 0;
    });
    const score = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4));
    const label = score >= 0.15 ? 'Bullish' : score <= -0.15 ? 'Bearish' : 'Neutral';
    res.json({ score, label, articles: articles.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stocks/weekly/:ticker
router.get('/weekly/:ticker', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });
  const { ticker } = req.params;
  try {
    const data = await fetchCandles(ticker, 14);
    if (!data) return res.json(null);
    const len = data.c.length;
    const start = Math.max(0, len - 6);
    const slice = data.t.slice(start).map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: data.c[start + i],
      volume: data.v[start + i],
    }));
    res.json(
      slice.slice(1).map((e, i) => ({
        ...e,
        changePercent: ((e.close - slice[i].close) / slice[i].close) * 100,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
