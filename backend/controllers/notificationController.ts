import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotificationModel } from '../models/Notification';
import { logger } from '../utils/logger';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id || req.user?.employeeId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [notifications, total, unreadCount] = await Promise.all([
      NotificationModel.find({ userId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      NotificationModel.countDocuments({ userId }),
      NotificationModel.countDocuments({ userId, isRead: false }),
    ]);

    res.json({
      success: true,
      message: 'Notifications retrieved',
      data: { notifications, total, unreadCount, page, limit },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch notifications: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', code: 'FETCH_ERROR' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await NotificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update notification', code: 'UPDATE_ERROR' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id || req.user?.employeeId;
    await NotificationModel.updateMany({ userId, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications read', code: 'UPDATE_ERROR' });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await NotificationModel.findByIdAndDelete(id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete notification', code: 'DELETE_ERROR' });
  }
};
