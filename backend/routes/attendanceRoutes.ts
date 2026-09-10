import { Router } from 'express';
import { submitAttendance, getAttendanceHistory, getAttendanceStats, getMyPipeline } from '../controllers/attendanceController';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { attendanceSubmissionSchema } from '../validators';

const router = Router();
router.post('/', authenticateToken, validate(attendanceSubmissionSchema), submitAttendance);
router.get('/history', authenticateToken, getAttendanceHistory);
router.get('/stats', authenticateToken, getAttendanceStats);
router.get('/pipeline', authenticateToken, getMyPipeline);
export default router;
