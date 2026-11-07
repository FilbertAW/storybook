import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'

// A button that shows a spinner and cannot be pressed again while its request is in flight.
export function LoadingButton({
  pending = false,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button {...props} disabled={disabled || pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  )
}
