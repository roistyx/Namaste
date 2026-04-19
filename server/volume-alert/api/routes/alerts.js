import { Router } from 'express';
import { listAlerts, dismissAlert } from '../controllers/alertController.js';

const router = Router();

router.get('/',             listAlerts);
router.post('/:id/dismiss', dismissAlert);

export default router;
