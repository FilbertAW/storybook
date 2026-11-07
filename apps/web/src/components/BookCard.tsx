import type { BookSummaryDto } from '@storylib/shared'
import { Link } from 'react-router'
import { AccessBadge } from '@/components/AccessBadge'
import { useT } from '@/i18n'
import { formatIdr } from '@/lib/format'

const CARD_CLASS = 'group flex flex-col gap-2 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

// A locked book calls onPreview (a modal) when given one; everything else opens its page.
export function BookCard({ book, onPreview }: { book: BookSummaryDto; onPreview?: (book: BookSummaryDto) => void }) {
  const { t } = useT()
  const locked = book.access.reason === 'locked'
  const showPrice = locked && book.priceIdr !== undefined
  const content = (
    <>
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
          {t('book.ages', { min: book.ageMin, max: book.ageMax })}
          {showPrice ? ` · ${formatIdr(book.priceIdr!)}` : ''}
        </p>
      </div>
    </>
  )
  if (locked && onPreview) {
    return (
      <button type="button" className={CARD_CLASS} onClick={() => onPreview(book)}>
        {content}
      </button>
    )
  }
  return (
    <Link to={`/books/${book.id}`} className={CARD_CLASS}>
      {content}
    </Link>
  )
}
