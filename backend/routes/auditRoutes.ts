import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getAuditLogs);
export default router;
