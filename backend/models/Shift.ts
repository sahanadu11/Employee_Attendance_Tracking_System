import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IShift extends Document {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  lateThresholdMinutes: number;
  earlyLoginAllowanceMinutes: number;
  breakPolicy: {
    allowedDurationMinutes: number;
    maxDurationMinutes: number;
    requiresLocation: boolean;
    requiresPhoto: boolean;
  };
  lunchPolicy: {
    allowedDurationMinutes: number;
    maxDurationMinutes: number;
    requiresLocation: boolean;
    requiresPhoto: boolean;
  };
  teaBreakPolicy: {
    allowedDurationMinutes: number;
    maxDurationMinutes: number;
    requiresLocation: boolean;
    requiresPhoto: boolean;
  };
  signOutPolicy: {
    allowedDurationMinutes: number;
    maxDurationMinutes: number;
    requiresLocation: boolean;
    requiresPhoto: boolean;
  };
  gpsPolicy: {
    requireGps: boolean;
    requireAccuracy: number;
    geofenceRadius: number;
  };
  sectionIds: string[];
  flowIds: string[];
  employeeIds: string[];
  isActive: boolean;
  scheduleDays: string[];
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema = new Schema<IShift>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  startTime: { type: String, required: true, pattern: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  endTime: { type: String, required: true, pattern: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  gracePeriodMinutes: { type: Number, default: 15, required: true },
  lateThresholdMinutes: { type: Number, default: 30, required: true },
  earlyLoginAllowanceMinutes: { type: Number, default: 15, required: true },
  breakPolicy: {
    allowedDurationMinutes: { type: Number, default: 30 },
    maxDurationMinutes: { type: Number, default: 60 },
    requiresLocation: { type: Boolean, default: false },
    requiresPhoto: { type: Boolean, default: false },
  },
  lunchPolicy: {
    allowedDurationMinutes: { type: Number, default: 60 },
    maxDurationMinutes: { type: Number, default: 120 },
    requiresLocation: { type: Boolean, default: false },
    requiresPhoto: { type: Boolean, default: false },
  },
  teaBreakPolicy: {
    allowedDurationMinutes: { type: Number, default: 15 },
    maxDurationMinutes: { type: Number, default: 30 },
    requiresLocation: { type: Boolean, default: false },
    requiresPhoto: { type: Boolean, default: false },
  },
  signOutPolicy: {
    allowedDurationMinutes: { type: Number, default: 15 },
    maxDurationMinutes: { type: Number, default: 30 },
    requiresLocation: { type: Boolean, default: false },
    requiresPhoto: { type: Boolean, default: false },
  },
  gpsPolicy: {
    requireGps: { type: Boolean, default: true },
    requireAccuracy: { type: Number, default: 50 },
    geofenceRadius: { type: Number, default: 100 },
  },
  sectionIds: [{ type: Schema.Types.ObjectId, ref: 'Section' }],
  flowIds: [{ type: Schema.Types.ObjectId, ref: 'Flow' }],
  employeeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  isActive: { type: Boolean, default: true, required: true },
  scheduleDays: [{ type: String, required: true }],
}, { timestamps: true, collection: 'shifts' });


shiftSchema.index({ isActive: 1 });
shiftSchema.index({ startTime: 1 });
shiftSchema.index({ scheduleDays: 1 });

export const ShiftModel = getModel<IShift>('Shift', shiftSchema);
