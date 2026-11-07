import type { ErrorCode } from '@storylib/shared'
import { hasKey, translate } from '@/i18n'

export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK'
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode | 'NETWORK', message: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// Shown to the parent in their language: the stable error code picks the text, and the
// server's English message is only the fallback for a code we have no translation for.
export const errorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    const key = `error.${error.code}`
    return hasKey(key) ? translate(key) : error.message
  }
  return translate('common.error')
}
