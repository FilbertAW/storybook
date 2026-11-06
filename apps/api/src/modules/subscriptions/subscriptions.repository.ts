import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { plans, subscriptions } from '../../db/schema';

export class SubscriptionsRepository {
  constructor(private readonly db: Db) {}

  // At most one row per user is marked active (partial unique index). It may
  // already be past its end date: expiry is lazy.
  async findActive(userId: string) {
    const [row] = await this.db
      .select({
        id: subscriptions.id,
        planName: plans.name,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));
    return row;
  }

  async markCancelling(id: string) {
    await this.db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.id, id));
  }
}
