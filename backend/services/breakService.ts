import { BreakRecordModel } from '../models/BreakRecord';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { logger } from '../utils/logger';

export class BreakService {
  async startBreak(data: {
    employeeId: string;
    eventTypeId: string;
    shiftId: string;
    flowId: string;
    sectionId: string;
    latitude?: number;
    longitude?: number;
    gpsAccuracy?: number;
    photoUrl?: string;
    allowedDurationMinutes: number;
  }): Promise<any> {
    const record = new BreakRecordModel({
      employeeId: data.employeeId,
      eventTypeId: data.eventTypeId,
      shiftId: data.shiftId,
      flowId: data.flowId,
      sectionId: data.sectionId,
      breakStart: new Date(),
      allowedDurationMinutes: data.allowedDurationMinutes,
      latitude: data.latitude,
      longitude: data.longitude,
      gpsAccuracy: data.gpsAccuracy,
      photoUrl: data.photoUrl,
      timestamp: new Date(),
    });
    await record.save();
    return { success: true, message: 'Break started', data: { breakRecordId: record._id } };
  }

  async endBreak(breakRecordId: string): Promise<any> {
    const record = await BreakRecordModel.findById(breakRecordId);
    if (!record) {
      throw { statusCode: 404, code: 'BREAK_NOT_FOUND', message: 'Break record not found' };
    }
    if (record.breakEnd) {
      throw { statusCode: 400, code: 'BREAK_ALREADY_ENDED', message: 'Break already ended' };
    }

    record.breakEnd = new Date();
    record.totalDurationMinutes = Math.round((record.breakEnd.getTime() - record.breakStart.getTime()) / 60000);
    record.excessDurationMinutes = Math.max(0, record.totalDurationMinutes - record.allowedDurationMinutes);
    await record.save();

    return {
      success: true,
      message: 'Break ended',
      data: {
        breakRecordId: record._id,
        durationMinutes: record.totalDurationMinutes,
        allowedDurationMinutes: record.allowedDurationMinutes,
        excessDurationMinutes: record.excessDurationMinutes,
      },
    };
  }

  async getActiveBreaks(employeeId?: string): Promise<any[]> {
    const query: any = { breakEnd: { $exists: false } };
    if (employeeId) query.employeeId = employeeId;
    return BreakRecordModel.find(query)
      .populate('employeeId', 'fullName employeeId department photo')
      .populate('eventTypeId', 'name code')
      .sort({ breakStart: -1 });
  }

  async getActiveBreakForEmployee(employeeId: string): Promise<any | null> {
    return BreakRecordModel.findOne({
      employeeId,
      breakEnd: { $exists: false },
    })
      .populate('eventTypeId', 'name code')
      .sort({ breakStart: -1 });
  }

  async getBreakHistory(employeeId: string, limit: number = 30): Promise<any[]> {
    return BreakRecordModel.find({ employeeId })
      .populate('eventTypeId', 'name code')
      .sort({ breakStart: -1 })
      .limit(limit);
  }
}

export const breakService = new BreakService();
