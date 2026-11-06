import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ErrorCode, ErrorResponse } from '@storylib/shared';
import { AppError } from './errors';

const body = (code: ErrorCode, message: string, details?: Record<string, unknown>): ErrorResponse => ({
  error: { code, message, ...(details ? { details } : {}) },
});

// AppError becomes the shared error shape. Anything else is INTERNAL and its
// message and stack stay in the server log.
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(body(err.code, err.message, err.details), err.status);
  }
  // Malformed JSON bodies surface from the validator as a 400 HTTPException.
  if (err instanceof HTTPException && err.status === 400) {
    return c.json(body('VALIDATION_ERROR', 'The request is not valid.'), 400);
  }
  console.error(err);
  return c.json(body('INTERNAL', 'Something went wrong.'), 500);
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(body('NOT_FOUND', 'Route not found.'), 404);
