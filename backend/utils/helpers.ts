import { v4 as uuidv4 } from 'uuid';
import { AttendanceStatus, GpsStatus } from '../shared/types';

export function generateIdempotencyKey(): string {
  return `evt_${uuidv4().replace(/-/g, '')}`;
}

export function calculateTimeDifference(scheduledTime: Date, actualTime: Date): { minutes: number; status: AttendanceStatus } {
  const diffMs = actualTime.getTime() - scheduledTime.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 0) {
    return { minutes: Math.abs(diffMinutes), status: 'EARLY' };
  }
  if (diffMinutes === 0) {
    return { minutes: 0, status: 'ON_TIME' };
  }
  return { minutes: diffMinutes, status: 'LATE' };
}

export function calculateLateStatus(
  scheduledTime: Date,
  actualTime: Date,
  gracePeriodMinutes: number,
  lateThresholdMinutes: number
): { status: AttendanceStatus; lateMinutes: number } {
  const diffMs = actualTime.getTime() - scheduledTime.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 0) {
    return { status: diffMinutes === 0 ? 'ON_TIME' : 'EARLY', lateMinutes: 0 };
  }
  if (diffMinutes <= gracePeriodMinutes) {
    return { status: 'GRACE_PERIOD', lateMinutes: diffMinutes };
  }
  if (diffMinutes <= lateThresholdMinutes) {
    return { status: 'LATE', lateMinutes: diffMinutes };
  }
  return { status: 'LATE', lateMinutes: diffMinutes };
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGeofence(
  lat: number,
  lon: number,
  officeLat: number,
  officeLon: number,
  radius: number
): boolean {
  const distance = haversineDistance(lat, lon, officeLat, officeLon);
  return distance <= radius;
}

export function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}
