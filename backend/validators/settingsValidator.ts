import { z } from 'zod';

export const updateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
});
