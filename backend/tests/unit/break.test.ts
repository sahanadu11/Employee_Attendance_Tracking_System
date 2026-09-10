const BreakRecordCtor: any = jest.fn(function (this: any) {
  this._id = 'b1';
  this.save = jest.fn().mockResolvedValue(this);
});
BreakRecordCtor.findById = jest.fn();
BreakRecordCtor.find = jest.fn();
BreakRecordCtor.findOne = jest.fn();

jest.mock('../../models/BreakRecord', () => ({ BreakRecordModel: BreakRecordCtor }));
jest.mock('../../models/AttendanceEvent', () => ({ AttendanceEventModel: {} }));

import { breakService } from '../../services/breakService';
import { BreakRecordModel } from '../../models/BreakRecord';

describe('BreakService.startBreak', () => {
  test('creates and saves a break record', async () => {
    const result = await breakService.startBreak({
      employeeId: 'e1',
      eventTypeId: 'et1',
      shiftId: 'sh1',
      flowId: 'fl1',
      sectionId: 'sec1',
      allowedDurationMinutes: 30,
    });
    expect(result.success).toBe(true);
    expect(result.data.breakRecordId).toBe('b1');
  });
});

describe('BreakService.endBreak', () => {
  test('throws when break record not found', async () => {
    (BreakRecordModel as any).findById.mockResolvedValue(null);
    await expect(breakService.endBreak('missing')).rejects.toMatchObject({ code: 'BREAK_NOT_FOUND' });
  });

  test('throws when break already ended', async () => {
    (BreakRecordModel as any).findById.mockResolvedValue({ breakEnd: new Date() });
    await expect(breakService.endBreak('b1')).rejects.toMatchObject({ code: 'BREAK_ALREADY_ENDED' });
  });

  test('computes total and excess duration on end', async () => {
    const record = {
      breakStart: new Date(Date.now() - 45 * 60000),
      breakEnd: undefined,
      allowedDurationMinutes: 30,
      save: jest.fn().mockResolvedValue(true),
    };
    (BreakRecordModel as any).findById.mockResolvedValue(record);

    const result = await breakService.endBreak('b1');
    expect(result.success).toBe(true);
    expect(result.data.durationMinutes).toBeGreaterThanOrEqual(44);
    expect(result.data.durationMinutes).toBeLessThanOrEqual(46);
    expect(result.data.excessDurationMinutes).toBe(result.data.durationMinutes - 30);
  });
});