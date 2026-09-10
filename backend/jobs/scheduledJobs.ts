import { UserModel } from '../models/User';
import { BreakRecordModel } from '../models/BreakRecord';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { EmployeeModel } from '../models/Employee';
import { logger } from '../utils/logger';

let intervalHandles: NodeJS.Timeout[] = [];

/**
 * Automatically unlocks accounts whose lockout period has expired
 */
export async function unlockExpiredAccounts(): Promise<number> {
  try {
    const result = await UserModel.updateMany(
      { lockedUntil: { $lte: new Date() }, failedAttempts: { $gt: 0 } },
      { $unset: { lockedUntil: 1 }, $set: { failedAttempts: 0 } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[JOB] Unlocked ${result.modifiedCount} expired locked user accounts`);
    }
    return result.modifiedCount;
  } catch (err: any) {
    logger.error(`[JOB] Error unlocking accounts: ${err.message}`);
    return 0;
  }
}

/**
 * Checks for breaks left open for excessive durations (e.g. > 4 hours) and auto-closes them
 */
export async function closeExpiredBreaks(): Promise<number> {
  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const openBreaks = await BreakRecordModel.find({
      breakEnd: { $exists: false },
      breakStart: { $lte: fourHoursAgo },
    });

    let closed = 0;
    for (const record of openBreaks) {
      const autoEndTime = new Date(record.breakStart.getTime() + record.allowedDurationMinutes * 60000);
      record.breakEnd = autoEndTime;
      record.totalDurationMinutes = record.allowedDurationMinutes;
      record.excessDurationMinutes = 0;
      await record.save();
      closed++;
    }

    if (closed > 0) {
      logger.info(`[JOB] Auto-closed ${closed} orphaned breaks`);
    }
    return closed;
  } catch (err: any) {
    logger.error(`[JOB] Error closing orphaned breaks: ${err.message}`);
    return 0;
  }
}

/**
 * Daily midnight job to mark absent employees who had scheduled shifts but recorded no attendance
 */
export async function markAbsentEmployees(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const activeEmployees = await EmployeeModel.find({ isActive: true, employmentStatus: 'ACTIVE' });
    let marked = 0;

    for (const emp of activeEmployees) {
      const hasEvent = await AttendanceEventModel.exists({
        employeeId: emp._id,
        actualTime: { $gte: yesterday, $lt: today },
      });

      if (!hasEvent && emp.shiftId) {
        // Record missed event
        await AttendanceEventModel.create({
          employeeId: emp._id,
          eventTypeId: emp.shiftId,
          shiftId: emp.shiftId,
          flowId: emp.flowId,
          sectionId: emp.sectionId,
          actualTime: yesterday,
          status: 'MISSED',
          gpsStatus: 'UNAVAILABLE',
          isVerified: false,
          notes: 'Auto-marked absent by system overnight job',
        });
        marked++;
      }
    }

    if (marked > 0) {
      logger.info(`[JOB] Marked ${marked} employees absent for previous day`);
    }
    return marked;
  } catch (err: any) {
    logger.error(`[JOB] Error marking absent employees: ${err.message}`);
    return 0;
  }
}

export function startScheduledJobs(): void {
  logger.info('[JOB] Starting background maintenance jobs...');

  // Run unlock expired accounts check every 2 minutes
  const unlockInterval = setInterval(unlockExpiredAccounts, 2 * 60 * 1000);
  intervalHandles.push(unlockInterval);

  // Run orphaned break closer every 15 minutes
  const breakInterval = setInterval(closeExpiredBreaks, 15 * 60 * 1000);
  intervalHandles.push(breakInterval);

  // Run initial checks right away
  unlockExpiredAccounts();
  closeExpiredBreaks();
}

export function stopScheduledJobs(): void {
  intervalHandles.forEach(clearInterval);
  intervalHandles = [];
  logger.info('[JOB] Stopped background maintenance jobs');
}
