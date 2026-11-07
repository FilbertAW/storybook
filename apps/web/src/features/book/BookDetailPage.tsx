import { ArrowLeft, BookOpen, Lock } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useBook, useMe, usePlans } from '@/api/queries'
import { AccessBadge } from '@/components/AccessBadge'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { formatIdr } from '@/lib/format'

export function BookDetailPage() {
  const { t } = useT()
  const { id } = useParams()
  const book = useBook(id)
  const me = useMe()
  const plans = usePlans()

  if (book.isPending) return <Loading />
  if (book.isError) return <ErrorNotice error={book.error} title={t('book.unavailable')} />

  const b = book.data
  const isCreator = me.data?.user.role === 'creator'
  const plan = plans.data?.plans[0]
  const full = b.access.level === 'full'
  const archived = b.status === 'archived'

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="self-start" render={<Link to="/" />} nativeButton={false}>
        <ArrowLeft /> {t('nav.library')}
      </Button>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <img src={b.coverUrl} alt={t('book.coverAlt', { title: b.title })} className="aspect-[3/4] w-full max-w-56 rounded-xl bg-muted object-cover" />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <AccessBadge access={b.access} />
            <h1 className="text-2xl leading-tight font-semibold">{b.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t('book.byline', { author: b.authorName, min: b.ageMin, max: b.ageMax, pages: b.pageCount })}
            </p>
          </div>
          <p className="text-sm leading-relaxed">{b.description}</p>

          {archived && (
            <Alert>
              <AlertDescription>{t('book.archivedNote')}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" render={<Link to={`/books/${b.id}/read`} />} nativeButton={false}>
              <BookOpen /> {full ? t('book.read') : t('book.readPreview', { count: b.previewPageCount })}
            </Button>

            {!full && !isCreator && b.priceIdr !== undefined && (
              <>
                <Button size="lg" variant="secondary" render={<Link to={`/checkout/book/${b.id}`} />} nativeButton={false}>
                  <Lock /> {t('book.buy', { price: formatIdr(b.priceIdr) })}
                </Button>
                {plan && (
                  <Button size="lg" variant="outline" render={<Link to="/checkout/subscription" />} nativeButton={false}>
                    {t('book.subscribe', { price: formatIdr(plan.priceIdr) })}
                  </Button>
                )}
              </>
            )}

            {b.access.reason === 'subscription' && !isCreator && b.priceIdr !== undefined && (
              <Button size="lg" variant="outline" render={<Link to={`/checkout/book/${b.id}`} />} nativeButton={false}>
                {t('book.buyToKeep', { price: formatIdr(b.priceIdr) })}
              </Button>
            )}
          </div>

          {b.access.reason === 'subscription' && (
            <p className="text-xs text-muted-foreground">
              {t('book.subscribedNote')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
