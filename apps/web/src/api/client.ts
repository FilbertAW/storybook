import { errorResponseSchema } from '@storylib/shared'
import { useSessionStore } from '@/stores/session'
import { ApiError } from './errors'

const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/api/v1`

// Structural, so the web app does not need its own zod dependency.
interface Parser<T> {
  parse(data: unknown): T
}

interface RequestOptions {
  method?: string
  json?: unknown
  headers?: Record<string, string>
}

let onUnauthenticated: (() => void) | undefined
export const setUnauthenticatedHandler = (handler: () => void) => {
  onUnauthenticated = handler
}

export async function request<T>(
  path: string,
  parser: Parser<T> | null,
  { method = 'GET', json, headers }: RequestOptions = {},
): Promise<T> {
  // Read at call time so the newest token is always used, never a stale closure.
  const token = useSessionStore.getState().token

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection and try again.', 0)
  }

  if (res.status === 204) return undefined as T
  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(body)
    const error = parsed.success
      ? new ApiError(parsed.data.error.code, parsed.data.error.message, res.status, parsed.data.error.details)
      : new ApiError('INTERNAL', 'Something went wrong.', res.status)
    // A token the server no longer accepts ends the session.
    if (error.code === 'UNAUTHENTICATED' && token) onUnauthenticated?.()
    throw error
  }
  return parser ? parser.parse(body) : (body as T)
}
