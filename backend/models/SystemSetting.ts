import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface ISystemSetting extends Document {
  key: string;
  value: any;
  description?: string;
}

const systemSettingSchema = new Schema<ISystemSetting>({
  key: { type: String, required: true, unique: true, trim: true, },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String },
}, { timestamps: true, collection: 'system_settings' });


export const SystemSettingModel = getModel<ISystemSetting>('SystemSetting', systemSettingSchema);
