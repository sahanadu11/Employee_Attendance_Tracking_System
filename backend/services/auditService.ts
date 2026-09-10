import { AuditLogModel } from '../models/AuditLog';
import { logger } from '../utils/logger';

export class AuditService {
  async createAuditEntry(data: {
    userId: string;
    userRole: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    result: 'SUCCESS' | 'FAILURE';
    details?: string;
  }): Promise<any> {
    const entry = new AuditLogModel({
      ...(data.userId ? { userId: data.userId } : {}),
      userRole: data.userRole || 'ANONYMOUS',
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      oldValue: data.oldValue,
      newValue: data.newValue,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      result: data.result,
      details: data.details,
    });
    await entry.save();
    return entry;
  }

  async getAuditLogs(filter: {
    userId?: string;
    entity?: string;
    action?: string;
    page?: number;
    limit?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any> {
    const { page = 1, limit = 20, ...query } = filter;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).populate('userId', 'fullName role'),
      AuditLogModel.countDocuments(query),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const auditService = new AuditService();
