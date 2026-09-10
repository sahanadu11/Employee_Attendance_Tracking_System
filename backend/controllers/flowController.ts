import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FlowModel } from '../models/Flow';
import { SectionModel } from '../models/Section';
import { auditService } from '../services/auditService';

export const getFlows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const flows = await FlowModel.find().populate('sectionId').sort({ name: 1 });
    res.json({ success: true, message: 'Flows retrieved', data: flows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch flows', code: 'FETCH_ERROR' });
  }
};

export const createFlow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, sectionId, employeeIds, shiftIds, attendanceSequence, locationPolicy, adminIds } = req.body;
    const flow = new FlowModel({ name, code, sectionId, employeeIds, shiftIds, attendanceSequence, locationPolicy, adminIds });
    await flow.save();
    await SectionModel.findByIdAndUpdate(sectionId, { $push: { flowIds: flow._id } });
    await auditService.createAuditEntry({
      userId: req.user?._id?.toString() || 'SYSTEM',
      userRole: req.user?.role || 'SYSTEM',
      action: 'FLOW_CREATE',
      entity: 'Flow',
      entityId: flow._id.toString(),
      result: 'SUCCESS',
    });
    res.status(201).json({ success: true, message: 'Flow created', data: flow });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create flow', code: 'CREATE_ERROR' });
  }
};

export const updateFlow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const flow = await FlowModel.findByIdAndUpdate(id, { ...updateData, updatedAt: new Date() }, { new: true });
    if (!flow) {
      res.status(404).json({ success: false, message: 'Flow not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'Flow updated', data: flow });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update flow', code: 'UPDATE_ERROR' });
  }
};
