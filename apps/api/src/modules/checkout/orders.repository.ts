import { and, desc, eq, getTableColumns, lte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { books, events, orders, plans, purchases, subscriptions } from '../../db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

const orderSelect = { ...getTableColumns(orders), bookTitle: books.title, planName: plans.name };

export type OrderRow = typeof orders.$inferSelect & { bookTitle: string | null; planName: string | null };
export type NewOrder = typeof orders.$inferInsert;

export type SettleOutcome = 'paid' | 'not_pending' | 'already_owned' | 'already_subscribed';

// Thrown inside the grant transaction to roll it back, including the paid status.
class GrantConflict extends Error {
  constructor(readonly outcome: 'already_owned' | 'already_subscribed') {
    super(outcome);
  }
}

export class OrdersRepository {
  constructor(private readonly db: Db) {}

  private base() {
    return this.db
      .select(orderSelect)
      .from(orders)
      .leftJoin(books, eq(books.id, orders.bookId))
      .leftJoin(plans, eq(plans.id, orders.planId));
  }

  async findByKey(userId: string, idempotencyKey: string): Promise<OrderRow | undefined> {
    const [row] = await this.base().where(
      and(eq(orders.userId, userId), eq(orders.idempotencyKey, idempotencyKey)),
    );
    return row;
  }

  async findOwned(id: string, userId: string): Promise<OrderRow | undefined> {
    const [row] = await this.base().where(and(eq(orders.id, id), eq(orders.userId, userId)));
    return row;
  }

  listByUser(userId: string): Promise<OrderRow[]> {
    return this.base().where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt), desc(orders.id));
  }

  // The unique (user, key) index makes a concurrent double-click land on one row:
  // the loser inserts nothing and reads the winner's order.
  async insertPending(values: NewOrder): Promise<{ order: OrderRow; created: boolean }> {
    const inserted = await this.db
      .insert(orders)
      .values(values)
      .onConflictDoNothing({ target: [orders.userId, orders.idempotencyKey] })
      .returning({ id: orders.id });
    const order = inserted[0]
      ? await this.findOwned(inserted[0].id, values.userId)
      : await this.findByKey(values.userId, values.idempotencyKey);
    return { order: order!, created: inserted.length > 0 };
  }

  // Only a pending order can fail; returns false if it was already settled.
  async markFailed(id: string, reason: string): Promise<boolean> {
    const rows = await this.db
      .update(orders)
      .set({ status: 'failed', failureReason: reason })
      .where(and(eq(orders.id, id), eq(orders.status, 'pending')))
      .returning({ id: orders.id });
    return rows.length > 0;
  }

  // Marks the order paid and grants the purchase or subscription in one transaction.
  // The conditional update claims the order first, so a second concurrent payment
  // finds nothing to claim and grants nothing.
  async settlePaid(input: {
    order: OrderRow;
    providerRef: string;
    now: number;
    periodDays?: number;
  }): Promise<SettleOutcome> {
    const { order, providerRef, now, periodDays } = input;
    try {
      return await this.db.transaction(async (tx) => {
        const claimed = await tx
          .update(orders)
          .set({ status: 'paid', paidAt: now, providerRef, failureReason: null })
          .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
          .returning({ id: orders.id });
        if (claimed.length === 0) return 'not_pending';

        if (order.type === 'book') {
          const bookId = order.bookId!;
          const [book] = await tx.select({ creatorId: books.creatorId }).from(books).where(eq(books.id, bookId));
          const [owned] = await tx
            .select({ id: purchases.id })
            .from(purchases)
            .where(and(eq(purchases.userId, order.userId), eq(purchases.bookId, bookId)));
          if (owned || book?.creatorId === order.userId) throw new GrantConflict('already_owned');
          await tx.insert(purchases).values({
            userId: order.userId,
            bookId,
            orderId: order.id,
            pricePaidIdr: order.amountIdr,
            purchasedAt: now,
          });
        } else {
          // Lazy expiry: an elapsed row still marked active is flipped before the new one goes in.
          await tx
            .update(subscriptions)
            .set({ status: 'expired' })
            .where(
              and(
                eq(subscriptions.userId, order.userId),
                eq(subscriptions.status, 'active'),
                lte(subscriptions.currentPeriodEnd, now),
              ),
            );
          const [running] = await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(and(eq(subscriptions.userId, order.userId), eq(subscriptions.status, 'active')));
          if (running) throw new GrantConflict('already_subscribed');
          await tx.insert(subscriptions).values({
            userId: order.userId,
            planId: order.planId!,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: now + periodDays! * DAY_MS,
            createdOrderId: order.id,
            createdAt: now,
          });
        }

        await tx.insert(events).values({
          userId: order.userId,
          name: 'order_paid',
          bookId: order.bookId,
          props: JSON.stringify({ orderId: order.id, type: order.type, amountIdr: order.amountIdr }),
          createdAt: now,
        });
        return 'paid';
      });
    } catch (error) {
      if (error instanceof GrantConflict) return error.outcome;
      throw error;
    }
  }
}
