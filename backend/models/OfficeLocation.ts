import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IOfficeLocation extends Document {
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  isActive: boolean;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const officeSchema = new Schema<IOfficeLocation>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  geofenceRadius: { type: Number, default: 100, required: true },
  isActive: { type: Boolean, default: true, required: true },
  address: { type: String, trim: true },
}, { timestamps: true, collection: 'office_locations' });

officeSchema.index({ isActive: 1 });
officeSchema.index({ name: 1 });

export const OfficeLocationModel = getModel<IOfficeLocation>('OfficeLocation', officeSchema);
