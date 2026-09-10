import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IRole extends Document {
  name: string;
  code: string;
  permissions: string[];
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  permissions: [{ type: String, required: true }],
  description: { type: String },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true, collection: 'roles' });

roleSchema.index({ code: 1 });
roleSchema.index({ isActive: 1 });

export const RoleModel = getModel<IRole>('Role', roleSchema);
