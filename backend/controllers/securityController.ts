import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SecurityEventModel } from '../models/SecurityEvent';
import { UserModel } from '../models/User';
import { auditService } from '../services/auditService';
import { securityService } from '../services/securityService';
import { logger } from '../utils/logger';

export const getFailedLogins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const events = await SecurityEventModel.find({ eventType: 'FAILED_LOGIN' })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ success: true, message: 'Failed logins retrieved', data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch failed logins', code: 'FETCH_ERROR' });
  }
};

export const getLockedAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await UserModel.find({ lockedUntil: { $gt: new Date() }, isActive: true });
    res.json({ success: true, message: 'Locked accounts retrieved', data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch locked accounts', code: 'FETCH_ERROR' });
  }
};

export const getSecurityDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [failedLogins, lockouts, gpsSuspicious, totalEvents] = await Promise.all([
      SecurityEventModel.countDocuments({ eventType: 'FAILED_LOGIN', timestamp: { $gte: today } }),
      SecurityEventModel.countDocuments({ eventType: 'LOCKOUT', timestamp: { $gte: today } }),
      SecurityEventModel.countDocuments({ eventType: 'GPS_SUSPICIOUS', timestamp: { $gte: today } }),
      SecurityEventModel.countDocuments({ timestamp: { $gte: today } }),
    ]);
    res.json({
      success: true,
      message: 'Security dashboard data',
      data: { failedLogins, lockouts, gpsSuspicious, totalEvents },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch security dashboard', code: 'FETCH_ERROR' });
  }
};

export const unlockAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findByIdAndUpdate(userId, { lockedUntil: undefined, failedAttempts: 0 }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    await auditService.createAuditEntry({
      userId: req.user?._id?.toString() || 'SYSTEM',
      userRole: req.user?.role || 'SYSTEM',
      action: 'ACCOUNT_UNLOCK',
      entity: 'User',
      entityId: userId,
      result: 'SUCCESS',
    });
    res.json({ success: true, message: 'Account unlocked', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to unlock account', code: 'UNLOCK_ERROR' });
  }
};

export const getSecurityEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const [events, total] = await Promise.all([
      SecurityEventModel.find()
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SecurityEventModel.countDocuments(),
    ]);
    res.json({ success: true, message: 'Security events retrieved', data: { events, total, page, limit } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch security events', code: 'FETCH_ERROR' });
  }
};
