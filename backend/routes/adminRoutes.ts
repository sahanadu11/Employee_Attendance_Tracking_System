import { Router } from 'express';
import { getDashboardStats, getLiveEvents, adminOverride } from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.get('/stats', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getDashboardStats);
router.get('/live-events', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getLiveEvents);
router.put('/attendance/:eventId/override', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), adminOverride);
export default router;
