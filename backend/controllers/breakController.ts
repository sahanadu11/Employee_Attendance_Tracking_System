import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { breakService } from '../services/breakService';

export const startBreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user?.employeeId || req.body.employeeId;
    const result = await breakService.startBreak({ ...req.body, employeeId });
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message, code: error.code || 'BREAK_ERROR' });
  }
};

export const endBreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { breakRecordId } = req.params;
    const result = await breakService.endBreak(breakRecordId);
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message, code: error.code || 'BREAK_ERROR' });
  }
};

export const getActiveBreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;
    if (!employeeId) {
      res.status(400).json({ success: false, message: 'Employee ID required', code: 'EMPLOYEE_REQUIRED' });
      return;
    }
    const activeBreak = await breakService.getActiveBreakForEmployee(employeeId);
    res.json({ success: true, data: activeBreak });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch active break', code: 'FETCH_ERROR' });
  }
};

export const getAllActiveBreaks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const breaks = await breakService.getActiveBreaks();
    res.json({ success: true, data: breaks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch active breaks', code: 'FETCH_ERROR' });
  }
};

export const getBreakHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;
    if (!employeeId) {
      res.status(400).json({ success: false, message: 'Employee ID required', code: 'EMPLOYEE_REQUIRED' });
      return;
    }
    const history = await breakService.getBreakHistory(employeeId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch break history', code: 'FETCH_ERROR' });
  }
};
