import { NotificationModel } from '../models/Notification';
import { logger } from '../utils/logger';

export class NotificationService {
  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
  }): Promise<any> {
    const notification = new NotificationModel({
      userId: data.userId,
      type: data.type as any,
      title: data.title,
      message: data.message,
      isRead: false,
      metadata: data.metadata,
      timestamp: new Date(),
    });
    await notification.save();
    return notification;
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 20): Promise<any> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      NotificationModel.find({ userId }).sort({ timestamp: -1 }).skip(skip).limit(limit),
      NotificationModel.countDocuments({ userId }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await NotificationModel.updateOne({ _id: notificationId, userId }, { isRead: true });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, isRead: false });
  }
}

export const notificationService = new NotificationService();
