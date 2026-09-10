import { z } from 'zod';

export const createEmployeeSchema = z.object({
  employeeId: z.string().min(3).max(20),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  department: z.string().min(2),
  sectionId: z.string().min(1),
  flowId: z.string().min(1),
  shiftId: z.string().min(1),
  jobTitle: z.string().min(2),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'SUSPENDED']).optional(),
  emergencyContact: z.object({ name: z.string(), phone: z.string(), relation: z.string() }).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();
