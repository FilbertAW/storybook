import { useMutation } from '@tanstack/react-query'
import { Lock, Smile } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { authApi } from '@/api/endpoints'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { PinPad } from '@/components/PinPad'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { startSession } from '@/features/session/actions'
import { useT } from '@/i18n'
import { pinErrorMessage } from './pinErrors'

// Kid mode has no navigation to the rest of the app. The only way out is the
// parent's PIN, and the server checks it, not this screen.
export function KidShell() {
  const { t } = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const unlock = useMutation({
    mutationFn: authApi.parentUnlock,
    onSuccess: ({ token }) => {
      startSession(token, 'parent')
      navigate('/account', { replace: true })
    },
  })

  return (
    <div className="flex min-h-screen flex-col bg-amber-50 dark:bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Smile className="size-6" /> {t('kid.title')}
        </h1>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              unlock.reset()
              setOpen(true)
            }}
          >
            <Lock /> {t('kid.parent')}
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10">
        <Outlet />
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('kid.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('kid.dialogBody')}</DialogDescription>
          </DialogHeader>
          {unlock.isError && (
            <Alert variant="destructive">
              <AlertDescription>{pinErrorMessage(unlock.error)}</AlertDescription>
            </Alert>
          )}
          <PinPad busy={unlock.isPending} onSubmit={(pin) => unlock.mutate(pin)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
