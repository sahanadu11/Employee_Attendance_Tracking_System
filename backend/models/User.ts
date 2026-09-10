import mongoose, { Schema, Document } from 'mongoose';
import { getModel } from '../data/shim';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: string;
  employeeId?: string;
  sectionId?: string | import('mongoose').Types.ObjectId;
  flowId?: string | import('mongoose').Types.ObjectId;
  failedAttempts: number;
  lockedUntil?: Date;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  incrementFailedAttempts(): Promise<void>;
  resetFailedAttempts(): Promise<void>;
  lockAccount(durationMs: number): Promise<void>;
  isLocked(): boolean;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN', 'EMPLOYEE'], },
  employeeId: { type: String, },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
  flowId: { type: Schema.Types.ObjectId, ref: 'Flow' },
  failedAttempts: { type: Number, default: 0, required: true },
  lockedUntil: { type: Date },
  isActive: { type: Boolean, default: true, required: true },
  lastLoginAt: { type: Date },
  refreshToken: { type: String },
}, {
  timestamps: true,
  collection: 'users',
});

userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ employeeId: 1 });

userSchema.methods.incrementFailedAttempts = async function(): Promise<void> {
  this.failedAttempts += 1;
  if (this.failedAttempts >= parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3')) {
    const lockDuration = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30') * 60 * 1000;
    this.lockedUntil = new Date(Date.now() + lockDuration);
  }
  await this.save();
};

userSchema.methods.resetFailedAttempts = async function(): Promise<void> {
  this.failedAttempts = 0;
  this.lockedUntil = undefined;
  await this.save();
};

userSchema.methods.lockAccount = async function(durationMs: number): Promise<void> {
  this.lockedUntil = new Date(Date.now() + durationMs);
  this.failedAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3');
  await this.save();
};

userSchema.methods.isLocked = function(): boolean {
  if (!this.lockedUntil) return false;
  return this.lockedUntil > new Date();
};

export const UserModel = getModel<IUser>('User', userSchema);
