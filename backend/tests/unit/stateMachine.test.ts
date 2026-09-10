jest.mock('../../models/AttendanceEvent', () => ({
  AttendanceEventModel: { find: jest.fn() },
}));
jest.mock('../../models/Flow', () => ({
  FlowModel: { findById: jest.fn() },
}));
jest.mock('../../models/AttendanceEventType', () => ({
  AttendanceEventTypeModel: { find: jest.fn() },
}));

import { AttendanceEventModel } from '../../models/AttendanceEvent';
import { stateMachineService, StateMachineService } from '../../services/stateMachineService';

function setEvents(events: any[]) {
  (AttendanceEventModel.find as jest.Mock).mockReturnValue({
    populate: () => ({
      sort: () => Promise.resolve(events),
    }),
  });
}

function event(type: string) {
  return { eventTypeId: { eventType: type, code: type, name: type }, actualTime: new Date(), status: 'ON_TIME' };
}

function targetType(type: string): any {
  return { eventType: type, code: type, name: type };
}

describe('StateMachineService.validateTransition', () => {
  test('allows LOGIN when not started', async () => {
    setEvents([]);
    const result = await stateMachineService.validateTransition('e1', targetType('LOGIN'));
    expect(result.valid).toBe(true);
    expect(result.currentState).toBe('NOT_STARTED');
  });

  test('blocks duplicate LOGIN after check-in', async () => {
    setEvents([event('LOGIN')]);
    const result = await stateMachineService.validateTransition('e1', targetType('LOGIN'));
    expect(result.valid).toBe(false);
    expect(result.currentState).toBe('CHECKED_IN');
  });

  test('allows LUNCH_OUT when checked in', async () => {
    setEvents([event('LOGIN')]);
    const result = await stateMachineService.validateTransition('e1', targetType('LUNCH_OUT'));
    expect(result.valid).toBe(true);
  });

  test('blocks LUNCH_OUT before check-in', async () => {
    setEvents([]);
    const result = await stateMachineService.validateTransition('e1', targetType('LUNCH_OUT'));
    expect(result.valid).toBe(false);
  });

  test('allows LUNCH_IN when on lunch', async () => {
    setEvents([event('LOGIN'), event('LUNCH_OUT')]);
    const result = await stateMachineService.validateTransition('e1', targetType('LUNCH_IN'));
    expect(result.valid).toBe(true);
    expect(result.currentState).toBe('ON_LUNCH');
  });

  test('blocks LUNCH_IN when not on lunch', async () => {
    setEvents([event('LOGIN')]);
    const result = await stateMachineService.validateTransition('e1', targetType('LUNCH_IN'));
    expect(result.valid).toBe(false);
  });

  test('blocks SIGN_OUT before check-in', async () => {
    setEvents([]);
    const result = await stateMachineService.validateTransition('e1', targetType('SIGN_OUT'));
    expect(result.valid).toBe(false);
    expect(result.currentState).toBe('NOT_STARTED');
  });

  test('blocks SIGN_OUT while on lunch', async () => {
    setEvents([event('LOGIN'), event('LUNCH_OUT')]);
    const result = await stateMachineService.validateTransition('e1', targetType('SIGN_OUT'));
    expect(result.valid).toBe(false);
  });

  test('allows SIGN_OUT when checked in', async () => {
    setEvents([event('LOGIN')]);
    const result = await stateMachineService.validateTransition('e1', targetType('SIGN_OUT'));
    expect(result.valid).toBe(true);
  });

  test('blocks duplicate SIGN_OUT after checkout', async () => {
    setEvents([event('LOGIN'), event('SIGN_OUT')]);
    const result = await stateMachineService.validateTransition('e1', targetType('SIGN_OUT'));
    expect(result.valid).toBe(false);
    expect(result.currentState).toBe('CHECKED_OUT');
  });
});

describe('StateMachineService.getEmployeeDayState', () => {
  test('returns NOT_STARTED when no events', async () => {
    setEvents([]);
    const result = await stateMachineService.getEmployeeDayState('e1');
    expect(result.state).toBe('NOT_STARTED');
    expect(result.todayEvents).toEqual([]);
  });

  test('derives state from last event', async () => {
    setEvents([event('LOGIN'), event('TEA_OUT')]);
    const result = await stateMachineService.getEmployeeDayState('e1');
    expect(result.state).toBe('ON_TEA');
    expect(result.lastEvent).not.toBeNull();
  });
});