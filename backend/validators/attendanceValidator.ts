import { z } from 'zod';

export const attendanceSubmissionSchema = z.object({
  employeeId: z.string().optional(),
  eventTypeId: z.string().min(1, 'Event type is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracy: z.number().min(0).optional(),
  photoUrl: z.string().optional(),
  faceVerificationResult: z.enum(['VERIFIED', 'FAILED', 'NOT_REQUIRED', 'UNAVAILABLE']).optional(),
  notes: z.string().max(500).optional(),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional(),
    screenResolution: z.string().optional(),
  }).optional(),
  isIdempotentKey: z.string().optional(),
});

export const attendanceOverrideSchema = z.object({
  status: z.enum(['EARLY', 'ON_TIME', 'GRACE_PERIOD', 'LATE', 'MISSED', 'INVALID', 'BLOCKED', 'GPS_FAILURE', 'SECURITY_LOCK']),
  reason: z.string().min(3, 'Override reason is required').max(500),
});
