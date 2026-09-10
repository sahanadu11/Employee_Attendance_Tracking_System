import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface INotification extends Document {
  userId: Schema.Types.ObjectId;
  type: 'LATE' | 'OUTSIDE_GEOFENCE' | 'GPS_FAILURE' | 'ACCOUNT_LOCK' | 'MISSED_EVENT' | 'ATTENDANCE_EXCEPTION' | 'ADMIN_ACTION' | 'SYSTEM_WARNING';
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  timestamp: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, },
  type: {
    type: String,
    enum: ['LATE', 'OUTSIDE_GEOFENCE', 'GPS_FAILURE', 'ACCOUNT_LOCK', 'MISSED_EVENT', 'ATTENDANCE_EXCEPTION', 'ADMIN_ACTION', 'SYSTEM_WARNING'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true, default: Date.now, },
}, { timestamps: false, collection: 'notifications' });

notificationSchema.index({ userId: 1, timestamp: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

export const NotificationModel = getModel<INotification>('Notification', notificationSchema);
