import { beforeEach, describe, expect, it } from 'vitest';
import { and, count, eq, sql } from 'drizzle-orm';
import { createDb, type Db } from '../src/db/client';
import { migrateDb } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { bookPages, books, orders, purchases, subscriptions, users } from '../src/db/schema';

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

let db: Db;

beforeEach(async () => {
  db = createDb(':memory:');
  await migrateDb(db);
  await seedDatabase(db, NOW);
});

// Drizzle wraps driver errors, so the SQLite message lives on `cause`.
async function failure(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (e) {
    return (e as { cause?: Error }).cause?.message ?? String(e);
  }
  return 'no error';
}

async function userByEmail(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return u!;
}

async function bookByTitle(title: string) {
  const [b] = await db.select().from(books).where(eq(books.title, title));
  return b!;
}

describe('seed', () => {
  it('loads the planned scenarios', async () => {
    const [userCount] = await db.select({ n: count() }).from(users);
    expect(userCount!.n).toBe(5);

    const byStatus = await db.select({ status: books.status, n: count() }).from(books).groupBy(books.status);
    expect(Object.fromEntries(byStatus.map((r) => [r.status, r.n]))).toEqual({
      published: 6,
      archived: 1,
    });

    const perBook = await db.select({ bookId: bookPages.bookId, n: count() }).from(bookPages).groupBy(bookPages.bookId);
    expect(perBook).toHaveLength(7);
    expect(perBook.every((r) => r.n >= 8)).toBe(true);
  });

  it('gives parent A no subscription, B an active one, C an elapsed one', async () => {
    const [a, b, c] = await Promise.all(
      ['parent.a', 'parent.b', 'parent.c'].map((p) => userByEmail(`${p}@example.com`)),
    );
    const subsOf = (id: string) => db.select().from(subscriptions).where(eq(subscriptions.userId, id));

    expect(await subsOf(a!.id)).toHaveLength(0);
    const [subB] = await subsOf(b!.id);
    expect(subB!.currentPeriodEnd).toBeGreaterThan(NOW);
    const [subC] = await subsOf(c!.id);
    expect(subC!.status).toBe('active');
    expect(subC!.currentPeriodEnd).toBeLessThan(NOW);
  });

  it('leaves parent C without a PIN and hashes the others', async () => {
    expect((await userByEmail('parent.c@example.com')).pinHash).toBeNull();
    expect((await userByEmail('parent.a@example.com')).pinHash).toMatch(/^scrypt\$/);
  });

  it('gives parent C the archived book as a purchase', async () => {
    const c = await userByEmail('parent.c@example.com');
    const kite = await bookByTitle('The Lost Kite');
    expect(kite.status).toBe('archived');
    const owned = await db.select().from(purchases).where(and(eq(purchases.userId, c.id), eq(purchases.bookId, kite.id)));
    expect(owned).toHaveLength(1);
  });
});

describe('constraints the services will lean on', () => {
  it('rejects a second active subscription for the same user', async () => {
    const b = await userByEmail('parent.b@example.com');
    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, b.id));
    const message = await failure(
      db.insert(subscriptions).values({
        userId: b.id,
        planId: existing!.planId,
        status: 'active',
        currentPeriodStart: NOW,
        currentPeriodEnd: NOW + 1000,
        createdOrderId: existing!.createdOrderId,
        createdAt: NOW,
      }),
    );
    expect(message).toMatch(/UNIQUE constraint failed: subscriptions\.user_id/);
  });

  it('allows a new subscription once the old one is flipped to expired', async () => {
    const c = await userByEmail('parent.c@example.com');
    const [old] = await db.select().from(subscriptions).where(eq(subscriptions.userId, c.id));
    await db.update(subscriptions).set({ status: 'expired' }).where(eq(subscriptions.id, old!.id));
    const message = await failure(
      db.insert(subscriptions).values({
        userId: c.id,
        planId: old!.planId,
        status: 'active',
        currentPeriodStart: NOW,
        currentPeriodEnd: NOW + 1000,
        createdOrderId: old!.createdOrderId,
        createdAt: NOW,
      }),
    );
    expect(message).toBe('no error');
  });

  it('rejects buying a book the user already owns', async () => {
    const a = await userByEmail('parent.a@example.com');
    const [existing] = await db.select().from(purchases).where(eq(purchases.userId, a.id));
    const message = await failure(
      db.insert(purchases).values({
        userId: a.id,
        bookId: existing!.bookId,
        orderId: existing!.orderId,
        pricePaidIdr: 1,
        purchasedAt: NOW,
      }),
    );
    expect(message).toMatch(/UNIQUE constraint failed: purchases\.user_id, purchases\.book_id/);
  });

  it('rejects a repeated idempotency key for the same user', async () => {
    const [first] = await db.select().from(orders).limit(1);
    const message = await failure(
      db.insert(orders).values({
        userId: first!.userId,
        type: first!.type,
        bookId: first!.bookId,
        planId: first!.planId,
        amountIdr: first!.amountIdr,
        status: 'pending',
        idempotencyKey: first!.idempotencyKey,
        createdAt: NOW,
      }),
    );
    expect(message).toMatch(/UNIQUE constraint failed: orders\.user_id, orders\.idempotency_key/);
  });

  it('rejects an order whose type does not match its target', async () => {
    const a = await userByEmail('parent.a@example.com');
    const message = await failure(
      db.insert(orders).values({
        userId: a.id,
        type: 'book',
        amountIdr: 15_000,
        status: 'pending',
        idempotencyKey: 'no-book',
        createdAt: NOW,
      }),
    );
    expect(message).toMatch(/CHECK constraint failed: orders_target_check/);
  });

  it('cascades pages when a book without orders is deleted', async () => {
    const [unordered] = await db
      .select({ id: books.id })
      .from(books)
      .where(sql`${books.id} not in (select book_id from orders where book_id is not null)`)
      .limit(1);
    await db.delete(books).where(eq(books.id, unordered!.id));
    const left = await db.select().from(bookPages).where(eq(bookPages.bookId, unordered!.id));
    expect(left).toHaveLength(0);
  });

  it('refuses to hard-delete a book that has a purchase', async () => {
    const kite = await bookByTitle('The Lost Kite');
    const message = await failure(db.delete(books).where(eq(books.id, kite.id)));
    expect(message).toMatch(/FOREIGN KEY constraint failed/);
  });
});
