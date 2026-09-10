import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IDeviceSession extends Document {
  userId: Schema.Types.ObjectId;
  employeeId?: Schema.Types.ObjectId;
  refreshToken: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
  };
  ipAddress: string;
  isActive: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

const deviceSessionSchema = new Schema<IDeviceSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  refreshToken: { type: String, required: true, },
  deviceInfo: {
    userAgent: { type: String, required: true },
    platform: { type: String, required: true },
    browser: { type: String, required: true },
  },
  ipAddress: { type: String, required: true },
  isActive: { type: Boolean, default: true, required: true },
  lastActivityAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, },
}, { timestamps: true, collection: 'device_sessions' });

deviceSessionSchema.index({ refreshToken: 1 });
deviceSessionSchema.index({ userId: 1, isActive: 1 });

export const DeviceSessionModel = getModel<IDeviceSession>('DeviceSession', deviceSessionSchema);
