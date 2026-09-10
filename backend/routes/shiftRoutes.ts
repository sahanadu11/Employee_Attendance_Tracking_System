import { Router } from 'express';
import { getShifts, createShift, updateShift } from '../controllers/shiftController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { createShiftSchema, updateShiftSchema } from '../validators';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getShifts);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(createShiftSchema), createShift);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(updateShiftSchema), updateShift);
export default router;
