import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { logEvent } from '@/api/endpoints'
import { useBook, useBookPages, useMe, usePlans } from '@/api/queries'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { plural, useT } from '@/i18n'
import { formatIdr } from '@/lib/format'
import { cn } from '@/lib/utils'

// One reader for both modes. In Kid mode the server only ever returns books the
// family can read in full, so there is never a paywall, a price or a buy button.
export function ReaderPage({ kid = false }: { kid?: boolean }) {
  const { t } = useT()
  const { id } = useParams()
  const pages = useBookPages(id)
  const book = useBook(id)
  const me = useMe()
  const plans = usePlans(!kid) // a kid token is refused by /plans
  const [index, setIndex] = useState(0)
  const opened = useRef<string | null>(null)
  const previewLogged = useRef<string | null>(null)

  const data = pages.data
  const shown = data?.pages.length ?? 0
  const paywall = !!data && data.lockedFrom !== null
  const lastIndex = paywall ? shown : shown - 1
  const atPaywall = paywall && index === shown

  useEffect(() => {
    if (id && opened.current !== id) {
      opened.current = id
      logEvent('book_opened', id)
    }
  }, [id])

  useEffect(() => {
    if (id && atPaywall && previewLogged.current !== id) {
      previewLogged.current = id
      logEvent('preview_completed', id)
    }
  }, [id, atPaywall])

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(lastIndex, 0))),
    [lastIndex],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (pages.isPending) return <Loading label={t('reader.opening')} />
  if (pages.isError) return <ErrorNotice error={pages.error} title={t('book.unavailable')} />

  const loaded = pages.data
  const backTo = kid ? '/kid' : `/books/${id}`
  const page = loaded.pages[index]
  const isCreator = me.data?.user.role === 'creator'
  const plan = plans.data?.plans[0]
  const price = book.data?.priceIdr

  return (
    <div className={cn('mx-auto flex w-full max-w-2xl flex-col gap-4', kid && 'max-w-3xl')}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size={kid ? 'lg' : 'sm'} render={<Link to={backTo} />} nativeButton={false}>
          <ArrowLeft /> {kid ? t('common.back') : t('reader.book')}
        </Button>
        <p className="truncate text-sm text-muted-foreground">{book.data?.title}</p>
      </div>

      {atPaywall ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 px-6 py-12 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('reader.previewTitle')}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t(plural('reader.locked', loaded.totalPages - shown), { count: loaded.totalPages - shown })}
          </p>
          {isCreator ? (
            <p className="text-sm text-muted-foreground">{t('reader.creatorNote')}</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {price !== undefined && (
                <Button size="lg" render={<Link to={`/checkout/book/${id}`} />} nativeButton={false}>
                  {t('book.buy', { price: formatIdr(price) })}
                </Button>
              )}
              {plan && (
                <Button size="lg" variant="outline" render={<Link to="/checkout/subscription" />} nativeButton={false}>
                  {t('book.subscribe', { price: formatIdr(plan.priceIdr) })}
                </Button>
              )}
            </div>
          )}
        </section>
      ) : (
        page && (
          <article className="flex flex-col gap-4">
            <img src={page.imageUrl} alt="" className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover" />
            <p className={cn('text-center leading-relaxed text-balance', kid ? 'text-2xl' : 'text-lg')}>{page.text}</p>
          </article>
        )
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size={kid ? 'lg' : 'default'} onClick={() => go(-1)} disabled={index === 0}>
          <ChevronLeft /> {t('common.back')}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {atPaywall ? t('reader.previewEnded') : t('reader.page', { n: index + 1, total: loaded.totalPages })}
        </p>
        <Button size={kid ? 'lg' : 'default'} onClick={() => go(1)} disabled={index >= lastIndex}>
          {t('common.next')} <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
