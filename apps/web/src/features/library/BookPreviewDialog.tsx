import type { BookSummaryDto } from '@storylib/shared'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { logEvent } from '@/api/endpoints'
import { useBookPages, useMe, usePlans } from '@/api/queries'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { plural, useT } from '@/i18n'
import { formatIdr } from '@/lib/format'

// A locked book opens here instead of a new page: the price and the ways to unlock sit
// above the preview, so a parent can read a few pages and decide without leaving the library.
export function BookPreviewDialog({ book, onClose }: { book: BookSummaryDto; onClose: () => void }) {
  const { t } = useT()
  const pages = useBookPages(book.id)
  const me = useMe()
  const plans = usePlans()
  const [index, setIndex] = useState(0)
  const completed = useRef(false)

  const isCreator = me.data?.user.role === 'creator'
  const plan = plans.data?.plans[0]
  const loaded = pages.data
  const shown = loaded?.pages.length ?? 0
  const page = loaded?.pages[index]
  const atEnd = !!loaded && shown > 0 && index === shown - 1

  useEffect(() => {
    logEvent('book_opened', book.id)
  }, [book.id])

  useEffect(() => {
    if (atEnd && !completed.current) {
      completed.current = true
      logEvent('preview_completed', book.id)
    }
  }, [atEnd, book.id])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg leading-snug">{book.title}</DialogTitle>
          <DialogDescription>
            {book.authorName} · {t('book.ages', { min: book.ageMin, max: book.ageMax })}
          </DialogDescription>
        </DialogHeader>

        {!isCreator && book.priceIdr !== undefined && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3">
            <p className="mr-auto text-lg font-semibold">{formatIdr(book.priceIdr)}</p>
            <Button render={<Link to={`/checkout/book/${book.id}`} />} nativeButton={false}>
              {t('preview.buy')}
            </Button>
            {plan && (
              <Button variant="outline" render={<Link to="/checkout/subscription" />} nativeButton={false}>
                {t('book.subscribe', { price: formatIdr(plan.priceIdr) })}
              </Button>
            )}
          </div>
        )}

        {pages.isPending && <Loading label={t('preview.opening')} />}
        {pages.isError && <ErrorNotice error={pages.error} title={t('preview.loadError')} />}
        {loaded && page && (
          <div className="flex flex-col gap-3">
            <img src={page.imageUrl} alt="" className="aspect-[4/3] w-full rounded-xl bg-muted object-cover" />
            <p className="text-center leading-relaxed text-balance">{page.text}</p>
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
                <ChevronLeft /> {t('common.back')}
              </Button>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {t('preview.page', { n: index + 1, shown, total: loaded.totalPages })}
              </p>
              <Button size="sm" onClick={() => setIndex((i) => i + 1)} disabled={atEnd}>
                {t('common.next')} <ChevronRight />
              </Button>
            </div>
            {atEnd && loaded.totalPages > shown && (
              <p className="text-center text-sm text-muted-foreground">
                {t(plural('preview.end', loaded.totalPages - shown), { count: loaded.totalPages - shown })}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
