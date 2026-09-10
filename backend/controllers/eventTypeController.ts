import { Request, Response } from 'express';
import { AttendanceEventTypeModel } from '../models/AttendanceEventType';
import { auditService } from '../services/auditService';

export const getEventTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventTypes = await AttendanceEventTypeModel.find().sort({ sequenceNumber: 1 });
    res.json({ success: true, message: 'Event types retrieved', data: eventTypes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch event types', code: 'FETCH_ERROR' });
  }
};

export const createEventType = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventType = new AttendanceEventTypeModel(req.body);
    await eventType.save();
    res.status(201).json({ success: true, message: 'Event type created', data: eventType });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create event type', code: 'CREATE_ERROR' });
  }
};
