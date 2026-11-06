import { ApiError, errorMessage } from '@/api/errors'
import { formatTime } from '@/lib/format'

// Wrong PINs and lockouts get specific wording; everything else falls back to the server message.
export function pinErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PIN_INVALID') {
      const left = error.details?.attemptsRemaining
      return typeof left === 'number'
        ? `That PIN is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`
        : error.message
    }
    if (error.code === 'PIN_LOCKED') {
      const retryAt = error.details?.retryAt
      return typeof retryAt === 'string'
        ? `Too many wrong tries. Locked until ${formatTime(retryAt)}.`
        : error.message
    }
  }
  return errorMessage(error)
}
