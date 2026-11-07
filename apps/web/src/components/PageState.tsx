import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { errorMessage } from '@/api/errors'
import { useT } from '@/i18n'

export function Loading({ label }: { label?: string }) {
  const { t } = useT()
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label ?? t('common.loading')}
    </div>
  )
}

export function ErrorNotice({ error, title, message }: { error?: unknown; title?: string; message?: string }) {
  const { t } = useT()
  return (
    <Alert variant="destructive">
      <AlertTitle>{title ?? t('common.error')}</AlertTitle>
      <AlertDescription>{message ?? errorMessage(error)}</AlertDescription>
    </Alert>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>
}
