import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IAttendanceEventType extends Document {
  name: string;
  code: string;
  eventType: 'LOGIN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'TEA_OUT' | 'TEA_IN' | 'SIGN_OUT' | 'CUSTOM';
  sequenceNumber: number;
  required: boolean;
  allowedTimeWindowMinutes?: number;
  lateThresholdMinutes?: number;
  requiresGps: boolean;
  requiresPhoto: boolean;
  requiresFaceVerification: boolean;
  notesRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventTypeSchema = new Schema<IAttendanceEventType>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  eventType: { type: String, enum: ['LOGIN', 'LUNCH_OUT', 'LUNCH_IN', 'TEA_OUT', 'TEA_IN', 'SIGN_OUT', 'CUSTOM'], required: true },
  sequenceNumber: { type: Number, required: true, min: 1 },
  required: { type: Boolean, default: false, required: true },
  allowedTimeWindowMinutes: { type: Number },
  lateThresholdMinutes: { type: Number },
  requiresGps: { type: Boolean, default: false, required: true },
  requiresPhoto: { type: Boolean, default: false, required: true },
  requiresFaceVerification: { type: Boolean, default: false, required: true },
  notesRequired: { type: Boolean, default: false, required: true },
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true, collection: 'attendance_event_types' });

eventTypeSchema.index({ code: 1 });
eventTypeSchema.index({ sequenceNumber: 1 });
eventTypeSchema.index({ isActive: 1 });
eventTypeSchema.index({ eventType: 1 });

export const AttendanceEventTypeModel = getModel<IAttendanceEventType>('AttendanceEventType', eventTypeSchema);
