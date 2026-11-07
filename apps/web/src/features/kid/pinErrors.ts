import { ApiError, errorMessage } from '@/api/errors'
import { plural, translate } from '@/i18n'
import { formatTime } from '@/lib/format'

// Wrong PINs and lockouts get specific wording; everything else uses the translated error code.
export function pinErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PIN_INVALID') {
      const left = error.details?.attemptsRemaining
      return typeof left === 'number' ? translate(plural('pin.wrong', left), { count: left }) : errorMessage(error)
    }
    if (error.code === 'PIN_LOCKED') {
      const retryAt = error.details?.retryAt
      return typeof retryAt === 'string' ? translate('pin.locked', { time: formatTime(retryAt) }) : errorMessage(error)
    }
  }
  return errorMessage(error)
}
