import { AppError } from './errors';

// Passed as the third argument of zValidator so schema failures use the shared error shape.
export function validationHook(result: { success: boolean; error?: { issues: unknown[] } }) {
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 'The request is not valid.', {
      issues: result.error?.issues,
    });
  }
}
