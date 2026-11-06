import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '@storylib/shared';

// Every code from packages/shared maps to exactly one HTTP status.
const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  PIN_INVALID: 401,
  PAYMENT_FAILED: 402,
  FORBIDDEN_ROLE: 403,
  ENTITLEMENT_REQUIRED: 403,
  KID_MODE_FORBIDDEN: 403,
  NOT_FOUND: 404,
  NO_ACTIVE_SUBSCRIPTION: 404,
  ALREADY_OWNED: 409,
  ALREADY_SUBSCRIBED: 409,
  SUBSCRIPTION_OVERLAP_ACK_REQUIRED: 409,
  BOOK_NOT_PURCHASABLE: 409,
  ORDER_NOT_PENDING: 409,
  PIN_NOT_SET: 409,
  PIN_LOCKED: 429,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, ContentfulStatusCode>;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): ContentfulStatusCode {
    return ERROR_STATUS[this.code];
  }
}
