import { z } from 'zod';

export const createFlowSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  sectionId: z.string().min(1),
  employeeIds: z.array(z.string()).optional(),
  shiftIds: z.array(z.string()).optional(),
  attendanceSequence: z.array(z.string()).min(1),
  locationPolicy: z.object({
    requireGeofence: z.boolean().default(true),
    geofenceRadius: z.number().min(10).max(5000).default(100),
    maxAccuracy: z.number().min(5).max(500).default(50),
    checkOnEveryEvent: z.boolean().default(true),
  }).optional(),
  adminIds: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateFlowSchema = createFlowSchema.partial();
