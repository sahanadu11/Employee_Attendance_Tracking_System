import { Router } from 'express';
import { generateDailyReport, generateMonthlyReport, generateWeeklyReport, generateSummaryReport, exportCsvReport } from '../controllers/reportController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.get('/daily', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), generateDailyReport);
router.get('/weekly', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), generateWeeklyReport);
router.get('/monthly', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), generateMonthlyReport);
router.get('/summary', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), generateSummaryReport);
router.get('/export', authenticateToken, requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), exportCsvReport);
export default router;
