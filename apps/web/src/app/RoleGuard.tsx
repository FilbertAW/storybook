import { Navigate, Outlet } from 'react-router'
import type { Role } from '@storylib/shared'
import { useMe } from '@/api/queries'
import { ErrorNotice, Loading } from '@/components/PageState'

// The server enforces roles; this only keeps the wrong screens out of sight.
export function RoleGuard({ role }: { role: Role }) {
  const me = useMe()
  if (me.isPending) return <Loading />
  if (me.isError) return <ErrorNotice error={me.error} />
  if (me.data.user.role !== role) return <Navigate to="/" replace />
  return <Outlet />
}
