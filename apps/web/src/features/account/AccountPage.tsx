import { PIN_LENGTH } from '@storylib/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Smile } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { authApi, checkoutApi } from '@/api/endpoints'
import { keys, useMe, useOrders } from '@/api/queries'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { endSession, startSession } from '@/features/session/actions'
import { pinErrorMessage } from '@/features/kid/pinErrors'
import { formatDate, formatIdr } from '@/lib/format'

export function AccountPage() {
  const me = useMe()

  if (me.isPending) return <Loading />
  if (me.isError) return <ErrorNotice error={me.error} />

  const { user, pinSet, subscription } = me.data
  const isParent = user.role === 'parent'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>
            {user.email} · {user.role}
          </CardDescription>
        </CardHeader>
      </Card>

      {isParent && <SubscriptionCard subscription={subscription} />}
      {isParent && <KidModeCard pinSet={pinSet} />}
      {isParent && <OrdersCard />}

      <Button variant="outline" className="self-start" onClick={endSession}>
        <LogOut /> Log out
      </Button>
    </div>
  )
}

function SubscriptionCard({ subscription }: { subscription: NonNullable<ReturnType<typeof useMe>['data']>['subscription'] }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const cancel = useMutation({
    mutationFn: checkoutApi.cancelSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.me })
      setConfirming(false)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>
          {subscription.active
            ? `${subscription.planName} · ${subscription.cancelAtPeriodEnd ? 'ends' : 'active until'} ${formatDate(subscription.endsAt!)}`
            : 'You are not subscribed.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {subscription.active && subscription.cancelAtPeriodEnd && (
          <Alert>
            <AlertDescription>
              Cancelled. You can keep reading until {formatDate(subscription.endsAt!)}. Books you bought stay yours.
            </AlertDescription>
          </Alert>
        )}
        {subscription.active && !subscription.cancelAtPeriodEnd && (
          <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
            Cancel subscription
          </Button>
        )}
        {!subscription.active && (
          <Button className="self-start" render={<Link to="/checkout/subscription" />} nativeButton={false}>
            Subscribe
          </Button>
        )}
      </CardContent>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              You keep access until {subscription.endsAt ? formatDate(subscription.endsAt) : 'the end of the period'}. There
              is no refund, and books you bought stay yours.
            </DialogDescription>
          </DialogHeader>
          {cancel.isError && <ErrorNotice error={cancel.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function KidModeCard({ pinSet }: { pinSet: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saved, setSaved] = useState(false)

  const enter = useMutation({
    mutationFn: authApi.enterKidMode,
    onSuccess: ({ token }) => {
      // The parent token is replaced, not kept: a reload stays in Kid mode.
      startSession(token, 'kid')
      navigate('/kid', { replace: true })
    },
  })

  const save = useMutation({
    mutationFn: () => authApi.setPin(pin, pinSet ? currentPin : undefined),
    onSuccess: async () => {
      setCurrentPin('')
      setPin('')
      setConfirm('')
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: keys.me })
    },
  })

  const validNew = /^\d{4}$/.test(pin) && pin === confirm
  const canSave = validNew && (!pinSet || currentPin.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smile className="size-4" /> Kid mode
        </CardTitle>
        <CardDescription>
          {pinSet
            ? 'Hand the device to your child. Books they can read show up with no prices or buy buttons. Your PIN brings you back.'
            : 'Set a 4 to 6 digit PIN first. It is the only way back out of Kid mode.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {enter.isError && <ErrorNotice error={enter.error} title="Could not start Kid mode" />}
        {pinSet && (
          <Button size="lg" className="self-start" disabled={enter.isPending} onClick={() => enter.mutate()}>
            <Smile /> Start Kid mode
          </Button>
        )}

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            setSaved(false)
            if (canSave) save.mutate()
          }}
        >
          <p className="text-sm font-medium">{pinSet ? 'Change PIN' : 'Set a PIN'}</p>
          {pinSet && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current-pin">Current PIN</Label>
              <Input id="current-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pin">New PIN</Label>
              <Input id="new-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-pin">Repeat new PIN</Label>
              <Input id="confirm-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          {pin && !/^\d{4}$/.test(pin) && <p className="text-xs text-destructive">Use exactly 4 digits.</p>}
          {confirm && pin !== confirm && <p className="text-xs text-destructive">The two PINs do not match.</p>}
          {save.isError && (
            <Alert variant="destructive">
              <AlertDescription>{pinErrorMessage(save.error)}</AlertDescription>
            </Alert>
          )}
          {saved && (
            <Alert>
              <AlertDescription>PIN saved.</AlertDescription>
            </Alert>
          )}
          <Button type="submit" variant="secondary" className="self-start" disabled={!canSave || save.isPending}>
            {pinSet ? 'Change PIN' : 'Save PIN'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function OrdersCard() {
  const orders = useOrders()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.isPending && <Loading />}
        {orders.isError && <ErrorNotice error={orders.error} />}
        {orders.data && orders.data.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        {orders.data && orders.data.orders.length > 0 && (
          <ul className="flex flex-col divide-y">
            {orders.data.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{o.bookTitle ?? `${o.planName} subscription`}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={o.status === 'paid' ? 'default' : o.status === 'failed' ? 'destructive' : 'secondary'}>{o.status}</Badge>
                  <span className="w-24 text-right tabular-nums">{formatIdr(o.amountIdr)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
