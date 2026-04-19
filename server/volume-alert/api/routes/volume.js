import { Router } from 'express';
import { getVolumeHistory } from '../controllers/volumeController.js';

const router = Router();

router.get('/:ticker', getVolumeHistory);

export default router;
