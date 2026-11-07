import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, TriangleAlert, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { checkoutApi } from '@/api/endpoints'
import { keys, useBook, usePlans } from '@/api/queries'
import { LoadingButton } from '@/components/LoadingButton'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useT } from '@/i18n'
import { formatDate, formatIdr } from '@/lib/format'
import type { OrderDto } from '@storylib/shared'

type Phase = 'review' | 'warning' | 'payment' | 'success' | 'failed'

// Buying a book (/checkout/book/:id) and subscribing (/checkout/subscription) share one flow:
// review -> (overlap warning) -> mock payment -> result.
export function CheckoutPage({ kind }: { kind: 'book' | 'subscription' }) {
  const { t } = useT()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const book = useBook(kind === 'book' ? id : undefined)
  const plans = usePlans()
  const plan = plans.data?.plans[0]

  const [phase, setPhase] = useState<Phase>('review')
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  // One key per attempt: a double-click or a retried request returns the same order.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const createOrder = useMutation({
    mutationFn: (acknowledge: boolean) =>
      checkoutApi.createOrder(
        idempotencyKey,
        kind === 'book'
          ? { type: 'book', bookId: id!, ...(acknowledge ? { acknowledgeSubscriptionOverlap: true } : {}) }
          : { type: 'subscription', planId: plan!.id },
      ),
    onSuccess: (created) => {
      setOrder(created)
      setPhase('payment')
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'SUBSCRIPTION_OVERLAP_ACK_REQUIRED') {
        setEndsAt(String(error.details?.subscriptionEndsAt ?? ''))
        setPhase('warning')
      }
    },
  })

  const pay = useMutation({
    mutationFn: (simulate: 'success' | 'fail') => checkoutApi.pay(order!.id, simulate),
    onSuccess: async () => {
      // Access changed, so everything derived from it is refetched.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.books }),
        queryClient.invalidateQueries({ queryKey: keys.me }),
        queryClient.invalidateQueries({ queryKey: keys.orders }),
      ])
      setPhase('success')
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PAYMENT_FAILED') setPhase('failed')
    },
  })

  if (kind === 'book' && book.isPending) return <Loading />
  if (kind === 'book' && book.isError) return <ErrorNotice error={book.error} title={t('book.unavailable')} />
  if (kind === 'subscription' && plans.isPending) return <Loading />
  if (kind === 'subscription' && !plan) return <ErrorNotice error={plans.error} message={plans.error ? undefined : t('error.noPlan')} />

  const title = kind === 'book' ? book.data!.title : t('checkout.subTitle', { plan: plan!.name })
  const amount = kind === 'book' ? book.data!.priceIdr! : plan!.priceIdr
  const backTo = kind === 'book' ? `/books/${id}` : '/account'
  const blockingError = createOrder.isError && !(createOrder.error instanceof ApiError && createOrder.error.code === 'SUBSCRIPTION_OVERLAP_ACK_REQUIRED')

  const retry = () => {
    createOrder.reset()
    pay.reset()
    setOrder(null)
    setIdempotencyKey(crypto.randomUUID())
    setPhase('review')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> {t('checkout.title')}
          </CardTitle>
          <CardDescription>
            {kind === 'book' ? t('checkout.bookNote') : t('checkout.subNote', { days: plan!.periodDays })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {kind === 'book' && <img src={book.data!.coverUrl} alt="" className="h-20 w-15 rounded-md bg-muted object-cover" />}
          <div className="flex flex-1 flex-col">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{kind === 'book' ? t('checkout.by', { author: book.data!.authorName }) : t('checkout.catalog')}</span>
          </div>
          <span className="font-semibold">{formatIdr(amount)}</span>
        </CardContent>

        {phase === 'review' && (
          <CardFooter className="flex-col items-stretch gap-3">
            {blockingError && <ErrorNotice error={createOrder.error} title={t('checkout.blocked')} />}
            <LoadingButton size="lg" pending={createOrder.isPending} onClick={() => createOrder.mutate(false)}>
              {t('checkout.continue')}
            </LoadingButton>
            <Button variant="ghost" render={<Link to={backTo} />} nativeButton={false}>
              {t('common.cancel')}
            </Button>
          </CardFooter>
        )}

        {phase === 'warning' && (
          <CardFooter className="flex-col items-stretch gap-3">
            <Alert>
              <TriangleAlert />
              <AlertTitle>{t('checkout.warning.title')}</AlertTitle>
              <AlertDescription>
                {t('checkout.warning.body', { date: endsAt ? formatDate(endsAt) : t('checkout.warning.noDate') })}
              </AlertDescription>
            </Alert>
            <LoadingButton size="lg" pending={createOrder.isPending} onClick={() => createOrder.mutate(true)}>
              {t('checkout.buyAnyway')}
            </LoadingButton>
            <Button variant="ghost" render={<Link to={backTo} />} nativeButton={false}>
              {t('checkout.notNow')}
            </Button>
          </CardFooter>
        )}

        {phase === 'payment' && order && (
          <CardFooter className="flex-col items-stretch gap-3">
            {pay.isError && !(pay.error instanceof ApiError && pay.error.code === 'PAYMENT_FAILED') && (
              <ErrorNotice error={pay.error} title={t('checkout.payError')} />
            )}
            <LoadingButton size="lg" pending={pay.isPending} onClick={() => pay.mutate('success')}>
              {t('checkout.pay', { amount: formatIdr(order.amountIdr) })}
            </LoadingButton>
            {/* To demo a failed payment, add a second button here:
                <Button variant="outline" disabled={pay.isPending} onClick={() => pay.mutate('fail')}>
                  Simulate failure
                </Button>
                The API already supports it (`simulate: 'fail'`) and the 'failed' phase below handles the result. */}
          </CardFooter>
        )}

        {phase === 'success' && (
          <CardFooter className="flex-col items-stretch gap-3">
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{t('checkout.success.title')}</AlertTitle>
              <AlertDescription>
                {kind === 'book' ? t('checkout.success.book') : t('checkout.success.sub')}
              </AlertDescription>
            </Alert>
            <Button size="lg" render={<Link to={kind === 'book' ? `/books/${id}/read` : '/'} />} nativeButton={false}>
              {kind === 'book' ? t('checkout.startReading') : t('checkout.browse')}
            </Button>
          </CardFooter>
        )}

        {phase === 'failed' && (
          <CardFooter className="flex-col items-stretch gap-3">
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>{t('checkout.failed.title')}</AlertTitle>
              <AlertDescription>{t('checkout.failed.body')}</AlertDescription>
            </Alert>
            <Button size="lg" onClick={retry}>
              {t('checkout.tryAgain')}
            </Button>
            <Button variant="ghost" render={<Link to={backTo} />} nativeButton={false}>
              {t('common.cancel')}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
