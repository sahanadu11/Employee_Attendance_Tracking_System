import { Request, Response } from 'express';
import { auditService } from '../services/auditService';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter: any = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.fromDate) filter.timestamp = { $gte: new Date(req.query.fromDate as string) };
    if (req.query.toDate) { if (!filter.timestamp) filter.timestamp = {}; filter.timestamp.$lte = new Date(req.query.toDate as string); }

    const result = await auditService.getAuditLogs({ ...filter, page, limit });
    res.json({ success: true, message: 'Audit logs retrieved', data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs', code: 'FETCH_ERROR' });
  }
};
