import { Router } from 'express';
import { login, register, refreshToken, logout, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { loginSchema } from '../validators/authValidator';

const router = Router();
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', register);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getMe);
export default router;
