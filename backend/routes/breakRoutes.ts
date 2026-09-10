import { Router } from 'express';
import { startBreak, endBreak, getActiveBreak, getAllActiveBreaks, getBreakHistory } from '../controllers/breakController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.post('/', authenticateToken, startBreak);
router.put('/:breakRecordId/end', authenticateToken, endBreak);
router.get('/active', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), getAllActiveBreaks);
router.get('/active/:employeeId?', authenticateToken, getActiveBreak);
router.get('/history/:employeeId?', authenticateToken, getBreakHistory);

export default router;
