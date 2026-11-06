import { beforeEach, describe, expect, it } from 'vitest';
import { and, count, eq } from 'drizzle-orm';
import {
  errorResponseSchema,
  meResponseSchema,
  orderSchema,
  ordersResponseSchema,
  plansResponseSchema,
  subscriptionSummarySchema,
} from '@storylib/shared';
import { createApp } from '../src/app';
import { events, orders, purchases, subscriptions } from '../src/db/schema';
import { AccessService } from '../src/modules/access/access.service';
import { BooksRepository } from '../src/modules/books/books.repository';
import { CheckoutService } from '../src/modules/checkout/checkout.service';
import { OrdersRepository } from '../src/modules/checkout/orders.repository';
import { MockPaymentGateway, type PaymentGateway } from '../src/modules/checkout/payment-gateway';
import { PlansRepository } from '../src/modules/checkout/plans.repository';
import { PurchasesRepository } from '../src/modules/checkout/purchases.repository';
import { SubscriptionsRepository } from '../src/modules/subscriptions/subscriptions.repository';
import { AppError } from '../src/shared/errors';
import { JWT_SECRET, WEB_ORIGIN, buildTestApp, type TestApp } from './helpers';

const PARENT_A = 'parent.a@example.com'; // owns Kiko, no subscription
const PARENT_B = 'parent.b@example.com'; // active subscription, 20 days left
const PARENT_C = 'parent.c@example.com'; // elapsed subscription, owns the archived Kite
const SARI = 'sari@example.com';

const KIKO = 'Kiko the Little Firefly'; // 15.000, bought by A
const RAINY = 'The Rainy Day Parade'; // 15.000
const MIMI = 'Mimi and the Moon Cake'; // 20.000
const BOBO = 'Bobo Learns to Share'; // draft
const KITE = 'The Lost Kite'; // archived, bought by C

const DAY_MS = 24 * 60 * 60 * 1000;

let t: TestApp;
beforeEach(async () => {
  t = await buildTestApp();
});

const placeOrder = (token: string, json: unknown, idempotencyKey: string | null = crypto.randomUUID()) =>
  t.request('/orders', {
    method: 'POST',
    token,
    json,
    headers: idempotencyKey === null ? {} : { 'Idempotency-Key': idempotencyKey },
  });

const buyBook = async (token: string, title: string, extra: Record<string, unknown> = {}) =>
  placeOrder(token, { type: 'book', bookId: await t.bookId(title), ...extra });

const pay = (token: string, orderId: string, simulate: 'success' | 'fail' = 'success') =>
  t.request(`/orders/${orderId}/pay`, { method: 'POST', token, json: { simulate } });

const planId = async (token: string) => (await t.request('/plans', { token })).body.plans[0].id as string;

const subscribe = async (token: string, key?: string) =>
  placeOrder(token, { type: 'subscription', planId: await planId(token) }, key);

const me = async (token: string) => meResponseSchema.parse((await t.request('/me', { token })).body);

async function accessOf(token: string, title: string) {
  return (await t.request(`/books/${await t.bookId(title)}`, { token })).body.access;
}

async function countRows(table: typeof orders | typeof purchases | typeof subscriptions | typeof events, where?: ReturnType<typeof eq>) {
  const [row] = await t.db.select({ n: count() }).from(table).where(where);
  return row!.n;
}

describe('GET /plans', () => {
  it('lists the active plan for a parent', async () => {
    const res = await t.request('/plans', { token: await t.login(PARENT_A) });
    expect(plansResponseSchema.parse(res.body).plans).toEqual([
      expect.objectContaining({ name: 'Monthly', priceIdr: 49_000, periodDays: 30 }),
    ]);
  });

  it('is parent-only', async () => {
    const res = await t.request('/plans', { token: await t.login(SARI) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });
});

describe('POST /orders: a book', () => {
  it('creates a pending order at the current price, and grants nothing until it is paid', async () => {
    const parent = await t.login(PARENT_A);
    const res = await buyBook(parent, RAINY);
    expect(res.status).toBe(201);
    const order = orderSchema.parse(res.body);
    expect(order).toMatchObject({
      type: 'book',
      status: 'pending',
      bookTitle: RAINY,
      amountIdr: 15_000,
      planId: null,
      paidAt: null,
      subscriptionOverlapAck: false,
    });
    expect(await accessOf(parent, RAINY)).toEqual({ level: 'preview', reason: 'locked' });
    expect((await me(parent)).ownedBookIds).toHaveLength(1);
  });

  it('is parent-only: a creator gets 403 and a kid token gets 403 KID_MODE_FORBIDDEN', async () => {
    const asCreator = await buyBook(await t.login(SARI), RAINY);
    expect(asCreator.status).toBe(403);
    expect(asCreator.body.error.code).toBe('FORBIDDEN_ROLE');

    const asKid = await buyBook(await t.kidToken(PARENT_A), RAINY);
    expect(asKid.status).toBe(403);
    expect(asKid.body.error.code).toBe('KID_MODE_FORBIDDEN');
  });

  it('401s without a token', async () => {
    expect((await placeOrder('', { type: 'book', bookId: 'x' })).status).toBe(401);
  });

  describe('validation', () => {
    it('requires an Idempotency-Key', async () => {
      const parent = await t.login(PARENT_A);
      const body = { type: 'book', bookId: await t.bookId(RAINY) };
      for (const key of [null, '', '   ']) {
        const res = await placeOrder(parent, body, key);
        expect(res.status, String(key)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects a malformed body', async () => {
      const parent = await t.login(PARENT_A);
      for (const body of [{}, { type: 'gift' }, { type: 'book' }, { type: 'subscription' }, { type: 'book', bookId: 7 }]) {
        expect((await placeOrder(parent, body)).status, JSON.stringify(body)).toBe(400);
      }
    });

    it('404s an unknown book or plan', async () => {
      const parent = await t.login(PARENT_A);
      expect((await placeOrder(parent, { type: 'book', bookId: 'nope' })).status).toBe(404);
      expect((await placeOrder(parent, { type: 'subscription', planId: 'nope' })).status).toBe(404);
    });
  });

  describe('already owned, and not for sale', () => {
    it('409 ALREADY_OWNED for a book the parent bought', async () => {
      const res = await buyBook(await t.login(PARENT_A), KIKO);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_OWNED');
    });

    it('409 ALREADY_OWNED even when the owned book has since been archived', async () => {
      const res = await buyBook(await t.login(PARENT_C), KITE);
      expect(res.body.error.code).toBe('ALREADY_OWNED');
    });

    it('409 ALREADY_OWNED after buying it now', async () => {
      const parent = await t.login(PARENT_A);
      await pay(parent, (await buyBook(parent, RAINY)).body.id);
      expect((await buyBook(parent, RAINY)).body.error.code).toBe('ALREADY_OWNED');
    });

    it('409 BOOK_NOT_PURCHASABLE for a draft and for a retired book', async () => {
      const parent = await t.login(PARENT_A);
      for (const title of [BOBO, KITE]) {
        const res = await buyBook(parent, title);
        expect(res.status, title).toBe(409);
        expect(res.body.error.code).toBe('BOOK_NOT_PURCHASABLE');
      }
    });

    it('409 ALREADY_OWNED when the creator of the book tries to buy it (service rule)', async () => {
      // Creators cannot reach checkout over HTTP (403), but the rule still holds in the service.
      const clock = t.clock;
      const books = new BooksRepository(t.db);
      const service = new CheckoutService(
        new OrdersRepository(t.db),
        new PlansRepository(t.db),
        books,
        new AccessService(new PurchasesRepository(t.db), new SubscriptionsRepository(t.db), clock),
        new MockPaymentGateway(),
        clock,
      );
      const sari = await t.userRow(SARI);
      const error = await service
        .createOrder(sari, 'k1', { type: 'book', bookId: await t.bookId(RAINY) })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('ALREADY_OWNED');
    });
  });

  describe('idempotency', () => {
    it('returns the same order for the same key, with 200 instead of 201', async () => {
      const parent = await t.login(PARENT_A);
      const key = crypto.randomUUID();
      const first = await buyBookWithKey(parent, RAINY, key);
      const again = await buyBookWithKey(parent, RAINY, key);
      expect(first.status).toBe(201);
      expect(again.status).toBe(200);
      expect(again.body.id).toBe(first.body.id);
      expect(await countRows(orders, eq(orders.idempotencyKey, key))).toBe(1);
    });

    it('survives two requests racing with the same key', async () => {
      const parent = await t.login(PARENT_A);
      const key = crypto.randomUUID();
      const [a, b] = await Promise.all([buyBookWithKey(parent, RAINY, key), buyBookWithKey(parent, RAINY, key)]);
      expect(a.body.id).toBe(b.body.id);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(await countRows(orders, eq(orders.idempotencyKey, key))).toBe(1);
    });

    it('keeps keys separate per user', async () => {
      const key = crypto.randomUUID();
      const a = await buyBookWithKey(await t.login(PARENT_A), RAINY, key);
      const c = await buyBookWithKey(await t.login(PARENT_C), RAINY, key);
      expect(c.status).toBe(201);
      expect(c.body.id).not.toBe(a.body.id);
    });

    it('400s a key reused for a different order', async () => {
      const parent = await t.login(PARENT_A);
      const key = crypto.randomUUID();
      await buyBookWithKey(parent, RAINY, key);
      const res = await buyBookWithKey(parent, MIMI, key);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('replays an order even after the rules would now refuse it', async () => {
      const parent = await t.login(PARENT_A);
      const key = crypto.randomUUID();
      const first = await buyBookWithKey(parent, RAINY, key);
      await pay(parent, first.body.id);
      const replay = await buyBookWithKey(parent, RAINY, key);
      expect(replay.status).toBe(200);
      expect(replay.body.status).toBe('paid');
    });
  });

  async function buyBookWithKey(token: string, title: string, key: string) {
    return placeOrder(token, { type: 'book', bookId: await t.bookId(title) }, key);
  }
});

describe('buying a book while subscribed', () => {
  it('409 SUBSCRIPTION_OVERLAP_ACK_REQUIRED with the end date, until the parent confirms', async () => {
    const parent = await t.login(PARENT_B);
    const endsAt = (await me(parent)).subscription.endsAt;

    const refused = await buyBook(parent, RAINY);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('SUBSCRIPTION_OVERLAP_ACK_REQUIRED');
    expect(refused.body.error.details.subscriptionEndsAt).toBe(endsAt);
    expect(await countRows(orders, eq(orders.status, 'pending'))).toBe(0);

    const explicitNo = await buyBook(parent, RAINY, { acknowledgeSubscriptionOverlap: false });
    expect(explicitNo.status).toBe(409);
  });

  it('proceeds once acknowledged, keeps the subscription dates, and the book shows as owned', async () => {
    const parent = await t.login(PARENT_B);
    const before = (await me(parent)).subscription;
    expect(await accessOf(parent, RAINY)).toMatchObject({ reason: 'subscription' });

    const created = await buyBook(parent, RAINY, { acknowledgeSubscriptionOverlap: true });
    expect(created.status).toBe(201);
    expect(created.body.subscriptionOverlapAck).toBe(true);
    expect((await pay(parent, created.body.id)).body.status).toBe('paid');

    expect((await me(parent)).subscription).toEqual(before);
    expect(await accessOf(parent, RAINY)).toEqual({ level: 'full', reason: 'purchased' });
    expect(await accessOf(parent, MIMI)).toMatchObject({ reason: 'subscription' });
  });

  it('keeps the purchase after the subscription ends', async () => {
    const parent = await t.login(PARENT_B);
    await pay(parent, (await buyBook(parent, RAINY, { acknowledgeSubscriptionOverlap: true })).body.id);

    t.clock.advance(31 * DAY_MS);
    expect((await me(parent)).subscription.active).toBe(false);
    expect(await accessOf(parent, RAINY)).toEqual({ level: 'full', reason: 'purchased' });
    expect(await accessOf(parent, MIMI)).toEqual({ level: 'preview', reason: 'locked' });
  });

  it('does not record an acknowledgement when there was nothing to acknowledge', async () => {
    const res = await buyBook(await t.login(PARENT_A), RAINY, { acknowledgeSubscriptionOverlap: true });
    expect(res.body.subscriptionOverlapAck).toBe(false);
  });

  it('stops asking for the acknowledgement once the subscription has lapsed', async () => {
    const parent = await t.login(PARENT_B);
    t.clock.advance(31 * DAY_MS);
    expect((await buyBook(parent, RAINY)).status).toBe(201);
  });
});

describe('POST /orders: a subscription', () => {
  it('creates a pending order at the plan price and grants nothing until paid', async () => {
    const parent = await t.login(PARENT_A);
    const res = await subscribe(parent);
    expect(res.status).toBe(201);
    expect(orderSchema.parse(res.body)).toMatchObject({
      type: 'subscription',
      status: 'pending',
      planName: 'Monthly',
      amountIdr: 49_000,
      bookId: null,
    });
    expect((await me(parent)).subscription.active).toBe(false);
    expect(await accessOf(parent, RAINY)).toMatchObject({ reason: 'locked' });
  });

  it('grants a 30-day subscription once paid, opening the whole catalog', async () => {
    const parent = await t.login(PARENT_A);
    const paid = await pay(parent, (await subscribe(parent)).body.id);
    expect(paid.status).toBe(200);

    const summary = (await me(parent)).subscription;
    expect(subscriptionSummarySchema.parse(summary)).toMatchObject({
      active: true,
      planName: 'Monthly',
      cancelAtPeriodEnd: false,
      endsAt: new Date(t.clock.now() + 30 * DAY_MS).toISOString(),
    });
    expect(await accessOf(parent, RAINY)).toMatchObject({ level: 'full', reason: 'subscription' });
    expect(await accessOf(parent, KIKO)).toMatchObject({ reason: 'purchased' });
  });

  it('409 ALREADY_SUBSCRIBED while a subscription runs, cancelled or not', async () => {
    const parent = await t.login(PARENT_B);
    const first = await subscribe(parent);
    expect(first.status).toBe(409);
    expect(first.body.error.code).toBe('ALREADY_SUBSCRIBED');

    await t.request('/subscriptions/current/cancel', { method: 'POST', token: parent });
    expect((await subscribe(parent)).body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('lets a parent re-subscribe after the period ends, flipping the old row first', async () => {
    const parent = await t.login(PARENT_B);
    t.clock.advance(31 * DAY_MS);
    expect((await me(parent)).subscription.active).toBe(false);

    const paid = await pay(parent, (await subscribe(parent)).body.id);
    expect(paid.status).toBe(200);
    expect((await me(parent)).subscription.active).toBe(true);

    const user = await t.userRow(PARENT_B);
    const rows = await t.db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    expect(rows.map((r) => r.status).sort()).toEqual(['active', 'expired']);
  });

  it('lets a parent whose row is still marked active but elapsed subscribe again (seeded parent C)', async () => {
    const parent = await t.login(PARENT_C);
    expect((await me(parent)).subscription.active).toBe(false);
    const paid = await pay(parent, (await subscribe(parent)).body.id);
    expect(paid.status).toBe(200);
    expect((await me(parent)).subscription.active).toBe(true);
  });

  it('falls back to purchased books only when the subscription ends', async () => {
    const parent = await t.login(PARENT_A);
    await pay(parent, (await subscribe(parent)).body.id);
    t.clock.advance(31 * DAY_MS);
    expect(await accessOf(parent, KIKO)).toEqual({ level: 'full', reason: 'purchased' });
    expect(await accessOf(parent, RAINY)).toEqual({ level: 'preview', reason: 'locked' });
  });
});

describe('POST /subscriptions/current/cancel', () => {
  const cancel = (token: string) => t.request('/subscriptions/current/cancel', { method: 'POST', token });

  it('cancels at period end: access continues and the end date does not move', async () => {
    const parent = await t.login(PARENT_B);
    const before = (await me(parent)).subscription;
    const res = await cancel(parent);
    expect(res.status).toBe(200);
    expect(subscriptionSummarySchema.parse(res.body)).toEqual({ ...before, cancelAtPeriodEnd: true });
    expect(await accessOf(parent, RAINY)).toMatchObject({ level: 'full', reason: 'subscription' });
    expect((await me(parent)).subscription).toEqual({ ...before, cancelAtPeriodEnd: true });
  });

  it('is a no-op the second time', async () => {
    const parent = await t.login(PARENT_B);
    await cancel(parent);
    const again = await cancel(parent);
    expect(again.status).toBe(200);
    expect(again.body.cancelAtPeriodEnd).toBe(true);
  });

  it('ends access at the original period end, with no refund order', async () => {
    const parent = await t.login(PARENT_B);
    await cancel(parent);
    t.clock.advance(31 * DAY_MS);
    expect(await accessOf(parent, RAINY)).toMatchObject({ reason: 'locked' });
    const user = await t.userRow(PARENT_B);
    expect(await countRows(orders, eq(orders.userId, user.id))).toBe(1);
  });

  it('404 NO_ACTIVE_SUBSCRIPTION with no subscription, and with an elapsed one', async () => {
    for (const email of [PARENT_A, PARENT_C]) {
      const res = await cancel(await t.login(email));
      expect(res.status, email).toBe(404);
      expect(res.body.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
    }
  });

  it('is parent-only, and closed to a kid token', async () => {
    expect((await cancel(await t.login(SARI))).status).toBe(403);
    expect((await cancel(await t.kidToken(PARENT_B))).body.error.code).toBe('KID_MODE_FORBIDDEN');
  });
});

describe('POST /orders/:id/pay', () => {
  it('on success marks the order paid and grants the book, with one order_paid event', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    const res = await pay(parent, created.body.id);
    expect(res.status).toBe(200);
    expect(orderSchema.parse(res.body)).toMatchObject({ status: 'paid', failureReason: null });
    expect(res.body.paidAt).not.toBeNull();

    expect(await accessOf(parent, RAINY)).toEqual({ level: 'full', reason: 'purchased' });
    expect((await me(parent)).ownedBookIds).toContain(await t.bookId(RAINY));
    expect(await countRows(events, eq(events.name, 'order_paid'))).toBe(1);
  });

  it('on failure marks the order failed, grants nothing, and answers 402 PAYMENT_FAILED', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    const res = await pay(parent, created.body.id, 'fail');
    expect(res.status).toBe(402);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('PAYMENT_FAILED');
    expect(res.body.error.details.orderId).toBe(created.body.id);

    const failed = (await t.request('/orders', { token: parent })).body.orders.find((o: { id: string }) => o.id === created.body.id);
    expect(failed).toMatchObject({ status: 'failed', paidAt: null });
    expect(failed.failureReason).toMatch(/declined/);
    expect(await accessOf(parent, RAINY)).toMatchObject({ level: 'preview' });
    expect(await countRows(events, eq(events.name, 'order_paid'))).toBe(0);
  });

  it('refuses to pay a failed order, and a retry is a new order', async () => {
    const parent = await t.login(PARENT_A);
    const first = await buyBook(parent, RAINY);
    await pay(parent, first.body.id, 'fail');

    const again = await pay(parent, first.body.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ORDER_NOT_PENDING');

    const retry = await buyBook(parent, RAINY);
    expect(retry.status).toBe(201);
    expect(retry.body.id).not.toBe(first.body.id);
    expect((await pay(parent, retry.body.id)).status).toBe(200);
    expect(await accessOf(parent, RAINY)).toMatchObject({ level: 'full' });
  });

  it('paying a paid order again is a no-op: one purchase, one event', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    const first = await pay(parent, created.body.id);
    const second = await pay(parent, created.body.id);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const user = await t.userRow(PARENT_A);
    expect(await countRows(purchases, and(eq(purchases.userId, user.id), eq(purchases.bookId, await t.bookId(RAINY))))).toBe(1);
    expect(await countRows(events, eq(events.name, 'order_paid'))).toBe(1);
  });

  it('survives a double-click: two payments racing grant once', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    const [a, b] = await Promise.all([pay(parent, created.body.id), pay(parent, created.body.id)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.status).toBe('paid');

    const user = await t.userRow(PARENT_A);
    expect(await countRows(purchases, eq(purchases.userId, user.id))).toBe(2); // Kiko + Rainy
    expect(await countRows(events, eq(events.name, 'order_paid'))).toBe(1);
  });

  it('keeps the price from when the order was created, even if the book is repriced before payment', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    await t.request(`/books/${await t.bookId(RAINY)}`, { method: 'PATCH', token: await t.login(SARI), json: { priceIdr: 99_000 } });

    const paid = await pay(parent, created.body.id);
    expect(paid.body.amountIdr).toBe(15_000);
    const [purchase] = await t.db.select().from(purchases).where(eq(purchases.bookId, await t.bookId(RAINY)));
    expect(purchase!.pricePaidIdr).toBe(15_000);
  });

  it('keeps past orders at the price paid when the price changes later, and prices new ones at the new price', async () => {
    const sari = await t.login(SARI);
    await t.request(`/books/${await t.bookId(KIKO)}`, { method: 'PATCH', token: sari, json: { priceIdr: 40_000 } });

    const history = ordersResponseSchema.parse((await t.request('/orders', { token: await t.login(PARENT_A) })).body).orders;
    expect(history.find((o) => o.bookTitle === KIKO)?.amountIdr).toBe(15_000);

    const fresh = await buyBook(await t.login(PARENT_C), KIKO);
    expect(fresh.body.amountIdr).toBe(40_000);
  });

  it('closes a second pending order for something already granted: 409, no second grant', async () => {
    const parent = await t.login(PARENT_A);
    const one = await buyBook(parent, RAINY);
    const two = await buyBook(parent, RAINY);
    expect((await pay(parent, one.body.id)).status).toBe(200);

    const res = await pay(parent, two.body.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_OWNED');

    const history = (await t.request('/orders', { token: parent })).body.orders as Array<{ id: string; status: string }>;
    expect(history.find((o) => o.id === two.body.id)?.status).toBe('failed');
    expect(await countRows(purchases, eq(purchases.bookId, await t.bookId(RAINY)))).toBe(1);
  });

  it('does the same for two pending subscriptions', async () => {
    const parent = await t.login(PARENT_A);
    const one = await subscribe(parent);
    const two = await subscribe(parent);
    expect((await pay(parent, one.body.id)).status).toBe(200);

    const res = await pay(parent, two.body.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_SUBSCRIBED');
    const user = await t.userRow(PARENT_A);
    expect(await countRows(subscriptions, and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')))).toBe(1);
  });

  it('404s someone else\'s order and an unknown one', async () => {
    const created = await buyBook(await t.login(PARENT_A), RAINY);
    const other = await pay(await t.login(PARENT_B), created.body.id);
    expect(other.status).toBe(404);
    expect((await pay(await t.login(PARENT_A), 'nope')).status).toBe(404);
    expect(await accessOf(await t.login(PARENT_A), RAINY)).toMatchObject({ level: 'preview' });
  });

  it('400s a missing or unknown outcome, and is closed to creators and kids', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    for (const json of [{}, { simulate: 'maybe' }]) {
      expect((await t.request(`/orders/${created.body.id}/pay`, { method: 'POST', token: parent, json })).status).toBe(400);
    }
    expect((await pay(await t.login(SARI), created.body.id)).status).toBe(403);
    expect((await pay(await t.kidToken(PARENT_A), created.body.id)).body.error.code).toBe('KID_MODE_FORBIDDEN');
  });

  it('asks the injected gateway for the outcome, so a real adapter can replace the mock', async () => {
    const declining: PaymentGateway = {
      name: 'always-declines',
      charge: async () => ({ status: 'failed', reason: 'Card declined by the bank.' }),
    };
    const app = createApp({ corsOrigin: WEB_ORIGIN, jwtSecret: JWT_SECRET, db: t.db, clock: t.clock, gateway: declining });
    const token = await t.login(PARENT_A);
    const created = await buyBook(token, RAINY);

    const res = await app.request(`/api/v1/orders/${created.body.id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulate: 'success' }),
    });
    expect(res.status).toBe(402);
    const history = (await t.request('/orders', { token })).body.orders as Array<{ id: string; failureReason: string }>;
    expect(history.find((o) => o.id === created.body.id)?.failureReason).toBe('Card declined by the bank.');
  });
});

describe('payment still pending', () => {
  it('grants no access to a book or a subscription until it is paid', async () => {
    const parent = await t.login(PARENT_A);
    await buyBook(parent, RAINY);
    await subscribe(parent);
    expect(await accessOf(parent, RAINY)).toEqual({ level: 'preview', reason: 'locked' });
    expect((await me(parent)).subscription.active).toBe(false);
    const pages = await t.request(`/books/${await t.bookId(RAINY)}/pages/3`, { token: parent });
    expect(pages.status).toBe(403);
  });
});

describe('GET /orders', () => {
  it('lists only the parent\'s own orders, newest first, with titles', async () => {
    const parent = await t.login(PARENT_A);
    const created = await buyBook(parent, RAINY);
    const res = await t.request('/orders', { token: parent });
    const list = ordersResponseSchema.parse(res.body).orders;
    expect(list.map((o) => o.id)[0]).toBe(created.body.id);
    expect(list.map((o) => o.bookTitle)).toEqual([RAINY, KIKO]);
    expect(list.every((o) => o.type === 'book')).toBe(true);

    const other = ordersResponseSchema.parse((await t.request('/orders', { token: await t.login(PARENT_B) })).body).orders;
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({ type: 'subscription', planName: 'Monthly' });
  });

  it('is parent-only', async () => {
    expect((await t.request('/orders', { token: await t.login(SARI) })).status).toBe(403);
  });
});
