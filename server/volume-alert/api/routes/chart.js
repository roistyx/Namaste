import { Router } from 'express';
import { getChart } from '../controllers/chartController.js';

const router = Router();

router.get('/:ticker', getChart);

export default router;
