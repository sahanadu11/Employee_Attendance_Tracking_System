import { Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { logger } from '../utils/logger';

export const generateDailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const { sectionId, flowId, shiftId, employeeId } = req.query as any;

    const report = await reportService.getDailyReport(date, {
      sectionId,
      flowId,
      shiftId,
      employeeId,
    });

    res.json({ success: true, message: 'Daily report generated', data: report });
  } catch (error: any) {
    logger.error(`Failed to generate daily report: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate report', code: 'REPORT_ERROR' });
  }
};

export const generateMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const { sectionId, flowId, shiftId, employeeId } = req.query as any;

    const report = await reportService.getMonthlyReport(year, month, {
      sectionId,
      flowId,
      shiftId,
      employeeId,
    });

    res.json({ success: true, message: 'Monthly report generated', data: report });
  } catch (error: any) {
    logger.error(`Failed to generate monthly report: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate monthly report', code: 'REPORT_ERROR' });
  }
};

export const generateWeeklyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const { sectionId, flowId, shiftId, employeeId } = req.query as any;

    const report = await reportService.getWeeklyReport(date, {
      sectionId,
      flowId,
      shiftId,
      employeeId,
    });

    res.json({ success: true, message: 'Weekly report generated', data: report });
  } catch (error: any) {
    logger.error(`Failed to generate weekly report: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate weekly report', code: 'REPORT_ERROR' });
  }
};

export const generateSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const { sectionId, flowId, shiftId } = req.query as any;

    const report = await reportService.getMonthlyReport(year, month, { sectionId, flowId, shiftId });
    res.json({ success: true, message: 'Summary report generated', data: report.summary });
  } catch (error: any) {
    logger.error(`Failed to generate summary report: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate summary', code: 'REPORT_ERROR' });
  }
};

export const exportCsvReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = req.query.type as string || 'daily';
    let rawData: any[] = [];
    let filename = `attendance_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'daily') {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const report = await reportService.getDailyReport(date, req.query as any);
      rawData = report.events.map((e: any) => ({
        EmployeeId: e.employeeId?.employeeId || '',
        Name: e.employeeId?.fullName || '',
        Department: e.employeeId?.department || '',
        Event: e.eventTypeId?.name || '',
        Status: e.status,
        ActualTime: e.actualTime,
        ScheduledTime: e.scheduledTime,
        LateMinutes: e.lateDurationMinutes || 0,
        GpsStatus: e.gpsStatus,
      }));
    } else if (type === 'weekly') {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const report = await reportService.getWeeklyReport(date, req.query as any);
      filename = `attendance_weekly_${new Date().toISOString().split('T')[0]}.csv`;
      rawData = report.daily.map((d: any) => ({
        Date: d._id,
        TotalEvents: d.totalEvents,
        OnTimeCount: d.onTimeCount,
        LateCount: d.lateCount,
        BlockedCount: d.blockedCount,
        TotalLateMinutes: d.totalLateMinutes,
      }));
    } else {
      const now = new Date();
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const report = await reportService.getMonthlyReport(year, month, req.query as any);
      rawData = report.summary.map((s: any) => ({
        EmployeeId: s.employeeCode,
        Name: s.fullName,
        Department: s.department,
        TotalEvents: s.totalEvents,
        OnTimeCount: s.onTimeCount,
        LateCount: s.lateCount,
        TotalLateMinutes: s.totalLateMinutes,
        AttendanceRate: `${Math.round(s.attendanceRate)}%`,
      }));
    }

    const csvContent = reportService.generateCsv(rawData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    logger.error(`CSV export failed: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to export CSV', code: 'EXPORT_ERROR' });
  }
};
