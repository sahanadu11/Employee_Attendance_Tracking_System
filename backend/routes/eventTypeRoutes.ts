import { Router } from 'express';
import { getEventTypes, createEventType } from '../controllers/eventTypeController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.get('/', authenticateToken, getEventTypes);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), createEventType);
export default router;
