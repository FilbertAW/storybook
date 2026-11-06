import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'PIN_INVALID',
  'PAYMENT_FAILED',
  'FORBIDDEN_ROLE',
  'ENTITLEMENT_REQUIRED',
  'KID_MODE_FORBIDDEN',
  'NOT_FOUND',
  'NO_ACTIVE_SUBSCRIPTION',
  'ALREADY_OWNED',
  'ALREADY_SUBSCRIBED',
  'SUBSCRIPTION_OVERLAP_ACK_REQUIRED',
  'BOOK_NOT_PURCHASABLE',
  'ORDER_NOT_PENDING',
  'PIN_NOT_SET',
  'PIN_LOCKED',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
