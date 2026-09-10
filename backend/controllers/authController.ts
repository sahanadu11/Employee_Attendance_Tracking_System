import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';
import { RoleModel } from '../models/Role';
import { DeviceSessionModel } from '../models/DeviceSession';
import { auditService } from '../services/auditService';
import { securityEventService } from '../services/securityService';
import { logger } from '../utils/logger';
import { validate } from '../middleware/validation';
import { loginSchema, registerSchema } from '../validators/authValidator';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';

    const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      await securityEventService.recordEvent('FAILED_LOGIN', '', 'User not found', { email, ipAddress, userAgent });
      await auditService.createAuditEntry({ userId: '', userRole: '', action: 'LOGIN', entity: 'User', result: 'FAILURE', details: 'User not found', ipAddress, userAgent });
      res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is disabled. Contact your administrator.', code: 'ACCOUNT_DISABLED' });
      return;
    }

    if (user.isLocked()) {
      const lockRemaining = user.lockedUntil ? Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000) : 0;
      await securityEventService.recordEvent('LOCKOUT', user._id.toString(), 'Login attempted while locked', { ipAddress, userAgent });
      res.status(403).json({
        success: false,
        message: `Too many failed attempts. Your account has been temporarily locked. Try again in ${lockRemaining} minutes.`,
        code: 'ACCOUNT_LOCKED',
        data: { lockedUntilMinutes: lockRemaining },
      });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await user.incrementFailedAttempts();
      const attemptsLeft = Math.max(0, parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3') - user.failedAttempts);
      await securityEventService.recordEvent('FAILED_LOGIN', user._id.toString(), `Invalid password. ${attemptsLeft} attempts remaining.`, { ipAddress, userAgent });
      await auditService.createAuditEntry({ userId: user._id.toString(), userRole: user.role, action: 'LOGIN', entity: 'User', entityId: user._id.toString(), result: 'FAILURE', details: 'Invalid password', ipAddress, userAgent });

      if (user.isLocked()) {
        res.status(403).json({
          success: false,
          message: 'Too many failed attempts. Your account has been temporarily locked.',
          code: 'ACCOUNT_LOCKED',
        });
      } else {
        res.status(401).json({
          success: false,
          message: `Invalid credentials. ${attemptsLeft} attempt(s) remaining.`,
          code: 'INVALID_CREDENTIALS',
          data: { attemptsRemaining: attemptsLeft },
        });
      }
      return;
    }

    // Success — reset failed attempts
    await user.resetFailedAttempts();
    user.lastLoginAt = new Date();

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role, employeeId: user.employeeId, sectionId: user.sectionId, flowId: user.flowId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    user.refreshToken = refreshToken;
    await user.save();

    // Record device session
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Edg)\/([\d.]+)/);
    const platform = (req.headers['sec-ch-ua-platform'] as string)?.replace(/"/g, '') || (userAgent.includes('Mobile') ? 'Mobile' : 'Desktop');
    await DeviceSessionModel.create({
      userId: user._id,
      refreshToken,
      deviceInfo: {
        userAgent: userAgent || 'Unknown client',
        platform: platform || 'Unknown',
        browser: browserMatch ? browserMatch[1] : 'Browser',
      },
      ipAddress: ipAddress || '0.0.0.0',
      isActive: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    await auditService.createAuditEntry({ userId: user._id.toString(), userRole: user.role, action: 'LOGIN', entity: 'User', entityId: user._id.toString(), result: 'SUCCESS', ipAddress, userAgent });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          sectionId: user.sectionId,
          flowId: user.flowId,
        },
      },
    });
  } catch (error: any) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: 'Login failed', code: 'LOGIN_ERROR' });
  }
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, role, employeeId, sectionId, flowId, fullName } = req.body;

    // Only authorized admins can create users
    if (!req.user || !['SUPER_ADMIN', 'MAIN_ADMIN'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Only authorized administrators can create user accounts', code: 'FORBIDDEN' });
      return;
    }

    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, message: 'User already exists', code: 'DUPLICATE_USER' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new UserModel({
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      employeeId,
      sectionId,
      flowId,
      isActive: true,
    });
    await user.save();

    await auditService.createAuditEntry({
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user._id.toString(),
      result: 'SUCCESS',
      details: `Created user ${email} with role ${role}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'User created', data: { userId: user._id } });
  } catch (error: any) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Registration failed', code: 'REGISTRATION_ERROR' });
  }
};

export const refreshTokenHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token required', code: 'NO_REFRESH_TOKEN' });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = await UserModel.findById(decoded.userId);

    if (!user || !user.isActive || user.refreshToken !== refreshToken) {
      res.status(403).json({ success: false, message: 'Invalid refresh token', code: 'INVALID_REFRESH' });
      return;
    }

    if (user.isLocked()) {
      res.status(403).json({ success: false, message: 'Account is locked', code: 'ACCOUNT_LOCKED' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role, employeeId: user.employeeId, sectionId: user.sectionId, flowId: user.flowId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const newRefreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: { id: user._id, role: user.role, employeeId: user.employeeId, sectionId: user.sectionId },
      },
    });
  } catch (error: any) {
    res.status(403).json({ success: false, message: 'Invalid refresh token', code: 'INVALID_REFRESH' });
  }
};

export const refreshToken = refreshTokenHandler;

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    // Revoke refresh token
    await UserModel.findByIdAndUpdate(userId, { refreshToken: undefined });

    // Deactivate device sessions
    await DeviceSessionModel.updateMany({ userId, isActive: true }, { isActive: false, logoutAt: new Date() });

    await auditService.createAuditEntry({
      userId: userId.toString(),
      userRole: (req as any).user?.role,
      action: 'LOGOUT',
      entity: 'Session',
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Logout failed', code: 'LOGOUT_ERROR' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id;
    const user = await UserModel.findById(userId).select('-passwordHash -refreshToken');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'User retrieved', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get user', code: 'FETCH_ERROR' });
  }
};
