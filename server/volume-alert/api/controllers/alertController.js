import { getActive, dismiss } from '../../dao/alertDao.js';

export async function listAlerts(req, res, next) {
  try {
    const limit  = parseInt(req.query.limit, 10) || 50;
    const alerts = await getActive(limit);
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    next(err);
  }
}

export async function dismissAlert(req, res, next) {
  try {
    const { id } = req.params;
    const success = await dismiss(id);
    if (!success) {
      return res.status(404).json({ error: 'Alert not found or already dismissed.' });
    }
    res.json({ ok: true, id });
  } catch (err) {
    if (err.message && err.message.includes('ObjectId')) {
      return res.status(400).json({ error: 'Invalid alert ID format.' });
    }
    next(err);
  }
}
