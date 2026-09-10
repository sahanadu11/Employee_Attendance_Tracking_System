const SecurityEventCtor: any = jest.fn(function (this: any, data: any) {
  Object.assign(this, data, { _id: 'e1' });
  this.save = jest.fn().mockResolvedValue(this);
});
SecurityEventCtor.find = jest.fn();
SecurityEventCtor.findByIdAndUpdate = jest.fn();

jest.mock('../../models/SecurityEvent', () => ({ SecurityEventModel: SecurityEventCtor }));
jest.mock('../../models/User', () => ({ UserModel: {} }));

import { securityService } from '../../services/securityService';
import { SecurityEventModel } from '../../models/SecurityEvent';

describe('SecurityService.recordEvent', () => {
  test('records event from string form and enriches metadata', async () => {
    const event = await securityService.recordEvent('LOCKOUT', 'u1', 'Too many attempts', {
      ipAddress: '9.9.9.9',
      userAgent: 'test-agent',
    });
    expect(event).not.toBeNull();
    expect(event.eventType).toBe('LOCKOUT');
    expect(event.ipAddress).toBe('9.9.9.9');
    expect(event.userAgent).toBe('test-agent');
  });

  test('records event from object form', async () => {
    const event = await securityService.recordEvent({
      eventType: 'SUSPICIOUS_GPS',
      userId: 'u2',
      description: 'GPS anomaly',
    });
    expect(event.eventType).toBe('SUSPICIOUS_GPS');
    expect(event.userId).toBe('u2');
  });

  test('returns null when save fails', async () => {
    SecurityEventCtor.mockImplementation(function (this: any) {
      this.save = jest.fn().mockRejectedValue(new Error('db down'));
    });
    const result = await securityService.recordEvent('LOCKOUT');
    expect(result).toBeNull();
    SecurityEventCtor.mockImplementation(function (this: any, data: any) {
      Object.assign(this, data, { _id: 'e1' });
      this.save = jest.fn().mockResolvedValue(this);
    });
  });
});

describe('SecurityService.resolveEvent', () => {
  test('marks event resolved', async () => {
    (SecurityEventModel as any).findByIdAndUpdate.mockResolvedValue({ _id: 'e1', isResolved: true });
    await securityService.resolveEvent('e1', 'admin1');
    expect((SecurityEventModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
      'e1',
      { isResolved: true, resolvedAt: expect.any(Date), resolvedBy: 'admin1' },
      { new: true }
    );
  });
});

describe('SecurityService.getRecentEvents', () => {
  test('queries recent events with populated user', async () => {
    const logs = [{ eventType: 'LOCKOUT' }];
    (SecurityEventModel as any).find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          populate: () => Promise.resolve(logs),
        }),
      }),
    });

    const result = await securityService.getRecentEvents(10);
    expect(result).toEqual(logs);
  });
});