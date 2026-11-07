import { useMutation } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { authApi } from '@/api/endpoints'
import { ErrorNotice } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { startSession } from '@/features/session/actions'
import { useSessionStore } from '@/stores/session'

// The seeded accounts (see the README). Login is a mock: pick one, get a signed token.
const DEMO_ACCOUNTS = [
  { email: 'parent.a@example.com', label: 'Parent A', note: 'No subscription · owns one book · PIN 1234' },
  { email: 'parent.b@example.com', label: 'Parent B', note: 'Active subscription · PIN 1234' },
  { email: 'parent.c@example.com', label: 'Parent C', note: 'Subscription ended · owns a retired book · no PIN yet' },
  { email: 'sari@example.com', label: 'Sari (creator)', note: '3 published books' },
  { email: 'budi@example.com', label: 'Budi (creator)', note: '3 published books and a retired one' },
]

export function LoginPage() {
  const { token, mode } = useSessionStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ token }) => {
      startSession(token, 'parent')
      navigate('/', { replace: true })
    },
  })

  if (token) return <Navigate to={mode === 'kid' ? '/kid' : '/'} replace />

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <BookOpen className="size-9" />
        <h1 className="text-2xl font-semibold">Storybook Library</h1>
        <p className="text-sm text-muted-foreground">Picture books for ages 2–8. Pick an account to sign in.</p>
      </div>

      {login.isError && <ErrorNotice title="Could not sign in" error={login.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Demo accounts</CardTitle>
          <CardDescription>No password: this is a mock login for the demo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <Button
              key={a.email}
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-2 whitespace-normal"
              disabled={login.isPending}
              onClick={() => login.mutate(a.email)}
            >
              <span>{a.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{a.note}</span>
            </Button>
          ))}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) login.mutate(email.trim())
            }}
          >
            <Input
              type="email"
              placeholder="or type a seeded email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={login.isPending || !email.trim()}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
