import { ZodSchema } from 'zod';

/**
 * Validates req.body against the given Zod schema.
 * All validator schemas in ../validators describe the request BODY.
 * On success the parsed (and coerced/trimmed) value replaces req.body.
 */
export function validate(schema: ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          data: null,
          error: parsed.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
          code: 'VALIDATION_ERROR',
          requestId: `req-${Date.now()}`,
        });
        return;
      }
      req.body = parsed.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}
