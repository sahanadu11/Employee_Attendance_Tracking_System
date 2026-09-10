import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IBreakRecord extends Document {
  employeeId: Schema.Types.ObjectId;
  eventTypeId: Schema.Types.ObjectId;
  shiftId: Schema.Types.ObjectId;
  flowId: Schema.Types.ObjectId;
  sectionId: Schema.Types.ObjectId;
  breakStart: Date;
  breakEnd?: Date;
  totalDurationMinutes?: number;
  allowedDurationMinutes: number;
  excessDurationMinutes?: number;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  photoUrl?: string;
  timestamp: Date;
  createdAt: Date;
}

const breakRecordSchema = new Schema<IBreakRecord>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, },
  eventTypeId: { type: Schema.Types.ObjectId, ref: 'AttendanceEventType', required: true },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
  flowId: { type: Schema.Types.ObjectId, ref: 'Flow', required: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  breakStart: { type: Date, required: true },
  breakEnd: { type: Date },
  totalDurationMinutes: { type: Number },
  allowedDurationMinutes: { type: Number, required: true },
  excessDurationMinutes: { type: Number },
  latitude: { type: Number },
  longitude: { type: Number },
  gpsAccuracy: { type: Number },
  photoUrl: { type: String },
  timestamp: { type: Date, required: true },
}, { timestamps: true, collection: 'break_records' });

breakRecordSchema.index({ employeeId: 1, breakStart: -1 });
breakRecordSchema.index({ eventTypeId: 1, breakStart: -1 });
breakRecordSchema.index({ shiftId: 1, breakStart: -1 });

export const BreakRecordModel = getModel<IBreakRecord>('BreakRecord', breakRecordSchema);
