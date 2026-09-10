import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/settingsController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { updateSettingSchema } from '../validators';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), getSettings);
router.put('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(updateSettingSchema), updateSetting);
export default router;
