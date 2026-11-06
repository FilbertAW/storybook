import type { Access } from '@storylib/shared'
import { Check, Lock, PenLine, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// One badge per access reason. "Owned" wins over "Subscribed", as the server decides.
export function AccessBadge({ access }: { access: Access }) {
  switch (access.reason) {
    case 'owner':
      return (
        <Badge variant="secondary">
          <PenLine data-icon="inline-start" /> Yours
        </Badge>
      )
    case 'purchased':
      return (
        <Badge>
          <Check data-icon="inline-start" /> Owned
        </Badge>
      )
    case 'subscription':
      return (
        <Badge variant="secondary">
          <Sparkles data-icon="inline-start" /> Subscribed
        </Badge>
      )
    case 'locked':
      return (
        <Badge variant="outline" className="bg-background/90">
          <Lock data-icon="inline-start" /> Locked
        </Badge>
      )
  }
}
