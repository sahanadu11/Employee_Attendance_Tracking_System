import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IAuditLog extends Document {
  userId: Schema.Types.ObjectId;
  userRole: string;
  action: string;
  entity: string;
  entityId?: Schema.Types.ObjectId;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  result: 'SUCCESS' | 'FAILURE';
  details?: string;
}

const auditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // optional: unknown caller (pre-auth) writes null
  userRole: { type: String, default: 'ANONYMOUS' },
  action: { type: String, required: true, },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, required: true, default: Date.now, },
  result: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
  details: { type: String },
}, { timestamps: false, collection: 'audit_logs' });

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userRole: 1, timestamp: -1 });

export const AuditLogModel = getModel<IAuditLog>('AuditLog', auditLogSchema);
