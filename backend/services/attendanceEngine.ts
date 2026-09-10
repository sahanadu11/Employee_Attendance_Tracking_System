import { AttendanceEventModel } from '../models/AttendanceEvent';
import { EmployeeModel } from '../models/Employee';
import { ShiftModel } from '../models/Shift';
import { AttendanceEventTypeModel } from '../models/AttendanceEventType';
import { BreakRecordModel } from '../models/BreakRecord';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { EmployeeLocationModel } from '../models/EmployeeLocation';
import { AuditLogModel } from '../models/AuditLog';
import { SecurityEventModel } from '../models/SecurityEvent';
import { NotificationModel } from '../models/Notification';
import { generateIdempotencyKey, calculateLateStatus, haversineDistance } from '../utils/helpers';
import { logger } from '../utils/logger';
import { AttendanceStatus, GpsStatus, VerificationResult } from '../shared/types';
import { io } from '../websocket/socket';
import { stateMachineService } from './stateMachineService';
import { getSettingValue } from '../controllers/settingsController';

export class AttendanceEngine {
  async submitAttendance(data: {
    employeeId: string;
    eventTypeId: string;
    latitude?: number;
    longitude?: number;
    gpsAccuracy?: number;
    photoUrl?: string;
    faceVerificationResult?: VerificationResult;
    notes?: string;
    deviceInfo?: any;
    isIdempotentKey?: string;
  }): Promise<any> {
    const {
      employeeId,
      eventTypeId,
      latitude,
      longitude,
      gpsAccuracy,
      photoUrl,
      faceVerificationResult,
      notes,
      deviceInfo,
      isIdempotentKey,
    } = data;

    try {
      const employee = await EmployeeModel.findById(employeeId);
      if (!employee || !employee.isActive) {
        throw { statusCode: 403, code: 'EMPLOYEE_INACTIVE', message: 'Employee is inactive or not found' };
      }

      const shift = await ShiftModel.findById(employee.shiftId);
      if (!shift || !shift.isActive) {
        throw { statusCode: 400, code: 'SHIFT_INACTIVE', message: 'No active shift assigned to employee' };
      }

      const eventType = await AttendanceEventTypeModel.findById(eventTypeId);
      if (!eventType || !eventType.isActive) {
        throw { statusCode: 400, code: 'EVENT_TYPE_INACTIVE', message: 'Attendance event type is not active' };
      }

      // 1. Idempotency Check
      if (isIdempotentKey) {
        const existing = await AttendanceEventModel.findOne({ isIdempotentKey });
        if (existing) {
          logger.info('Duplicate event prevented via idempotency key', { employeeId, eventTypeId, key: isIdempotentKey });
          return { success: true, message: 'Event already recorded', data: existing };
        }
      }

      // 2. State Machine Validation
      const transitionValidation = await stateMachineService.validateTransition(
        employeeId,
        eventType,
        employee.flowId ? employee.flowId.toString() : undefined
      );

      if (!transitionValidation.valid) {
        throw {
          statusCode: 400,
          code: 'INVALID_SEQUENCE',
          message: transitionValidation.reason || 'Invalid attendance sequence transition',
          currentState: transitionValidation.currentState,
          expectedEventCodes: transitionValidation.expectedEventCodes,
        };
      }

      // 3. Photo & Face Verification Validation
      if (eventType.requiresPhoto && !photoUrl) {
        throw {
          statusCode: 400,
          code: 'PHOTO_REQUIRED',
          message: `Photo verification is mandatory for ${eventType.name}`,
        };
      }

      if (eventType.requiresFaceVerification && faceVerificationResult === 'FAILED') {
        await SecurityEventModel.create({
          userId: employeeId,
          eventType: 'FACE_MISMATCH',
          description: `Face verification failed for employee during ${eventType.name}`,
          timestamp: new Date(),
          isResolved: false,
          metadata: { employeeId, eventTypeId, photoUrl },
        });

        throw {
          statusCode: 403,
          code: 'FACE_VERIFICATION_FAILED',
          message: 'Face verification failed. Please try again with clear lighting.',
        };
      }

      // 4. Time & Schedule Calculation
      const scheduledTime = this.calculateScheduledTime(shift, eventType);
      const actualTime = new Date();
      const { status: timeStatus, lateMinutes } = calculateLateStatus(
        scheduledTime,
        actualTime,
        shift.gracePeriodMinutes || 15,
        shift.lateThresholdMinutes || 30
      );

      // 5. GPS & Geofencing Validation
      let gpsStatus: GpsStatus = 'UNAVAILABLE';
      let isInside = true;
      let distanceToOffice = 0;

      if (latitude !== undefined && longitude !== undefined) {
        const office = await OfficeLocationModel.findOne({ isActive: true });
        if (office) {
          distanceToOffice = haversineDistance(latitude, longitude, office.latitude, office.longitude);
          const defaultRadius = await getSettingValue('GEOFENCE_DEFAULT_RADIUS', office.geofenceRadius || 100);
          const geofenceRadius = shift.gpsPolicy?.geofenceRadius || defaultRadius || 100;
          isInside = distanceToOffice <= geofenceRadius;
          gpsStatus = isInside ? 'INSIDE' : 'OUTSIDE';

          const defaultAccuracy = await getSettingValue('GPS_ACCURACY_THRESHOLD', 50);
          const maxAllowedAccuracy = shift.gpsPolicy?.requireAccuracy || defaultAccuracy || 50;
          if (gpsAccuracy !== undefined && gpsAccuracy > maxAllowedAccuracy * 2) {
            gpsStatus = 'INACCURATE';
          }
        }
      } else if (shift.gpsPolicy?.requireGps || eventType.requiresGps) {
        gpsStatus = 'UNAVAILABLE';
        isInside = false;
      }

      // 6. Determine final attendance status
      let finalStatus: AttendanceStatus = timeStatus;
      if (!isInside && (shift.gpsPolicy?.requireGps || eventType.requiresGps)) {
        finalStatus = 'BLOCKED';
      } else if (gpsStatus === 'INACCURATE') {
        finalStatus = 'GPS_FAILURE';
      }

      const lateDuration = finalStatus === 'LATE' ? lateMinutes : undefined;
      const idempotencyKey = isIdempotentKey || generateIdempotencyKey();

      // 7. Save Attendance Event
      const attendanceEvent = new AttendanceEventModel({
        employeeId,
        eventTypeId,
        shiftId: shift._id,
        flowId: employee.flowId,
        sectionId: employee.sectionId,
        scheduledTime,
        actualTime,
        status: finalStatus,
        lateDurationMinutes: lateDuration,
        latitude,
        longitude,
        gpsAccuracy,
        gpsStatus,
        photoUrl,
        faceVerificationResult: faceVerificationResult || (eventType.requiresFaceVerification ? 'VERIFIED' : 'NOT_REQUIRED'),
        notes,
        isIdempotentKey: idempotencyKey,
        deviceInfo,
        isVerified: true,
      });

      await attendanceEvent.save();

      // 8. Handle Break Records automatically
      await this.handleBreakTransitions(eventType, employee, shift, actualTime, latitude, longitude, gpsAccuracy, photoUrl);

      // 9. Record Employee Location History
      if (latitude !== undefined && longitude !== undefined) {
        await EmployeeLocationModel.create({
          employeeId,
          latitude,
          longitude,
          accuracy: gpsAccuracy || 0,
          timestamp: actualTime,
          insideGeofence: isInside,
        });
      }

      // 10. Notifications & Security Logs
      if (finalStatus === 'LATE') {
        await NotificationModel.create({
          userId: employeeId,
          type: 'LATE',
          title: 'Late Attendance Alert',
          message: `Recorded ${lateMinutes} minutes late for ${eventType.name}`,
          isRead: false,
          timestamp: actualTime,
        });
      }

      if (gpsStatus === 'OUTSIDE' || gpsStatus === 'INACCURATE') {
        await NotificationModel.create({
          userId: employeeId,
          type: 'OUTSIDE_GEOFENCE',
          title: 'Location Geofence Alert',
          message: `GPS status was ${gpsStatus} (${Math.round(distanceToOffice)}m from office boundary)`,
          isRead: false,
          timestamp: actualTime,
        });

        if (!isInside) {
          await SecurityEventModel.create({
            userId: employeeId,
            eventType: 'GPS_SUSPICIOUS',
            description: `Attendance submitted outside office geofence (${Math.round(distanceToOffice)}m away)`,
            timestamp: actualTime,
            latitude,
            longitude,
            isResolved: false,
          });
        }
      }

      // 11. Audit Entry
      await AuditLogModel.create({
        userId: employeeId,
        userRole: 'EMPLOYEE',
        action: 'ATTENDANCE_SUBMIT',
        entity: 'AttendanceEvent',
        entityId: attendanceEvent._id,
        newValue: { eventType: eventType.code, status: finalStatus, distanceToOffice },
        ipAddress: deviceInfo?.ipAddress || '',
        userAgent: deviceInfo?.userAgent || '',
        timestamp: actualTime,
        result: 'SUCCESS',
      });

      // 12. Realtime WebSocket Broadcast
      await this.emitEvent(attendanceEvent, employee, shift, eventType);

      return {
        success: true,
        message: `Attendance recorded: ${eventType.name} (${finalStatus})`,
        data: {
          eventId: attendanceEvent._id,
          status: finalStatus,
          lateDurationMinutes: lateDuration,
          gpsStatus,
          isInside,
          distanceToOffice: Math.round(distanceToOffice),
          scheduledTime,
          actualTime,
          pipeline: await stateMachineService.getEmployeePipeline(employeeId),
        },
      };
    } catch (error: any) {
      logger.error(`Attendance submission failed: ${error.message}`, { employeeId, eventTypeId });
      throw error;
    }
  }

  private async handleBreakTransitions(
    eventType: any,
    employee: any,
    shift: any,
    actualTime: Date,
    latitude?: number,
    longitude?: number,
    gpsAccuracy?: number,
    photoUrl?: string
  ): Promise<void> {
    const isLunchOut = eventType.eventType === 'LUNCH_OUT' || eventType.code === 'LUNCH_OUT';
    const isTeaOut = eventType.eventType === 'TEA_OUT' || eventType.code === 'TEA_OUT';
    const isLunchIn = eventType.eventType === 'LUNCH_IN' || eventType.code === 'LUNCH_IN';
    const isTeaIn = eventType.eventType === 'TEA_IN' || eventType.code === 'TEA_IN';

    if (isLunchOut || isTeaOut) {
      const allowedDuration = isLunchOut
        ? shift.lunchPolicy?.allowedDurationMinutes || 45
        : shift.teaBreakPolicy?.allowedDurationMinutes || 15;

      await BreakRecordModel.create({
        employeeId: employee._id,
        eventTypeId: eventType._id,
        shiftId: shift._id,
        flowId: employee.flowId,
        sectionId: employee.sectionId,
        breakStart: actualTime,
        allowedDurationMinutes: allowedDuration,
        latitude,
        longitude,
        gpsAccuracy,
        photoUrl,
        timestamp: actualTime,
      });
    } else if (isLunchIn || isTeaIn) {
      const activeBreak = await BreakRecordModel.findOne({
        employeeId: employee._id,
        breakEnd: { $exists: false },
      }).sort({ breakStart: -1 });

      if (activeBreak) {
        activeBreak.breakEnd = actualTime;
        const totalDurationMinutes = Math.round(
          (actualTime.getTime() - activeBreak.breakStart.getTime()) / 60000
        );
        activeBreak.totalDurationMinutes = totalDurationMinutes;
        activeBreak.excessDurationMinutes = Math.max(
          0,
          totalDurationMinutes - activeBreak.allowedDurationMinutes
        );
        await activeBreak.save();
      }
    }
  }

  private calculateScheduledTime(shift: any, eventType: any): Date {
    const now = new Date();
    const startTime = shift.startTime || '09:00';
    const [h, m] = startTime.split(':').map(Number);
    const scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

    switch (eventType.eventType) {
      case 'LUNCH_OUT':
        scheduledDate.setHours(scheduledDate.getHours() + 4);
        break;
      case 'LUNCH_IN':
        scheduledDate.setHours(scheduledDate.getHours() + 4, scheduledDate.getMinutes() + (shift.lunchPolicy?.allowedDurationMinutes || 45));
        break;
      case 'TEA_OUT':
        scheduledDate.setHours(scheduledDate.getHours() + 6);
        break;
      case 'TEA_IN':
        scheduledDate.setHours(scheduledDate.getHours() + 6, scheduledDate.getMinutes() + (shift.teaBreakPolicy?.allowedDurationMinutes || 15));
        break;
      case 'SIGN_OUT':
        if (shift.endTime) {
          const [endH, endM] = shift.endTime.split(':').map(Number);
          scheduledDate.setHours(endH, endM, 0, 0);
        } else {
          scheduledDate.setHours(scheduledDate.getHours() + 8);
        }
        break;
      default:
        break;
    }

    return scheduledDate;
  }

  private async emitEvent(event: any, employee: any, shift: any, eventType: any): Promise<void> {
    try {
      const payload = {
        eventId: event._id,
        employeeId: employee._id,
        employeeName: employee.fullName,
        employeePhoto: employee.photo,
        employeeIdNum: employee.employeeId,
        section: employee.sectionId,
        flow: employee.flowId,
        shift: shift.name,
        event: eventType.name,
        eventCode: eventType.code,
        status: event.status,
        scheduledTime: event.scheduledTime,
        actualTime: event.actualTime,
        lateDurationMinutes: event.lateDurationMinutes,
        gpsStatus: event.gpsStatus,
        gpsAccuracy: event.gpsAccuracy,
        timestamp: event.actualTime,
      };

      io.to('admin').emit('attendance-event', payload);
      if (employee.sectionId) {
        io.to(`section-${employee.sectionId}`).emit('attendance-event', payload);
      }
      io.to(`employee-${employee._id}`).emit('attendance-event', payload);
    } catch (e) {
      logger.warn('Failed to emit realtime attendance event', { error: e });
    }
  }
}

export const attendanceEngine = new AttendanceEngine();
