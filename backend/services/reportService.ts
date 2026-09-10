import { AttendanceEventModel } from '../models/AttendanceEvent';
import { EmployeeModel } from '../models/Employee';
import { ShiftModel } from '../models/Shift';
import { SectionModel } from '../models/Section';
import { FlowModel } from '../models/Flow';
import { BreakRecordModel } from '../models/BreakRecord';

export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  sectionId?: string;
  flowId?: string;
  shiftId?: string;
  employeeId?: string;
}

export class ReportService {
  async getDailyReport(date: Date = new Date(), filter: ReportFilter = {}): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query: any = {
      actualTime: { $gte: startOfDay, $lte: endOfDay },
    };

    if (filter.sectionId) query.sectionId = filter.sectionId;
    if (filter.flowId) query.flowId = filter.flowId;
    if (filter.shiftId) query.shiftId = filter.shiftId;
    if (filter.employeeId) query.employeeId = filter.employeeId;

    const events = await AttendanceEventModel.find(query)
      .populate('employeeId', 'fullName employeeId department jobTitle photo')
      .populate('eventTypeId', 'name code sequenceNumber')
      .populate('shiftId', 'name code startTime endTime')
      .populate('sectionId', 'name code')
      .populate('flowId', 'name code')
      .sort({ actualTime: 1 });

    const totalEvents = events.length;
    const onTimeCount = events.filter((e) => e.status === 'ON_TIME').length;
    const lateCount = events.filter((e) => e.status === 'LATE' || e.status === 'GRACE_PERIOD').length;
    const blockedCount = events.filter((e) => e.status === 'BLOCKED' || e.status === 'GPS_FAILURE').length;

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalEvents,
      onTimeCount,
      lateCount,
      blockedCount,
      events,
    };
  }

  async getMonthlyReport(year: number, month: number, filter: ReportFilter = {}): Promise<any> {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const match: any = {
      actualTime: { $gte: startOfMonth, $lte: endOfMonth },
    };

    if (filter.sectionId) match.sectionId = filter.sectionId;
    if (filter.flowId) match.flowId = filter.flowId;
    if (filter.shiftId) match.shiftId = filter.shiftId;
    if (filter.employeeId) match.employeeId = filter.employeeId;

    const summary = await AttendanceEventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employeeId',
          totalEvents: { $sum: 1 },
          onTimeCount: { $sum: { $cond: [{ $eq: ['$status', 'ON_TIME'] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
          gracePeriodCount: { $sum: { $cond: [{ $eq: ['$status', 'GRACE_PERIOD'] }, 1, 0] } },
          blockedCount: { $sum: { $cond: [{ $eq: ['$status', 'BLOCKED'] }, 1, 0] } },
          totalLateMinutes: { $sum: { $ifNull: ['$lateDurationMinutes', 0] } },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $project: {
          employeeId: '$_id',
          employeeCode: '$employee.employeeId',
          fullName: '$employee.fullName',
          department: '$employee.department',
          totalEvents: 1,
          onTimeCount: 1,
          lateCount: 1,
          gracePeriodCount: 1,
          blockedCount: 1,
          totalLateMinutes: 1,
          attendanceRate: {
            $cond: [
              { $gt: ['$totalEvents', 0] },
              { $multiply: [{ $divide: ['$onTimeCount', '$totalEvents'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { fullName: 1 } },
    ]);

    return {
      year,
      month,
      startOfMonth,
      endOfMonth,
      summary,
    };
  }

  async getWeeklyReport(date: Date = new Date(), filter: ReportFilter = {}): Promise<any> {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const match: any = {
      actualTime: { $gte: startOfWeek, $lte: endOfWeek },
    };

    if (filter.sectionId) match.sectionId = filter.sectionId;
    if (filter.flowId) match.flowId = filter.flowId;
    if (filter.shiftId) match.shiftId = filter.shiftId;
    if (filter.employeeId) match.employeeId = filter.employeeId;

    const daily = await AttendanceEventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$actualTime' } },
          totalEvents: { $sum: 1 },
          onTimeCount: { $sum: { $cond: [{ $eq: ['$status', 'ON_TIME'] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } },
          blockedCount: { $sum: { $cond: [{ $in: ['$status', ['BLOCKED', 'GPS_FAILURE']] }, 1, 0] } },
          totalLateMinutes: { $sum: { $ifNull: ['$lateDurationMinutes', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      startOfWeek,
      endOfWeek,
      daily,
    };
  }

  generateCsv(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

export const reportService = new ReportService();
