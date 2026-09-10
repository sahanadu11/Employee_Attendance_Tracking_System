import {
  haversineDistance,
  isInsideGeofence,
  formatTime,
  calculateTimeDifference,
  generateIdempotencyKey,
} from '../../utils/helpers';

describe('Haversine distance', () => {
  test('returns approximately zero for identical points', () => {
    expect(haversineDistance(28.6139, 77.2090, 28.6139, 77.2090)).toBeLessThan(1);
  });

  test('computes approximately correct distance between two cities (m)', () => {
    const delhi = { lat: 28.6139, lon: 77.209 };
    const mumbai = { lat: 19.076, lon: 72.8777 };
    const m = haversineDistance(delhi.lat, delhi.lon, mumbai.lat, mumbai.lon);
    expect(m).toBeGreaterThan(1100000);
    expect(m).toBeLessThan(1250000);
  });
});

describe('Geofence check', () => {
  test('point inside radius passes', () => {
    expect(isInsideGeofence(28.6139, 77.2090, 28.6139, 77.2090, 100)).toBe(true);
  });

  test('point outside radius fails', () => {
    expect(isInsideGeofence(28.6139, 77.2190, 28.6139, 77.2090, 100)).toBe(false);
  });
});

describe('formatTime', () => {
  test('formats PM time', () => {
    expect(formatTime('14:30')).toBe('02:30 PM');
  });

  test('formats midnight', () => {
    expect(formatTime('00:15')).toBe('12:15 AM');
  });

  test('formats single-digit hour AM', () => {
    expect(formatTime('09:05')).toBe('09:05 AM');
  });
});

describe('calculateTimeDifference', () => {
  const scheduled = (t: string) => new Date(`2024-01-01T${t}:00`);

  test('late arrival', () => {
    const result = calculateTimeDifference(scheduled('10:00'), scheduled('10:30'));
    expect(result.status).toBe('LATE');
    expect(result.minutes).toBe(30);
  });

  test('early arrival', () => {
    const result = calculateTimeDifference(scheduled('10:00'), scheduled('09:45'));
    expect(result.status).toBe('EARLY');
    expect(result.minutes).toBe(15);
  });

  test('on-time arrival', () => {
    const result = calculateTimeDifference(scheduled('10:00'), scheduled('10:00'));
    expect(result.status).toBe('ON_TIME');
    expect(result.minutes).toBe(0);
  });
});

describe('generateIdempotencyKey', () => {
  test('generates prefixed unique keys', () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const key = generateIdempotencyKey();
      expect(key.startsWith('evt_')).toBe(true);
      expect(set.has(key)).toBe(false);
      set.add(key);
    }
    expect(set.size).toBe(500);
  });
});