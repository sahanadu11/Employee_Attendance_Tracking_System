export type AttendanceStatus =
  | 'EARLY'
  | 'ON_TIME'
  | 'GRACE_PERIOD'
  | 'LATE'
  | 'MISSED'
  | 'INVALID'
  | 'BLOCKED'
  | 'GPS_FAILURE'
  | 'SECURITY_LOCK';

export type GpsStatus =
  | 'INSIDE'
  | 'OUTSIDE'
  | 'UNAVAILABLE'
  | 'INACCURATE'
  | 'PERMISSION_DENIED';

export type VerificationResult = 'VERIFIED' | 'FAILED' | 'NOT_REQUIRED' | 'UNAVAILABLE';

export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
  screenResolution?: string;
}
