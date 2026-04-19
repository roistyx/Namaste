import { getCandles } from '../../dao/ohlcvDao.js';

export async function getChart(req, res, next) {
  try {
    const { ticker } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    const candles = await getCandles(ticker.toUpperCase(), limit);
    res.json({ ticker, candles });
  } catch (err) {
    next(err);
  }
}
