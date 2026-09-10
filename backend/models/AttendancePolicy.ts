import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IAttendancePolicy extends Document {
  name: string;
  code: string;
  lateThresholdMinutes: number;
  gracePeriodMinutes: number;
  earlyLoginAllowanceMinutes: number;
  requireGps: boolean;
  requirePhoto: boolean;
  requireFaceVerification: boolean;
  maxLateCountBeforeWarning: number;
  autoFlagLate: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const policySchema = new Schema<IAttendancePolicy>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  lateThresholdMinutes: { type: Number, default: 30 },
  gracePeriodMinutes: { type: Number, default: 15 },
  earlyLoginAllowanceMinutes: { type: Number, default: 15 },
  requireGps: { type: Boolean, default: true },
  requirePhoto: { type: Boolean, default: true },
  requireFaceVerification: { type: Boolean, default: false },
  maxLateCountBeforeWarning: { type: Number, default: 3 },
  autoFlagLate: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'attendance_policies' });

policySchema.index({ code: 1 });
policySchema.index({ isActive: 1 });

export const AttendancePolicyModel = getModel<IAttendancePolicy>('AttendancePolicy', policySchema);
