import { getRecent } from '../../dao/volumeDao.js';

export async function getVolumeHistory(req, res, next) {
  try {
    const { ticker } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    const quotes = await getRecent(ticker.toUpperCase(), limit);
    res.json({ ticker, quotes });
  } catch (err) {
    next(err);
  }
}
