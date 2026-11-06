import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessionStore } from '@/stores/session'

// Keeps each mode in its own part of the app. A device in Kid mode can only be in
// /kid, whatever URL it opens, and a parent session never lands there.
export function SessionGate() {
  const { token, mode } = useSessionStore()
  const { pathname } = useLocation()
  const inKidArea = pathname === '/kid' || pathname.startsWith('/kid/')

  if (!token) return <Navigate to="/login" replace />
  if (mode === 'kid' && !inKidArea) return <Navigate to="/kid" replace />
  if (mode === 'parent' && inKidArea) return <Navigate to="/" replace />
  return <Outlet />
}
