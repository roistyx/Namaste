const BASE = 'https://www.alphavantage.co/query';
const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || '';

export async function getWeeklyData(ticker) {
  const res = await fetch(
    `${BASE}?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=compact&apikey=${API_KEY}`
  );
  if (!res.ok) throw new Error(`Failed to fetch weekly data for ${ticker}`);
  const data = await res.json();
  if (data.Information) return null;

  const series = data['Time Series (Daily)'] || {};
  // Take 6 entries so we can compute 5 day-over-day changes
  const entries = Object.entries(series).slice(0, 6).reverse();
  return entries.slice(1).map(([date, ohlcv], i) => {
    const prevClose = parseFloat(entries[i][1]['4. close']);
    const close = parseFloat(ohlcv['4. close']);
    return {
      date,
      close,
      high: parseFloat(ohlcv['2. high']),
      low: parseFloat(ohlcv['3. low']),
      volume: parseInt(ohlcv['5. volume']),
      changePercent: ((close - prevClose) / prevClose) * 100,
    };
  });
}

export async function getMostActive() {
  const res = await fetch(`${BASE}?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
  if (!res.ok) throw new Error('Failed to fetch market data');
  const data = await res.json();
  if (data.Information) throw new Error('API limit reached or invalid key');
  const active = data.most_actively_traded || [];
  return active.slice(0, 10);
}

export async function getSentiment(ticker) {
  const res = await fetch(
    `${BASE}?function=NEWS_SENTIMENT&tickers=${ticker}&limit=10&apikey=${API_KEY}`
  );
  if (!res.ok) throw new Error(`Failed to fetch sentiment for ${ticker}`);
  const data = await res.json();
  if (data.Information) return null;

  const feed = data.feed || [];
  if (!feed.length) return { score: 0, label: 'Neutral', articles: 0 };

  let total = 0;
  let count = 0;
  for (const article of feed) {
    const tickerSentiment = (article.ticker_sentiment || []).find(
      (t) => t.ticker === ticker
    );
    if (tickerSentiment) {
      total += parseFloat(tickerSentiment.ticker_sentiment_score || 0);
      count++;
    }
  }

  const score = count > 0 ? total / count : 0;
  const label = score >= 0.15 ? 'Bullish' : score <= -0.15 ? 'Bearish' : 'Neutral';
  return { score: parseFloat(score.toFixed(4)), label, articles: count };
}
