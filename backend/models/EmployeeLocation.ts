import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IEmployeeLocation extends Document {
  employeeId: Schema.Types.ObjectId;
  latitude: Number;
  longitude: Number;
  accuracy: Number;
  timestamp: Date;
  insideGeofence: boolean;
  officeLocationId?: Schema.Types.ObjectId;
  createdAt: Date;
}

const employeeLocationSchema = new Schema<IEmployeeLocation>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  timestamp: { type: Date, required: true, },
  insideGeofence: { type: Boolean, required: true },
  officeLocationId: { type: Schema.Types.ObjectId, ref: 'OfficeLocation' },
}, { timestamps: true, collection: 'employee_locations' });

employeeLocationSchema.index({ employeeId: 1, timestamp: -1 });
employeeLocationSchema.index({ timestamp: -1 });
employeeLocationSchema.index({ officeLocationId: 1, timestamp: -1 });

export const EmployeeLocationModel = getModel<IEmployeeLocation>('EmployeeLocation', employeeLocationSchema);
