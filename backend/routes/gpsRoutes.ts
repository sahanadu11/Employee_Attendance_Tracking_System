import { Router } from 'express';
import { validateLocation, getOfficeLocations, createOfficeLocation, getEmployeeLocations } from '../controllers/gpsController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { locationSchema } from '../validators';

const router = Router();
router.post('/validate', authenticateToken, validate(locationSchema), validateLocation);
router.get('/offices', authenticateToken, getOfficeLocations);
router.post('/offices', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), createOfficeLocation);
router.get('/:employeeId', authenticateToken, getEmployeeLocations);
export default router;
