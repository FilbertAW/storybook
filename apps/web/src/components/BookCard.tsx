import type { BookSummaryDto } from '@storylib/shared'
import { Link } from 'react-router'
import { AccessBadge } from '@/components/AccessBadge'
import { formatIdr } from '@/lib/format'

export function BookCard({ book }: { book: BookSummaryDto }) {
  const showPrice = book.access.reason === 'locked' && book.priceIdr !== undefined
  return (
    <Link
      to={`/books/${book.id}`}
      className="group flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
        <img
          src={book.coverUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-[1.03]"
        />
        <div className="absolute top-2 left-2">
          <AccessBadge access={book.access} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">{book.title}</h3>
        <p className="text-xs text-muted-foreground">
          Ages {book.ageMin}–{book.ageMax}
          {showPrice ? ` · ${formatIdr(book.priceIdr!)}` : ''}
        </p>
      </div>
    </Link>
  )
}
