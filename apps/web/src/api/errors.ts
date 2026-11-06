import type { ErrorCode } from '@storylib/shared'

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

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.'
