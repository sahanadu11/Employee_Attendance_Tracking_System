import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface ISecurityEvent extends Document {
  userId: Schema.Types.ObjectId;
  eventType: 'FAILED_LOGIN' | 'LOCKOUT' | 'UNAUTHORIZED_ACCESS' | 'INVALID_EVENT' | 'GPS_SUSPICIOUS' | 'ADMIN_CHANGE' | 'SESSION_ACTIVITY';
  description: string;
  metadata?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  isResolved: boolean;
}

const securityEventSchema = new Schema<ISecurityEvent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  eventType: {
    type: String,
    enum: ['FAILED_LOGIN', 'LOCKOUT', 'UNAUTHORIZED_ACCESS', 'INVALID_EVENT', 'GPS_SUSPICIOUS', 'ADMIN_CHANGE', 'SESSION_ACTIVITY'],
    required: true,
  },
  description: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true, default: Date.now, },
  ipAddress: { type: String },
  userAgent: { type: String },
  isResolved: { type: Boolean, default: false },
}, { timestamps: false, collection: 'security_events' });

securityEventSchema.index({ userId: 1, timestamp: -1 });
securityEventSchema.index({ eventType: 1, timestamp: -1 });
securityEventSchema.index({ timestamp: -1 });

export const SecurityEventModel = getModel<ISecurityEvent>('SecurityEvent', securityEventSchema);
