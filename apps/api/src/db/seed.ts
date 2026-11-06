import type { Db } from './client';
import { hashPin } from '../shared/pin';
import {
  bookPages,
  books,
  events,
  orders,
  plans,
  purchases,
  subscriptions,
  users,
} from './schema';
import { DEMO_PIN, SEED_BOOKS, SEED_PLAN, SEED_USERS, pageImage } from './seed-data';

const DAY_MS = 24 * 60 * 60 * 1000;

// Wipes the tables and loads the demo scenarios. Time-based rows are relative to
// `now`, so the "expired" and "active" subscriptions stay correct whenever it runs.
export async function seedDatabase(db: Db, now: number) {
  await db.transaction(async (tx) => {
    await tx.delete(events);
    await tx.delete(purchases);
    await tx.delete(subscriptions);
    await tx.delete(orders);
    await tx.delete(bookPages);
    await tx.delete(books);
    await tx.delete(plans);
    await tx.delete(users);

    // Parent C has no PIN on purpose, to demo PIN_NOT_SET.
    const pinHash = hashPin(DEMO_PIN);
    const userIds = {} as Record<keyof typeof SEED_USERS, string>;
    for (const [key, u] of Object.entries(SEED_USERS) as [keyof typeof SEED_USERS, (typeof SEED_USERS)[keyof typeof SEED_USERS]][]) {
      const [row] = await tx
        .insert(users)
        .values({ ...u, pinHash: key === 'parentC' || u.role === 'creator' ? null : pinHash, createdAt: now - 90 * DAY_MS })
        .returning({ id: users.id });
      userIds[key] = row!.id;
    }

    const [plan] = await tx.insert(plans).values(SEED_PLAN).returning({ id: plans.id });

    const bookIds = {} as Record<string, string>;
    const bookPrices = {} as Record<string, number>;
    for (const [i, b] of SEED_BOOKS.entries()) {
      const createdAt = now - (80 - i * 5) * DAY_MS;
      const [row] = await tx
        .insert(books)
        .values({
          creatorId: userIds[b.creator],
          title: b.title,
          authorName: SEED_USERS[b.creator].name,
          description: b.description,
          coverUrl: b.coverUrl,
          ageMin: b.ageMin,
          ageMax: b.ageMax,
          priceIdr: b.priceIdr,
          status: b.status,
          createdAt,
          updatedAt: createdAt,
          archivedAt: b.status === 'archived' ? now - 30 * DAY_MS : null,
        })
        .returning({ id: books.id });
      bookIds[b.slug] = row!.id;
      bookPrices[b.slug] = b.priceIdr;
      await tx.insert(bookPages).values(
        b.pages.map((text, n) => ({
          bookId: row!.id,
          pageNumber: n + 1,
          text,
          imageUrl: pageImage(b.slug, n + 1),
        })),
      );
    }

    // Parent A: no subscription, owns one published book.
    await buyBook(tx, userIds.parentA, bookIds['kiko-firefly']!, bookPrices['kiko-firefly']!, 'seed-a-kiko', now - 20 * DAY_MS);

    // Parent B: active subscription, 10 days in, 20 left.
    await subscribe(tx, userIds.parentB, plan!.id, 'seed-b-sub', now - 10 * DAY_MS);

    // Parent C: subscription period ended 10 days ago but the row is still 'active'
    // (expiry is lazy, nothing flips it), plus the archived book bought earlier.
    await buyBook(tx, userIds.parentC, bookIds['lost-kite']!, bookPrices['lost-kite']!, 'seed-c-kite', now - 60 * DAY_MS);
    await subscribe(tx, userIds.parentC, plan!.id, 'seed-c-sub', now - 40 * DAY_MS);
  });
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function buyBook(tx: Tx, userId: string, bookId: string, price: number, key: string, at: number) {
  const [order] = await tx
    .insert(orders)
    .values({ userId, type: 'book', bookId, amountIdr: price, status: 'paid', idempotencyKey: key, providerRef: `mock_${key}`, createdAt: at, paidAt: at })
    .returning({ id: orders.id });
  await tx.insert(purchases).values({ userId, bookId, orderId: order!.id, pricePaidIdr: price, purchasedAt: at });
}

async function subscribe(tx: Tx, userId: string, planId: string, key: string, start: number) {
  const [order] = await tx
    .insert(orders)
    .values({ userId, type: 'subscription', planId, amountIdr: SEED_PLAN.priceIdr, status: 'paid', idempotencyKey: key, providerRef: `mock_${key}`, createdAt: start, paidAt: start })
    .returning({ id: orders.id });
  await tx.insert(subscriptions).values({
    userId,
    planId,
    status: 'active',
    currentPeriodStart: start,
    currentPeriodEnd: start + SEED_PLAN.periodDays * DAY_MS,
    createdOrderId: order!.id,
    createdAt: start,
  });
}
