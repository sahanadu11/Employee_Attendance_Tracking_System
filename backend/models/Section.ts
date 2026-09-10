import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface ISection extends Document {
  name: string;
  code: string;
  description?: string;
  adminIds: (string | import('mongoose').Types.ObjectId)[];
  flowIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  description: { type: String, maxlength: 500 },
  adminIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  flowIds: [{ type: Schema.Types.ObjectId, ref: 'Flow' }],
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true, collection: 'sections' });

sectionSchema.index({ code: 1 });
sectionSchema.index({ isActive: 1 });
sectionSchema.index({ adminIds: 1 });

export const SectionModel = getModel<ISection>('Section', sectionSchema);
