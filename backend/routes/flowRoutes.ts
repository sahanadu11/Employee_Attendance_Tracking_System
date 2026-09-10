import { Router } from 'express';
import { getFlows, createFlow, updateFlow } from '../controllers/flowController';
import { authenticateToken } from '../middleware/auth';
import { requireRole, checkFlowPermission } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { createFlowSchema, updateFlowSchema } from '../validators';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'FLOW_ADMIN'), getFlows);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(createFlowSchema), createFlow);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'FLOW_ADMIN'), checkFlowPermission, validate(updateFlowSchema), updateFlow);
export default router;
