import { AttendanceEventModel } from '../models/AttendanceEvent';
import { AttendanceEventTypeModel, IAttendanceEventType } from '../models/AttendanceEventType';
import { FlowModel } from '../models/Flow';
import { logger } from '../utils/logger';

export type EmployeeDayState = 
  | 'NOT_STARTED'
  | 'CHECKED_IN'
  | 'ON_LUNCH'
  | 'RETURNED_FROM_LUNCH'
  | 'ON_TEA'
  | 'RETURNED_FROM_TEA'
  | 'CHECKED_OUT';

export interface StateValidationResult {
  valid: boolean;
  reason?: string;
  currentState: EmployeeDayState;
  expectedEventCodes: string[];
  lastCompletedEvent?: string;
}

export interface PipelineStep {
  code: string;
  name: string;
  sequenceNumber: number;
  status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'SKIPPED';
  timestamp?: Date;
  eventStatus?: string;
}

export class StateMachineService {
  /**
   * Determine today's events for an employee and calculate current state
   */
  async getEmployeeDayState(employeeId: string, date: Date = new Date()): Promise<{
    state: EmployeeDayState;
    todayEvents: any[];
    lastEvent: any | null;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await AttendanceEventModel.find({
      employeeId,
      actualTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['INVALID', 'BLOCKED', 'GPS_FAILURE'] },
    })
      .populate('eventTypeId')
      .sort({ actualTime: 1 });

    if (events.length === 0) {
      return { state: 'NOT_STARTED', todayEvents: [], lastEvent: null };
    }

    const lastEvent = events[events.length - 1];
    const eventType = (lastEvent.eventTypeId as any)?.eventType || (lastEvent.eventTypeId as any)?.code;

    let state: EmployeeDayState = 'NOT_STARTED';

    switch (eventType) {
      case 'LOGIN':
      case 'MORNING_IN':
        state = 'CHECKED_IN';
        break;
      case 'LUNCH_OUT':
        state = 'ON_LUNCH';
        break;
      case 'LUNCH_IN':
        state = 'RETURNED_FROM_LUNCH';
        break;
      case 'TEA_OUT':
        state = 'ON_TEA';
        break;
      case 'TEA_IN':
        state = 'RETURNED_FROM_TEA';
        break;
      case 'SIGN_OUT':
      case 'EVENING_OUT':
        state = 'CHECKED_OUT';
        break;
      default:
        state = 'CHECKED_IN';
    }

    return { state, todayEvents: events, lastEvent };
  }

  /**
   * Validate if an event is allowed given current state and flow configuration
   */
  async validateTransition(
    employeeId: string,
    targetEvent: IAttendanceEventType,
    flowId?: string
  ): Promise<StateValidationResult> {
    const { state, todayEvents, lastEvent } = await this.getEmployeeDayState(employeeId);
    const targetType = targetEvent.eventType;
    const targetCode = targetEvent.code;

    // Check custom flow sequence if provided
    if (flowId) {
      const flow = await FlowModel.findById(flowId);
      if (flow && flow.attendanceSequence && flow.attendanceSequence.length > 0) {
        const completedCodes = todayEvents.map((e: any) => (e.eventTypeId as any)?.code || (e.eventTypeId as any)?.eventType);
        const nextRequiredIndex = completedCodes.length;
        const expectedCode = flow.attendanceSequence[nextRequiredIndex];

        if (expectedCode && expectedCode !== targetCode && expectedCode !== targetType) {
          // Check if target is in the past
          if (completedCodes.includes(targetCode) || completedCodes.includes(targetType)) {
            return {
              valid: false,
              reason: `Event '${targetEvent.name}' has already been recorded for today.`,
              currentState: state,
              expectedEventCodes: [expectedCode],
              lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
            };
          }
        }
      }
    }

    // Standard business rule state-transitions
    switch (targetType) {
      case 'LOGIN':
        if (state !== 'NOT_STARTED') {
          return {
            valid: false,
            reason: `Cannot check in: employee is already ${state.replace(/_/g, ' ').toLowerCase()}.`,
            currentState: state,
            expectedEventCodes: state === 'ON_LUNCH' ? ['LUNCH_IN'] : state === 'ON_TEA' ? ['TEA_IN'] : ['SIGN_OUT'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['LOGIN'] };

      case 'LUNCH_OUT':
        if (state !== 'CHECKED_IN' && state !== 'RETURNED_FROM_TEA') {
          return {
            valid: false,
            reason: state === 'NOT_STARTED'
              ? 'Cannot take lunch break: employee has not checked in yet.'
              : state === 'ON_LUNCH'
              ? 'Employee is already on lunch break.'
              : 'Cannot take lunch break in current state.',
            currentState: state,
            expectedEventCodes: state === 'NOT_STARTED' ? ['LOGIN'] : ['LUNCH_IN'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['LUNCH_OUT'] };

      case 'LUNCH_IN':
        if (state !== 'ON_LUNCH') {
          return {
            valid: false,
            reason: 'Cannot end lunch break: employee is not currently on lunch break.',
            currentState: state,
            expectedEventCodes: ['LUNCH_OUT'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['LUNCH_IN'] };

      case 'TEA_OUT':
        if (state !== 'CHECKED_IN' && state !== 'RETURNED_FROM_LUNCH') {
          return {
            valid: false,
            reason: state === 'NOT_STARTED'
              ? 'Cannot take tea break: employee has not checked in yet.'
              : state === 'ON_TEA'
              ? 'Employee is already on tea break.'
              : state === 'ON_LUNCH'
              ? 'Employee is currently on lunch break.'
              : 'Cannot take tea break in current state.',
            currentState: state,
            expectedEventCodes: state === 'NOT_STARTED' ? ['LOGIN'] : ['TEA_IN'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['TEA_OUT'] };

      case 'TEA_IN':
        if (state !== 'ON_TEA') {
          return {
            valid: false,
            reason: 'Cannot end tea break: employee is not currently on tea break.',
            currentState: state,
            expectedEventCodes: ['TEA_OUT'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['TEA_IN'] };

      case 'SIGN_OUT':
        if (state === 'NOT_STARTED') {
          return {
            valid: false,
            reason: 'Cannot check out: employee has not checked in today.',
            currentState: state,
            expectedEventCodes: ['LOGIN'],
            lastCompletedEvent: undefined,
          };
        }
        if (state === 'CHECKED_OUT') {
          return {
            valid: false,
            reason: 'Employee has already completed final sign-out for today.',
            currentState: state,
            expectedEventCodes: [],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        if (state === 'ON_LUNCH' || state === 'ON_TEA') {
          return {
            valid: false,
            reason: `Cannot check out while still on ${state === 'ON_LUNCH' ? 'lunch' : 'tea'} break. Complete break return first.`,
            currentState: state,
            expectedEventCodes: [state === 'ON_LUNCH' ? 'LUNCH_IN' : 'TEA_IN'],
            lastCompletedEvent: lastEvent ? (lastEvent.eventTypeId as any)?.name : undefined,
          };
        }
        return { valid: true, currentState: state, expectedEventCodes: ['SIGN_OUT'] };

      default:
        // For custom events
        return { valid: true, currentState: state, expectedEventCodes: [] };
    }
  }

  /**
   * Build the pipeline progress (all steps with status) for UI display
   */
  async getEmployeePipeline(employeeId: string, flowId?: string): Promise<PipelineStep[]> {
    const { todayEvents } = await this.getEmployeeDayState(employeeId);

    // Get all event types
    let eventTypes = await AttendanceEventTypeModel.find({ isActive: true }).sort({ sequenceNumber: 1 });

    const completedMap = new Map<string, any>();
    todayEvents.forEach((ev: any) => {
      const code = (ev.eventTypeId as any)?.code || (ev.eventTypeId as any)?.eventType;
      if (code) completedMap.set(code, ev);
    });

    let foundCurrent = false;

    return eventTypes.map((et) => {
      const isCompleted = completedMap.has(et.code) || completedMap.has(et.eventType);
      let status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'SKIPPED' = 'UPCOMING';
      let timestamp: Date | undefined;
      let eventStatus: string | undefined;

      if (isCompleted) {
        status = 'COMPLETED';
        const ev = completedMap.get(et.code) || completedMap.get(et.eventType);
        timestamp = ev.actualTime;
        eventStatus = ev.status;
      } else if (!foundCurrent) {
        status = 'CURRENT';
        foundCurrent = true;
      }

      return {
        code: et.code,
        name: et.name,
        sequenceNumber: et.sequenceNumber,
        status,
        timestamp,
        eventStatus,
      };
    });
  }
}

export const stateMachineService = new StateMachineService();
