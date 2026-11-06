import { Delete } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const MIN = 4
const MAX = 6

interface PinPadProps {
  onSubmit: (pin: string) => void
  busy?: boolean
  submitLabel?: string
}

// A 4 to 6 digit entry pad. The parent types the PIN, never the child, so it is
// a plain keypad rather than a keyboard.
export function PinPad({ onSubmit, busy = false, submitLabel = 'Unlock' }: PinPadProps) {
  const [pin, setPin] = useState('')

  const press = (digit: string) => setPin((p) => (p.length < MAX ? p + digit : p))
  const submit = () => {
    if (pin.length >= MIN && !busy) {
      onSubmit(pin)
      setPin('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex h-6 items-center gap-2" aria-label={`${pin.length} digits entered`} role="img">
        {Array.from({ length: MAX }, (_, i) => (
          <span
            key={i}
            className={`size-3 rounded-full border ${i < pin.length ? 'border-foreground bg-foreground' : 'border-muted-foreground/40'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button key={d} variant="outline" className="size-14 text-lg" onClick={() => press(d)} disabled={busy}>
            {d}
          </Button>
        ))}
        <Button variant="ghost" className="size-14" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy || !pin}>
          <Delete />
        </Button>
        <Button variant="outline" className="size-14 text-lg" onClick={() => press('0')} disabled={busy}>
          0
        </Button>
        <Button className="size-14" onClick={submit} disabled={busy || pin.length < MIN} aria-label={submitLabel}>
          OK
        </Button>
      </div>
    </div>
  )
}
