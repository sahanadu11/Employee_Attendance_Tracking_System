import { z } from 'zod';

export const createSectionSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  description: z.string().max(500).optional(),
  adminIds: z.array(z.string()).optional(),
  flowIds: z.array(z.string()).optional(),
});

export const updateSectionSchema = createSectionSchema.partial();
