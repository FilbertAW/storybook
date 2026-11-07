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
        <p className="text-sm text-muted-foreground">Picture books for ages 2–8.</p>
      </div>

      {login.isError && <ErrorNotice title="Could not sign in" error={login.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the email address of your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) login.mutate(email.trim())
            }}
          >
            <Input
              type="email"
              placeholder="you@example.com"
              aria-label="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={login.isPending || !email.trim()}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
