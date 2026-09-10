import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SectionModel } from '../models/Section';
import { auditService } from '../services/auditService';

export const getSections = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sections = await SectionModel.find().sort({ name: 1 });
    res.json({ success: true, message: 'Sections retrieved', data: sections });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch sections', code: 'FETCH_ERROR' });
  }
};

export const createSection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description } = req.body;
    const section = new SectionModel({ name, code, description });
    await section.save();
    await auditService.createAuditEntry({
      userId: req.user?._id?.toString() || 'SYSTEM',
      userRole: req.user?.role || 'SYSTEM',
      action: 'SECTION_CREATE',
      entity: 'Section',
      entityId: section._id.toString(),
      result: 'SUCCESS',
    });
    res.status(201).json({ success: true, message: 'Section created', data: section });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create section', code: 'CREATE_ERROR' });
  }
};

export const updateSection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const section = await SectionModel.findByIdAndUpdate(id, { name, code, description, updatedAt: new Date() }, { new: true });
    if (!section) {
      res.status(404).json({ success: false, message: 'Section not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'Section updated', data: section });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update section', code: 'UPDATE_ERROR' });
  }
};

export const getSectionDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = req.params.sectionId || req.user?.sectionId;
    const section = await SectionModel.findById(sectionId).populate('adminIds').populate('flowIds');
    if (!section) {
      res.status(404).json({ success: false, message: 'Section not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, message: 'Section dashboard data', data: section });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch section dashboard', code: 'FETCH_ERROR' });
  }
};
