import { useMutation } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { authApi } from '@/api/endpoints'
import { LoadingButton } from '@/components/LoadingButton'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { ErrorNotice } from '@/components/PageState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { startSession } from '@/features/session/actions'
import { useT } from '@/i18n'
import { useSessionStore } from '@/stores/session'

export function LoginPage() {
  const { t } = useT()
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
        <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </div>

      {login.isError && <ErrorNotice title={t('login.error')} error={login.error} />}

      <Card>
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.description')}</CardDescription>
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
              placeholder={t('login.emailPlaceholder')}
              aria-label={t('login.email')}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <LoadingButton type="submit" size="lg" pending={login.isPending} disabled={!email.trim()}>
              {t('login.submit')}
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
      <div className="flex justify-center">
        <LanguageSwitch />
      </div>
    </main>
  )
}
