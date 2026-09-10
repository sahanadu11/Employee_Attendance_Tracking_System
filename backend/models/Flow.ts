import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IFlow extends Document {
  name: string;
  code: string;
  sectionId: Schema.Types.ObjectId;
  employeeIds: string[];
  shiftIds: string[];
  attendanceSequence: string[];
  locationPolicy?: {
    requireGeofence: boolean;
    geofenceRadius: number;
    maxAccuracy: number;
    checkOnEveryEvent: boolean;
  };
  adminIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const flowSchema = new Schema<IFlow>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  employeeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  shiftIds: [{ type: Schema.Types.ObjectId, ref: 'Shift' }],
  attendanceSequence: [{ type: String, required: true }],
  locationPolicy: {
    requireGeofence: { type: Boolean, default: true },
    geofenceRadius: { type: Number, default: 100 },
    maxAccuracy: { type: Number, default: 50 },
    checkOnEveryEvent: { type: Boolean, default: true },
  },
  adminIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
}, { timestamps: true, collection: 'flows' });


flowSchema.index({ sectionId: 1 });
flowSchema.index({ status: 1 });

export const FlowModel = getModel<IFlow>('Flow', flowSchema);
