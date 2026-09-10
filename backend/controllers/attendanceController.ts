import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { EmployeeModel } from '../models/Employee';
import { attendanceEngine } from '../services/attendanceEngine';
import { stateMachineService } from '../services/stateMachineService';
import { auditService } from '../services/auditService';

/** GET /attendance/pipeline — the caller's attendance sequence with per-step status. */
export const getMyPipeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await EmployeeModel.findOne({ employeeId: req.user?.employeeId });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee profile not found for this account', code: 'NOT_FOUND' });
      return;
    }
    const pipeline = await stateMachineService.getEmployeePipeline(
      employee._id.toString(),
      employee.flowId ? employee.flowId.toString() : undefined
    );
    res.json({ success: true, message: 'Pipeline retrieved', data: pipeline });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch pipeline', code: 'FETCH_ERROR' });
  }
};

export const submitAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await attendanceEngine.submitAttendance({
      employeeId: req.user.employeeId || req.body.employeeId,
      eventTypeId: req.body.eventTypeId,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      gpsAccuracy: req.body.gpsAccuracy,
      photoUrl: req.body.photoUrl,
      faceVerificationResult: req.body.faceVerificationResult,
      notes: req.body.notes,
      deviceInfo: req.body.deviceInfo,
      isIdempotentKey: req.body.isIdempotentKey,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message, code: error.code || 'ATTENDANCE_ERROR' });
  }
};

export const getAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { search, employeeId, sectionId, flowId, shiftId, event, status, gpsStatus, fromDate, toDate } = req.query;

    const query: any = {};
    if (employeeId) query.employeeId = employeeId;
    if (sectionId) query.sectionId = sectionId;
    if (flowId) query.flowId = flowId;
    if (shiftId) query.shiftId = shiftId;
    if (event) query.eventTypeId = event;
    if (status) query.status = status;
    if (gpsStatus) query.gpsStatus = gpsStatus;
    if (fromDate || toDate) {
      query.actualTime = {};
      if (fromDate) query.actualTime.$gte = new Date(fromDate as string);
      if (toDate) query.actualTime.$lte = new Date(toDate as string);
    }
    if (req.user?.role === 'SECTION_ADMIN' && req.user?.sectionId) query.sectionId = req.user.sectionId;
    if (search) {
      const emp = await EmployeeModel.findOne({ $or: [{ fullName: { $regex: search, $options: 'i' } }, { employeeId: { $regex: search, $options: 'i' } }] });
      if (emp) query.employeeId = emp._id;
    }

    const [events, total] = await Promise.all([
      AttendanceEventModel.find(query).sort({ actualTime: -1 }).populate('employeeId', 'fullName employeeId photo sectionId flowId shiftId').populate('eventTypeId').populate('shiftId').skip((page - 1) * limit).limit(limit),
      AttendanceEventModel.countDocuments(query),
    ]);
    res.json({ success: true, message: 'Attendance history retrieved', data: { events, total, page, limit } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance history', code: 'FETCH_ERROR' });
  }
};

export const getAttendanceStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [stats, totalToday] = await Promise.all([
      AttendanceEventModel.aggregate([
        { $match: { actualTime: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AttendanceEventModel.countDocuments({ actualTime: { $gte: today, $lt: tomorrow } }),
    ]);

    const statusMap: any = {};
    stats.forEach((s: any) => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      message: 'Attendance stats retrieved',
      data: {
        total: totalToday,
        present: statusMap['ON_TIME'] || 0,
        late: (statusMap['LATE'] || 0) + (statusMap['GRACE_PERIOD'] || 0),
        absent: statusMap['MISSED'] || 0,
        gpsIssues: (statusMap['GPS_FAILURE'] || 0) + (statusMap['BLOCKED'] || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats', code: 'FETCH_ERROR' });
  }
};
