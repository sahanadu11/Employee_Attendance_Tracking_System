import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IEmployee extends Document {
  employeeId: string;
  fullName: string;
  photo?: string;
  phone: string;
  email: string;
  department: string;
  sectionId: Schema.Types.ObjectId;
  flowId: Schema.Types.ObjectId;
  shiftId: Schema.Types.ObjectId;
  jobTitle: string;
  joiningDate: Date;
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'SUSPENDED';
  attendancePolicyId?: Schema.Types.ObjectId;
  gpsPolicyId?: Schema.Types.ObjectId;
  officeLocationId?: Schema.Types.ObjectId;
  isActive: boolean;
  eventFlowConfig?: Array<{
    eventTypeId: Schema.Types.ObjectId;
    sequenceOrder: number;
    required: boolean;
    allowedWindowMinutes?: Number;
  }>;
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>({
  employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true, },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  photo: { type: String },
  phone: { type: String, required: true, trim: true, },
  email: { type: String, trim: true, lowercase: true, },
  department: { type: String, required: true, trim: true, maxlength: 100 },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true, },
  flowId: { type: Schema.Types.ObjectId, ref: 'Flow', required: true, },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
  jobTitle: { type: String, required: true, trim: true, maxlength: 100 },
  joiningDate: { type: Date, required: true },
  employmentStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'SUSPENDED'], default: 'ACTIVE', required: true, },
  attendancePolicyId: { type: Schema.Types.ObjectId, ref: 'AttendancePolicy' },
  gpsPolicyId: { type: Schema.Types.ObjectId, ref: 'GpsPolicy' },
  officeLocationId: { type: Schema.Types.ObjectId, ref: 'OfficeLocation' },
  isActive: { type: Boolean, default: true, required: true },
  eventFlowConfig: [{
    eventTypeId: { type: Schema.Types.ObjectId, ref: 'AttendanceEventType' },
    sequenceOrder: { type: Number, required: true },
    required: { type: Boolean, default: false },
    allowedWindowMinutes: { type: Number },
  }],
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relation: { type: String },
  },
}, { timestamps: true, collection: 'employees' });

employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ sectionId: 1 });
employeeSchema.index({ flowId: 1 });
employeeSchema.index({ shiftId: 1 });
employeeSchema.index({ employmentStatus: 1 });
employeeSchema.index({ isActive: 1, sectionId: 1 });
employeeSchema.index({ fullName: 'text', employeeId: 'text', email: 'text' });

export const EmployeeModel = getModel<IEmployee>('Employee', employeeSchema);
