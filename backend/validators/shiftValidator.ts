import { z } from 'zod';

export const createShiftSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be valid HH:MM format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be valid HH:MM format'),
  gracePeriodMinutes: z.number().min(0).max(120).default(15),
  lateThresholdMinutes: z.number().min(0).max(240).default(30),
  earlyLoginAllowanceMinutes: z.number().min(0).max(120).default(15),
  breakPolicy: z.object({
    allowedDurationMinutes: z.number().min(0).max(180).default(30),
    maxDurationMinutes: z.number().min(0).max(240).default(60),
    requiresLocation: z.boolean().default(false),
    requiresPhoto: z.boolean().default(false),
  }).optional(),
  lunchPolicy: z.object({
    allowedDurationMinutes: z.number().min(0).max(180).default(45),
    maxDurationMinutes: z.number().min(0).max(240).default(60),
    requiresLocation: z.boolean().default(true),
    requiresPhoto: z.boolean().default(false),
  }).optional(),
  teaBreakPolicy: z.object({
    allowedDurationMinutes: z.number().min(0).max(60).default(15),
    maxDurationMinutes: z.number().min(0).max(120).default(30),
    requiresLocation: z.boolean().default(false),
    requiresPhoto: z.boolean().default(false),
  }).optional(),
  gpsPolicy: z.object({
    requireGps: z.boolean().default(true),
    requireAccuracy: z.number().min(5).max(500).default(50),
    geofenceRadius: z.number().min(10).max(5000).default(100),
  }).optional(),
  scheduleDays: z.array(z.string()).optional(),
});

export const updateShiftSchema = createShiftSchema.partial();
