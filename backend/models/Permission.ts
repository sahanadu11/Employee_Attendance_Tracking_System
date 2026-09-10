import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IPermission extends Document {
  resource: string;
  action: string;
  description?: string;
  module: string;
  isActive: boolean;
  createdAt: Date;
}

const permissionSchema = new Schema<IPermission>({
  resource: { type: String, required: true, trim: true, },
  action: { type: String, required: true, trim: true, enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'ADMIN', 'EXPORT'] },
  description: { type: String },
  module: { type: String, required: true, trim: true, },
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true, collection: 'permissions' });

permissionSchema.index({ resource: 1, action: 1 });

export const PermissionModel = getModel<IPermission>('Permission', permissionSchema);
