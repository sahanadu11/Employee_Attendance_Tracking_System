import { SecurityEventModel } from '../models/SecurityEvent';
import { UserModel } from '../models/User';
import { logger } from '../utils/logger';

export class SecurityService {
  async recordEvent(
    eventTypeOrParams: any,
    userId?: string,
    description?: string,
    metadata?: any
  ): Promise<any> {
    try {
      let params: {
        eventType: string;
        userId?: string;
        description: string;
        metadata?: any;
        ipAddress?: string;
        userAgent?: string;
      };

      if (typeof eventTypeOrParams === 'object' && eventTypeOrParams !== null) {
        params = eventTypeOrParams;
      } else {
        params = {
          eventType: eventTypeOrParams,
          userId: userId || undefined,
          description: description || '',
          metadata,
          ipAddress: metadata?.ipAddress || 'unknown',
          userAgent: metadata?.userAgent || 'unknown',
        };
      }

      const event = new SecurityEventModel({
        userId: params.userId || undefined,
        eventType: params.eventType as any,
        description: params.description,
        metadata: params.metadata,
        timestamp: new Date(),
        ipAddress: params.ipAddress || 'unknown',
        userAgent: params.userAgent || 'unknown',
        isResolved: false,
      });
      await event.save();
      logger.warn(`[SECURITY EVENT] ${params.eventType}: ${params.description}`, { userId: params.userId });
      return event;
    } catch (err: any) {
      logger.error(`Failed to record security event: ${err.message}`);
      return null;
    }
  }

  async resolveEvent(eventId: string, resolvedBy: string): Promise<any> {
    return SecurityEventModel.findByIdAndUpdate(
      eventId,
      { isResolved: true, resolvedAt: new Date(), resolvedBy },
      { new: true }
    );
  }

  async getRecentEvents(limit: number = 50): Promise<any[]> {
    return SecurityEventModel.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'email role employeeId');
  }
}

export const securityService = new SecurityService();
export const securityEventService = securityService;
