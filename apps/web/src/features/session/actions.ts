import { queryClient } from '@/app/queryClient'
import { useSessionStore, type Mode } from '@/stores/session'

// Every switch of who or what mode is using the device clears the query cache,
// so nothing fetched under one token is ever shown under another.
export function startSession(token: string, mode: Mode) {
  queryClient.clear()
  useSessionStore.getState().setSession(token, mode)
}

export function endSession() {
  queryClient.clear()
  useSessionStore.getState().clear()
}
