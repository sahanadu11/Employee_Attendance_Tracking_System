import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path, method: req.method });

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred',
    data: null,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    code,
    requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    error: 'Not Found',
    code: 'NOT_FOUND',
    requestId: `req-${Date.now()}`,
  });
}
