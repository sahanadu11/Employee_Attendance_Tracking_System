import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserModel } from '../models/User';
import { SectionModel } from '../models/Section';
import { FlowModel } from '../models/Flow';
import { EmployeeModel } from '../models/Employee';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { auditService } from '../services/auditService';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalEmployees, events, lateEvents, absentEvents, breakEvents, lockedAccounts] = await Promise.all([
      EmployeeModel.countDocuments({ isActive: true }),
      AttendanceEventModel.aggregate([{ $match: { actualTime: { $gte: today, $lt: tomorrow } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      AttendanceEventModel.countDocuments({ status: 'LATE', actualTime: { $gte: today, $lt: tomorrow } }),
      AttendanceEventModel.countDocuments({ status: 'MISSED', actualTime: { $gte: today, $lt: tomorrow } }),
      AttendanceEventModel.countDocuments({ eventTypeId: { $in: ['LUNCH_OUT', 'LUNCH_IN', 'TEA_OUT', 'TEA_IN'] }, actualTime: { $gte: today, $lt: tomorrow } }),
      UserModel.countDocuments({ lockedUntil: { $gt: new Date() }, isActive: true }),
    ]);

    const statusMap: any = {};
    events.forEach((e: any) => { statusMap[e._id] = e.count; });

    const present = statusMap['ON_TIME'] || 0;
    const onBreak = statusMap['LUNCH_OUT'] || 0;
    const outsideGeofence = statusMap['BLOCKED'] || 0;
    const gpsIssues = statusMap['GPS_FAILURE'] || 0;

    res.json({
      success: true,
      message: 'Dashboard stats retrieved',
      data: { totalEmployees, present, late: lateEvents, absent: absentEvents, onBreak, outsideGeofence, gpsIssues, lockedAccounts },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats', code: 'FETCH_ERROR' });
  }
};

export const getLiveEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await AttendanceEventModel.find().sort({ actualTime: -1 }).limit(limit * 2).populate('employeeId', 'fullName employeeId sectionId flowId shiftId photo')
      .populate('eventTypeId', 'name code sequenceNumber')
      .populate('shiftId', 'name code');
    const recentEvents = events.slice(0, limit).map((e: any) => ({
      employeeName: e.employeeId?.fullName || 'Unknown',
      employeeId: e.employeeId?.employeeId,
      employeePhoto: e.employeeId?.photo,
      section: e.employeeId?.sectionId?.name,
      flow: e.employeeId?.flowId?.name,
      shift: e.shiftId?.name,
      event: e.eventTypeId?.name,
      status: e.status,
      scheduledTime: e.scheduledTime,
      actualTime: e.actualTime,
      lateDurationMinutes: e.lateDurationMinutes,
      gpsStatus: e.gpsStatus,
      gpsAccuracy: e.gpsAccuracy,
      timestamp: e.actualTime,
    }));
    res.json({ success: true, message: 'Live events retrieved', data: recentEvents });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch live events', code: 'FETCH_ERROR' });
  }
};

export const adminOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { status, reason } = req.body;
    const event = await AttendanceEventModel.findById(eventId);
    if (!event) { res.status(404).json({ success: false, message: 'Event not found', code: 'NOT_FOUND' }); return; }
    const oldStatus = event.status;
    event.status = status;
    event.isAdminOverride = true;
    event.overrideBy = req.user?._id;
    event.overrideReason = reason;
    await event.save();
    await auditService.createAuditEntry({ userId: req.user?._id.toString(), userRole: req.user?.role, action: 'ADMIN_OVERRIDE', entity: 'AttendanceEvent', entityId: event._id.toString(), oldValue: { status: oldStatus }, newValue: { status }, result: 'SUCCESS', details: reason });
    res.json({ success: true, message: 'Attendance overridden', data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Override failed', code: 'OVERRIDE_ERROR' });
  }
};
