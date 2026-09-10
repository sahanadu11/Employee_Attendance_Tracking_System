import { Router } from 'express';
import { getSections, createSection, updateSection, getSectionDashboard } from '../controllers/sectionController';
import { authenticateToken } from '../middleware/auth';
import { requireRole, checkSectionPermission } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import { createSectionSchema, updateSectionSchema } from '../validators';

const router = Router();
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), getSections);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(createSectionSchema), createSection);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), validate(updateSectionSchema), updateSection);
router.get('/:sectionId/dashboard', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), checkSectionPermission, getSectionDashboard);
export default router;
