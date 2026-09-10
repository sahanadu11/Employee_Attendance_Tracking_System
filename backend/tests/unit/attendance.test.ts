import { calculateLateStatus } from '../../utils/helpers';

describe('Attendance Engine', () => {
  test('calculates late status correctly (beyond grace window)', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T10:45:00');
    const result = calculateLateStatus(scheduled, actual, 14, 30);
    expect(result.status).toBe('LATE');
    expect(result.lateMinutes).toBe(15);
  });

  test('grace boundary: exactly at grace limit remains GRACE_PERIOD', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T10:45:00');
    const result = calculateLateStatus(scheduled, actual, 15, 30);
    expect(result.status).toBe('GRACE_PERIOD');
    expect(result.lateMinutes).toBe(15);
  });

  test('far beyond late threshold still flags LATE with full minutes', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T11:30:00');
    const result = calculateLateStatus(scheduled, actual, 15, 30);
    expect(result.status).toBe('LATE');
    expect(result.lateMinutes).toBe(60);
  });

  test('calculates on-time status', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T10:30:00');
    const result = calculateLateStatus(scheduled, actual, 15, 30);
    expect(result.status).toBe('ON_TIME');
    expect(result.lateMinutes).toBe(0);
  });

  test('calculates early status', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T10:15:00');
    const result = calculateLateStatus(scheduled, actual, 15, 30);
    expect(result.status).toBe('EARLY');
    expect(result.lateMinutes).toBe(0);
  });

  test('calculates grace period', () => {
    const scheduled = new Date('2024-01-01T10:30:00');
    const actual = new Date('2024-01-01T10:40:00');
    const result = calculateLateStatus(scheduled, actual, 15, 30);
    expect(result.status).toBe('GRACE_PERIOD');
    expect(result.lateMinutes).toBe(10);
  });
});

describe('Haversine Distance', () => {
  test('calculates correct distance for same point', () => {
    const { haversineDistance } = require('../../utils/helpers');
    const dist = haversineDistance(28.6139, 77.2090, 28.6139, 77.2090);
    expect(dist).toBeLessThan(1);
  });
});
