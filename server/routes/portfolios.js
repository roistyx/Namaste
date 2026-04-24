import { Router } from 'express';
import { create, getAll, getById, addHolding } from '../dao/portfolioDao.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const portfolio = await getById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Not found' });
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, assetClass, baseCurrency } = req.body;
  if (!name || !assetClass || !baseCurrency) {
    return res.status(400).json({ error: 'name, assetClass, and baseCurrency are required' });
  }
  try {
    res.status(201).json(await create({ name: name.trim(), assetClass, baseCurrency }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/holdings', async (req, res) => {
  const { ticker, quantity, costBasis } = req.body;
  if (!ticker || quantity == null || costBasis == null) {
    return res.status(400).json({ error: 'ticker, quantity, and costBasis are required' });
  }
  try {
    res.status(201).json(await addHolding(req.params.id, { ticker, quantity, costBasis }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
