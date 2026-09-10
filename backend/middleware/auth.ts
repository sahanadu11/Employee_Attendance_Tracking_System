import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: any;
  userId?: any;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required', code: 'NO_TOKEN' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await UserModel.findById(decoded.userId).select('+passwordHash');

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Invalid or inactive user', code: 'INVALID_USER' });
      return;
    }

    if (user.isLocked()) {
      res.status(403).json({ success: false, message: 'Account is locked. Too many failed attempts.', code: 'ACCOUNT_LOCKED' });
      return;
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else {
      logger.warn(`Auth middleware error: ${error.message}`, { path: req.path });
      res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
  }
}

export async function refreshTokenHandler(req: AuthRequest, res: Response): Promise<void> {
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

    const accessToken = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken, refreshToken: newRefreshToken, user: { role: user.role, employeeId: user.employeeId } },
    });
  } catch (error: any) {
    res.status(403).json({ success: false, message: 'Invalid refresh token', code: 'INVALID_REFRESH' });
  }
}

export function generateTokens(userId: string, role: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}
