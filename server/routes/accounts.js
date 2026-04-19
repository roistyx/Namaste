import { Router } from 'express';
import { getDB } from '../db.js';

const router = Router();

// GET /api/account-names — returns all custom account names
router.get('/account-names', async (req, res) => {
  try {
    const names = await getDB().collection('account_names').find({}).toArray();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/account-names/:accountId — upsert a custom name
router.put('/account-names/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { name } = req.body;
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    await getDB().collection('account_names').updateOne(
      { accountId },
      { $set: { accountId, name: name.trim() } },
      { upsert: true },
    );
    res.json({ accountId, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
