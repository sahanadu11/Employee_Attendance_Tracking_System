import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ShiftModel } from '../models/Shift';
import { auditService } from '../services/auditService';

export const getShifts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shifts = await ShiftModel.find().sort({ name: 1 });
    res.json({ success: true, message: 'Shifts retrieved', data: shifts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch shifts', code: 'FETCH_ERROR' });
  }
};

export const createShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shift = new ShiftModel(req.body);
    await shift.save();
    await auditService.createAuditEntry({
      userId: req.user?._id?.toString() || 'SYSTEM',
      userRole: req.user?.role || 'SYSTEM',
      action: 'SHIFT_CREATE',
      entity: 'Shift',
      entityId: shift._id.toString(),
      result: 'SUCCESS',
    });
    res.status(201).json({ success: true, message: 'Shift created', data: shift });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create shift', code: 'CREATE_ERROR' });
  }
};

export const updateShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const shift = await ShiftModel.findByIdAndUpdate(id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!shift) {
      res.status(404).json({ success: false, message: 'Shift not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'Shift updated', data: shift });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update shift', code: 'UPDATE_ERROR' });
  }
};
