import { Router } from 'express';
import { getEmployees, createEmployee, updateEmployee, toggleEmployeeStatus, getEmployeeTimeline } from '../controllers/employeeController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { checkSectionPermission, checkEmployeeScope } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { createEmployeeSchema } from '../validators';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), getEmployees);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(createEmployeeSchema), createEmployee);
router.put('/:employeeId', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), checkEmployeeScope, updateEmployee);
router.patch('/:employeeId/status', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), toggleEmployeeStatus);
router.get('/:employeeId/timeline', authenticateToken, checkEmployeeScope, getEmployeeTimeline);
export default router;
