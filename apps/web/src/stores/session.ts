import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'parent' | 'kid'

// Client state only: who is signed in (the token) and which mode the device is in.
// Anything the server owns (the user, books, access, orders) lives in TanStack Query.
interface SessionState {
  token: string | null
  mode: Mode
  setSession: (token: string, mode: Mode) => void
  clear: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      mode: 'parent',
      setSession: (token, mode) => set({ token, mode }),
      clear: () => set({ token: null, mode: 'parent' }),
    }),
    // Persisted so a reload stays signed in, and stays in Kid mode. Entering Kid
    // mode overwrites the parent token here, so nothing else holds on to it.
    { name: 'storylib-session', partialize: (s) => ({ token: s.token, mode: s.mode }) },
  ),
)
