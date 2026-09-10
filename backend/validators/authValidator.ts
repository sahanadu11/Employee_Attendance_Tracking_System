import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN', 'EMPLOYEE']),
  employeeId: z.string().optional(),
  sectionId: z.string().optional(),
  flowId: z.string().optional(),
  fullName: z.string().optional(),
});
