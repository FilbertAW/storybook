import { BookOpen, LogOut, PenLine, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useMe } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { endSession } from '@/features/session/actions'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
    isActive && 'bg-muted text-foreground',
  )

export function ParentShell() {
  const me = useMe()
  const isCreator = me.data?.user.role === 'creator'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5" /> Storybook Library
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Library
            </NavLink>
            {isCreator && (
              <NavLink to="/creator" className={navClass}>
                <PenLine className="size-4" /> Creator
              </NavLink>
            )}
            <NavLink to="/account" className={navClass}>
              <User className="size-4" /> Account
            </NavLink>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={endSession}>
              <LogOut />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
