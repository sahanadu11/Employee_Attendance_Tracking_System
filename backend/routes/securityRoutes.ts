import { Router } from 'express';
import { getFailedLogins, getLockedAccounts, getSecurityDashboard, unlockAccount, getSecurityEvents } from '../controllers/securityController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.get('/failed-logins', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getFailedLogins);
router.get('/locked-accounts', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getLockedAccounts);
router.get('/dashboard', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getSecurityDashboard);
router.get('/events', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getSecurityEvents);
router.post('/:userId/unlock', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), unlockAccount);
export default router;
