import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { errorMessage } from '@/api/errors'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorNotice({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>
}
