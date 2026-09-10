import mongoose, { Schema, Document } from 'mongoose';
import { AttendanceStatus, GpsStatus, VerificationResult, DeviceInfo } from '../shared/types';
import { getModel } from '../data/shim';

export interface IAttendanceEvent extends Document {
  employeeId: Schema.Types.ObjectId;
  eventTypeId: Schema.Types.ObjectId;
  shiftId?: Schema.Types.ObjectId;
  flowId?: Schema.Types.ObjectId;
  sectionId?: Schema.Types.ObjectId;
  scheduledTime?: Date;
  actualTime: Date;
  status: AttendanceStatus;
  lateDurationMinutes?: number;
  earlyDurationMinutes?: number;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  gpsStatus: GpsStatus;
  photoUrl?: string;
  faceVerificationResult?: VerificationResult;
  notes?: string;
  isIdempotentKey?: string;
  deviceInfo?: DeviceInfo;
  isAdminOverride: boolean;
  overrideBy?: Schema.Types.ObjectId;
  overrideReason?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceEventSchema = new Schema<IAttendanceEvent>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, },
  eventTypeId: { type: Schema.Types.ObjectId, ref: 'AttendanceEventType', required: true, },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
  flowId: { type: Schema.Types.ObjectId, ref: 'Flow' },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
  scheduledTime: { type: Date },
  actualTime: { type: Date, required: true },
  status: { type: String, enum: ['EARLY', 'ON_TIME', 'GRACE_PERIOD', 'LATE', 'MISSED', 'INVALID', 'BLOCKED', 'GPS_FAILURE', 'SECURITY_LOCK'], required: true, },
  lateDurationMinutes: { type: Number },
  earlyDurationMinutes: { type: Number },
  latitude: { type: Number },
  longitude: { type: Number },
  gpsAccuracy: { type: Number },
  gpsStatus: { type: String, enum: ['INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'INACCURATE', 'PERMISSION_DENIED'], default: 'UNAVAILABLE' },
  photoUrl: { type: String },
  faceVerificationResult: { type: String, enum: ['VERIFIED', 'FAILED', 'NOT_REQUIRED', 'UNAVAILABLE'] },
  notes: { type: String },
  isIdempotentKey: { type: String, },
  deviceInfo: {
    userAgent: { type: String },
    platform: { type: String },
    browser: { type: String },
    screenResolution: { type: String },
  },
  isAdminOverride: { type: Boolean, default: false },
  overrideBy: { type: Schema.Types.ObjectId, ref: 'User' },
  overrideReason: { type: String },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true, collection: 'attendance_events' });

attendanceEventSchema.index({ employeeId: 1, actualTime: -1 });
attendanceEventSchema.index({ employeeId: 1, eventTypeId: 1, actualTime: -1 });
attendanceEventSchema.index({ actualTime: -1 });
attendanceEventSchema.index({ isIdempotentKey: 1 }, { unique: true, partialFilterExpression: { isIdempotentKey: { $type: 'string' } } });
attendanceEventSchema.index({ status: 1 });
attendanceEventSchema.index({ sectionId: 1, actualTime: -1 });
attendanceEventSchema.index({ flowId: 1, actualTime: -1 });

export const AttendanceEventModel = getModel<IAttendanceEvent>('AttendanceEvent', attendanceEventSchema);
